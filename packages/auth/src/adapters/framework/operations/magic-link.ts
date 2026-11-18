import { generateOtpToken, hashSessionToken, generateSessionToken } from '../../../core/generate-token.js'
import { buildSession } from '../../../core/session.js'
import type { DatabaseAdapter, User } from '../../types.js'
import type { Session } from '../../../core/session.js'
import { type AuthResult, emailLimiter, emailKey } from './core.js'

// ── Magic link ────────────────────────────────────────────────

export async function createMagicLink(
  db: DatabaseAdapter,
  email: string,
  ip?: string,
): Promise<AuthResult<{ token: string; userId: string }>> {
  if (ip) {
    const limited = emailLimiter.check(emailKey(email))
    if (!limited.allowed) return { ok: false, error: 'rate-limited' }
    emailLimiter.hit(emailKey(email))
  }

  let user = await db.findUserByEmail(email)

  // create account if it doesn't exist — magic link is also signup
  if (!user) {
    user = await db.createUser({ email, passwordHash: null })
  }

  await db.deleteExpiredOtpTokens(user.id)

  const token = generateOtpToken()
  const tokenHash = hashSessionToken(token)

  await db.createOtpToken({
    userId: user.id,
    tokenHash,
    type: 'magic-link',
    expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
  })

  if (ip) emailLimiter.clear(emailKey(email))
  return { ok: true, data: { token, userId: user.id } }
}

export async function verifyMagicLink(
  db: DatabaseAdapter,
  token: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>> {
  const tokenHash = hashSessionToken(token)
  const otp = await db.findOtpToken(tokenHash, 'magic-link')

  if (!otp) return { ok: false, error: 'token-invalid' }
  if (otp.expiresAt < new Date()) {
    await db.deleteOtpToken(otp.id)
    return { ok: false, error: 'token-expired' }
  }

  await db.deleteOtpToken(otp.id)
  await db.updateUser(otp.userId, { emailVerified: true })

  const user = await db.findUserById(otp.userId)
  if (!user) return { ok: false, error: 'user-not-found' }

  const sessionToken = generateSessionToken()
  const session = buildSession(hashSessionToken(sessionToken), user.id)
  await db.createSession(session)

  return { ok: true, data: { user, token: sessionToken, session } }
}
