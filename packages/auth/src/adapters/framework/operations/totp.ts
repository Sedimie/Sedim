import { verifyTotpCode, buildTotpUri } from '../../../core/totp.js'
import { generateOtpToken, generateSessionToken, hashSessionToken, hashBackupCode, generateBackupCodes } from '../../../core/generate-token.js'
import { buildSession } from '../../../core/session.js'
import type { DatabaseAdapter, User } from '../../types.js'
import type { Session } from '../../../core/session.js'
import { type AuthResult, totpLimiter, totpKey } from './core.js'

// ── TOTP ──────────────────────────────────────────────────────

export async function setupTotp(
  db: DatabaseAdapter,
  userId: string,
  email: string,
  authSecret: string,
  issuer = 'App',
): Promise<AuthResult<{ secret: string; uri: string; backupCodes: string[] }>> {
  const existing = await db.findTotpCredential(userId)
  if (existing) return { ok: false, error: 'totp-already-enabled' }

  // generate secret + 10 backup codes
  const rawSecret = generateOtpToken()
  const rawBackupCodes = generateBackupCodes(10)

  // Encrypt the TOTP secret with AUTH_SECRET before writing to database
  const { encryptTotpSecret } = await import('../../../core/totp-crypto.js')
  const encryptedSecret = encryptTotpSecret(rawSecret, authSecret)

  await db.createTotpCredential({
    userId,
    secret: encryptedSecret,
    lastUsedCounter: null,
  })

  // store hashed backup codes
  for (const code of rawBackupCodes) {
    await db.createBackupCode({
      userId,
      codeHash: hashBackupCode(code),
      usedAt: null,
    })
  }

  const uri = buildTotpUri(rawSecret, email, issuer)
  return { ok: true, data: { secret: rawSecret, uri, backupCodes: rawBackupCodes } }
}

export async function getTotpUri(
  db: DatabaseAdapter,
  userId: string,
  email: string,
  authSecret: string,
  issuer = 'App',
): Promise<string | null> {
  const credential = await db.findTotpCredential(userId)
  if (!credential) return null

  const { decryptTotpSecret } = await import('../../../core/totp-crypto.js')
  const secret = decryptTotpSecret(credential.secret, authSecret)
  if (!secret) return null

  return buildTotpUri(secret, email, issuer)
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
  if (!credential) { if (ip) totpLimiter.clear(totpKey(userId)); return { ok: false, error: 'totp-not-enabled' } }

  // Decrypt the stored secret before verifying
  const { decryptTotpSecret } = await import('../../../core/totp-crypto.js')
  const secret = decryptTotpSecret(credential.secret, authSecret)
  if (!secret) { if (ip) totpLimiter.clear(totpKey(userId)); return { ok: false, error: 'totp-invalid' } }

  const { valid, usedCounter } = verifyTotpCode(secret, code)
  if (!valid) { if (ip) totpLimiter.clear(totpKey(userId)); return { ok: false, error: 'totp-invalid' } }

  // reject replay within drift window
  if (usedCounter !== null && credential.lastUsedCounter !== null && usedCounter <= credential.lastUsedCounter) {
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
