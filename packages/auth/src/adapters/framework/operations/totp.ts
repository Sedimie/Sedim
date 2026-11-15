import { verifyTotpCode, buildTotpUri } from '../../../core/totp.js'
import {
  generateSessionToken,
  hashSessionToken,
  hashBackupCode,
  generateBackupCodes,
} from '../../../core/generate-token.js'
import { buildSession } from '../../../core/session.js'
import type { DatabaseAdapter, User } from '../../types.js'
import type { Session } from '../../../core/session.js'
import { type AuthResult, totpLimiter, totpKey } from './core.js'

// ── TOTP Operations ───────────────────────────────────────────

export async function setupTotp(
  db: DatabaseAdapter,
  userId: string,
  secret: string, // base32-encoded secret from generateTotpSecret
  authSecret: string, // AUTH_SECRET env var — used to encrypt the secret at rest
): Promise<{ encryptedSecret: string; backupCodes: string[] }> {
  const existing = await db.findTotpCredential(userId)
  if (existing) return { ok: false, error: 'totp-already-enabled' } as any

  // encrypt before storing — never store plaintext secrets
  const { encryptTotpSecret } = await import('../../../core/totp-crypto.js')
  const encryptedSecret = encryptTotpSecret(secret, authSecret)

  await db.createTotpCredential({
    userId,
    secret: encryptedSecret,
    lastUsedCounter: null,
  })

  // generate and hash backup codes
  const rawCodes = generateBackupCodes(10)
  const codesWithHash = rawCodes.map(code => ({
    codeHash: hashBackupCode(code),
    userId,
    id: crypto.randomUUID(),
    usedAt: null,
  }))
  await db.createBackupCodes(codesWithHash)

  return { encryptedSecret, backupCodes: rawCodes }
}

export async function getTotpUri(
  db: DatabaseAdapter,
  userId: string,
  email: string,
  authSecret: string,
): Promise<string | null> {
  const credential = await db.findTotpCredential(userId)
  if (!credential) return null

  // decrypt to get the plaintext secret for URI construction
  const { decryptTotpSecret } = await import('../../../core/totp-crypto.js')
  const secret = decryptTotpSecret(credential.secret, authSecret)
  if (!secret) return null

  return buildTotpUri(secret, email, 'Sedim')
}

export async function completeTotpLogin(
  db: DatabaseAdapter,
  authSecret: string,
  userId: string,
  code: string,
  ip?: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>> {
  if (ip) {
    const limited = totpLimiter.check(totpKey(userId))
    if (!limited.allowed) return { ok: false, error: 'rate-limited' }
    totpLimiter.hit(totpKey(userId))
  }

  const credential = await db.findTotpCredential(userId)
  if (!credential) {
    if (ip) totpLimiter.clear(totpKey(userId))
    return { ok: false, error: 'totp-not-enabled' }
  }

  // Decrypt the stored secret before verifying
  const { decryptTotpSecret } = await import('../../../core/totp-crypto.js')
  const secret = decryptTotpSecret(credential.secret, authSecret)
  if (!secret) {
    if (ip) totpLimiter.clear(totpKey(userId))
    return { ok: false, error: 'totp-invalid' }
  }

  const { valid, usedCounter } = verifyTotpCode(secret, code)
  if (!valid) {
    if (ip) totpLimiter.clear(totpKey(userId))
    return { ok: false, error: 'totp-invalid' }
  }

  // reject replay within drift window
  if (
    usedCounter !== null &&
    credential.lastUsedCounter !== null &&
    usedCounter <= credential.lastUsedCounter
  ) {
    return { ok: false, error: 'totp-invalid' }
  }

  if (usedCounter !== null) {
    await db.updateTotpLastUsedCounter(userId, usedCounter)
  }

  if (ip) totpLimiter.clear(totpKey(userId))
  const user = await db.findUserById(userId)
  if (!user) return { ok: false, error: 'user-not-found' }

  const sessionToken = generateSessionToken()
  const session = buildSession(hashSessionToken(sessionToken), user.id)
  await db.createSession(session)

  return { ok: true, data: { user, token: sessionToken, session } }
}

export async function verifyBackupCode(
  db: DatabaseAdapter,
  userId: string,
  rawCode: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>> {
  const codeHash = hashBackupCode(rawCode)
  const backupCode = await db.findBackupCode(userId, codeHash)

  if (!backupCode || backupCode.usedAt !== null) {
    return { ok: false, error: 'backup-code-invalid' }
  }

  await db.markBackupCodeUsed(backupCode.id)

  const user = await db.findUserById(userId)
  if (!user) return { ok: false, error: 'user-not-found' }

  const sessionToken = generateSessionToken()
  const session = buildSession(hashSessionToken(sessionToken), user.id)
  await db.createSession(session)

  return { ok: true, data: { user, token: sessionToken, session } }
}
