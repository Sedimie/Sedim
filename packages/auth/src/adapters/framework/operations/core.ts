import { hashPassword, verifyPassword, needsRehash } from '../../../core/hash-password.js'
import { generateSessionToken, hashSessionToken, generateOtpToken } from '../../../core/generate-token.js'
import { buildSession, validateSession } from '../../../core/session.js'
import type { DatabaseAdapter, User } from '../../types.js'
import type { Session } from '../../../core/session.js'

// ── Result types ──────────────────────────────────────────────

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthError }

export type AuthError =
  | 'invalid-credentials'
  | 'email-taken'
  | 'user-not-found'
  | 'token-expired'
  | 'token-invalid'
  | 'totp-invalid'
  | 'totp-not-enabled'
  | 'totp-already-enabled'
  | 'backup-code-invalid'
  | 'oauth-state-mismatch'
  | 'oauth-provider-unknown'
  | 'oauth-exchange-failed'
  | 'account-locked'
  | 'rate-limited'

// ── Rate limiter — sliding window, in-memory ────────────────────

export interface RateLimitEntry {
  count: number
  oldest: number
  blockedUntil: number | null
}

export type RateLimitStore = Map<string, RateLimitEntry>

export function createRateLimiter(maxAttempts: number, windowMs: number, blockMs: number) {
  const store: RateLimitStore = new Map()

  return {
    check(key: string): { allowed: boolean; retryAfterMs?: number } {
      const now = Date.now()
      const entry = store.get(key)

      if (!entry) return { allowed: true }

      if (entry.blockedUntil !== null && now < entry.blockedUntil) {
        return { allowed: false, retryAfterMs: entry.blockedUntil - now }
      }

      if (now - entry.oldest > windowMs) {
        if (entry.count === 1) {
          store.delete(key)
          return { allowed: true }
        }
        entry.count = 0
        entry.oldest = now
        entry.blockedUntil = null
        store.set(key, entry)
        return { allowed: true }
      }

      if (entry.count >= maxAttempts) {
        entry.blockedUntil = now + blockMs
        store.set(key, entry)
        return { allowed: false, retryAfterMs: blockMs }
      }

      return { allowed: true }
    },
    hit(key: string) {
      const now = Date.now()
      const entry = store.get(key)
      if (!entry || now - entry.oldest > windowMs) {
        store.set(key, { count: 1, oldest: now, blockedUntil: null })
        return
      }
      entry.count++
      store.set(key, entry)
    },
    clear(key: string) {
      store.delete(key)
    },
  }
}

export const loginLimiter = createRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000)
export const signupLimiter = createRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000)
export const emailLimiter = createRateLimiter(3, 15 * 60 * 1000, 15 * 60 * 1000)
export const totpLimiter = createRateLimiter(5, 5 * 60 * 1000, 5 * 60 * 1000)

export function loginKey(ip: string, email: string) {
  return `login:${ip}:${email.toLowerCase()}`
}
export function emailKey(email: string) {
  return `email:${email.toLowerCase()}`
}
export function totpKey(userId: string) {
  return `totp:${userId}`
}

// ── Lockout constants ──────────────────────────────────────────
export const MAX_FAILED_ATTEMPTS = 10
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// ── Signup ────────────────────────────────────────────────────

export async function signupWithPassword(
  db: DatabaseAdapter,
  ip: string,
  email: string,
  password: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>> {
  const limited = signupLimiter.check(loginKey(ip, email))
  if (!limited.allowed) {
    return { ok: false, error: 'rate-limited' }
  }

  const existing = await db.findUserByEmail(email)
  if (existing) {
    signupLimiter.hit(loginKey(ip, email))
    return { ok: false, error: 'email-taken' }
  }

  const passwordHash = await hashPassword(password)
  const user = await db.createUser({ email, passwordHash })

  const token = generateSessionToken()
  const session = buildSession(hashSessionToken(token), user.id)
  await db.createSession(session)

  signupLimiter.clear(loginKey(ip, email))
  return { ok: true, data: { user, token, session } }
}

// ── Login ─────────────────────────────────────────────────────

export async function loginWithPassword(
  db: DatabaseAdapter,
  ip: string,
  email: string,
  password: string,
): Promise<AuthResult<{ user: User; token: string; session: Session; needsTotp: boolean }>> {
  const limited = loginLimiter.check(loginKey(ip, email))
  if (!limited.allowed) {
    return { ok: false, error: 'rate-limited' }
  }

  const user = await db.findUserByEmail(email)
  if (!user || !user.passwordHash) {
    loginLimiter.hit(loginKey(ip, email))
    return { ok: false, error: 'invalid-credentials' }
  }

  // Check account lockout
  if (user.lockedAt !== null && user.lockedAt.getTime() > Date.now()) {
    return { ok: false, error: 'account-locked' }
  }

  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) {
    loginLimiter.hit(loginKey(ip, email))
    const attempts = (user.failedLoginAttempts ?? 0) + 1
    const updates: Partial<Pick<User, 'failedLoginAttempts' | 'lockedAt'>> = {
      failedLoginAttempts: attempts,
    }
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      updates.lockedAt = new Date(Date.now() + LOCKOUT_DURATION_MS)
    }
    await db.updateUser(user.id, updates)
    return { ok: false, error: 'invalid-credentials' }
  }

  // Successful login — reset lockout counters
  if (user.failedLoginAttempts > 0 || user.lockedAt !== null) {
    await db.updateUser(user.id, { failedLoginAttempts: 0, lockedAt: null })
  }

  // silently rehash if parameters have been upgraded
  if (needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(password)
    await db.updateUser(user.id, { passwordHash: newHash })
  }

  const totp = await db.findTotpCredential(user.id)
  if (totp) {
    return { ok: true, data: { user, token: '', session: {} as Session, needsTotp: true } }
  }

  const token = generateSessionToken()
  const session = buildSession(hashSessionToken(token), user.id)
  await db.createSession(session)

  loginLimiter.clear(loginKey(ip, email))
  return { ok: true, data: { user, token, session, needsTotp: false } }
}

// ── Logout ────────────────────────────────────────────────────

export async function logout(db: DatabaseAdapter, tokenHash: string): Promise<void> {
  await db.deleteSession(tokenHash)
}

// ── Session validation ────────────────────────────────────────

export async function validateRequest(
  db: DatabaseAdapter,
  rawToken: string | null,
): Promise<{ user: User; session: Session } | null> {
  if (!rawToken) return null

  const tokenHash = hashSessionToken(rawToken)
  const stored = await db.findSession(tokenHash)
  if (!stored) return null

  const result = validateSession(stored)
  if (!result) {
    await db.deleteSession(tokenHash)
    return null
  }

  if (result.extended) {
    await db.updateSessionExpiry(tokenHash, result.session.expiresAt)
  }

  const user = await db.findUserById(result.session.userId)
  if (!user) {
    await db.deleteSession(tokenHash)
    return null
  }

  return { user, session: result.session }
}

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

// ── Session revocation ─────────────────────────────────────────

export interface SessionInfo {
  id: string
  expiresAt: Date
  fresh: boolean
  createdAt: Date
}

export async function revokeSession(db: DatabaseAdapter, sessionId: string): Promise<void> {
  await db.deleteSessionById(sessionId)
}

export async function revokeAllSessions(db: DatabaseAdapter, userId: string): Promise<void> {
  await db.deleteAllUserSessions(userId)
}

export async function listUserSessions(
  db: DatabaseAdapter,
  userId: string,
): Promise<SessionInfo[]> {
  const sessions = await db.findAllUserSessions(userId)
  return sessions.map(s => ({
    id: s.id,
    expiresAt: s.expiresAt,
    fresh: s.fresh,
    createdAt: s.createdAt,
  }))
}

// ── Password reset ────────────────────────────────────────────

export async function createPasswordResetToken(
  db: DatabaseAdapter,
  email: string,
): Promise<AuthResult<{ token: string; userId: string }>> {
  const user = await db.findUserByEmail(email)
  if (!user) return { ok: true, data: { token: '', userId: '' } }

  await db.deleteExpiredOtpTokens(user.id)

  const token = generateOtpToken()
  const tokenHash = hashSessionToken(token)

  await db.createOtpToken({
    userId: user.id,
    tokenHash,
    type: 'password-reset',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
  })

  return { ok: true, data: { token, userId: user.id } }
}

export async function confirmPasswordReset(
  db: DatabaseAdapter,
  token: string,
  newPassword: string,
): Promise<AuthResult<{ user: User }>> {
  const tokenHash = hashSessionToken(token)
  const otp = await db.findOtpToken(tokenHash, 'password-reset')

  if (!otp) return { ok: false, error: 'token-invalid' }
  if (otp.expiresAt < new Date()) {
    await db.deleteOtpToken(otp.id)
    return { ok: false, error: 'token-expired' }
  }

  await db.deleteOtpToken(otp.id)

  const newHash = await hashPassword(newPassword)
  const user = await db.updateUser(otp.userId, { passwordHash: newHash })

  // invalidate all existing sessions on password reset
  await db.deleteAllUserSessions(otp.userId)

  return { ok: true, data: { user } }
}
