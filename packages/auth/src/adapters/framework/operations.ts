import { hashPassword, verifyPassword, needsRehash } from '../core/hash-password.js'
import { generateSessionToken, hashSessionToken, generateOtpToken, hashBackupCode } from '../core/generate-token.js'
import { buildSession, validateSession } from '../core/session.js'
import { generatePkcePair, buildAuthorizationUrl } from '../core/pkce.js'
import { verifyTotpCode, buildTotpUri } from '../core/totp.js'
import { createAccessToken, hashRefreshToken, ACCESS_TOKEN_TTL_MS } from '../core/jwt.js'
import { requireRole, hasPermission, hasMinimumRole, type Action, type Resource } from '../core/rbac.js'
import { evaluateAbac, type AbacPolicy, type AbacContext, type SubjectAttributes, type ResourceAttributes } from '../core/abac.js'
import type { DatabaseAdapter, User } from './types.js'
import type { Session } from '../core/session.js'
import type { ResolvedAuthConfig, OAuthProfile } from './framework-config.js'

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

// ── Signup ────────────────────────────────────────────────────

// ── Rate limiter — sliding window, in-memory (swap for Redis in prod) ────

interface RateLimitEntry {
  count: number
  oldest: number
  blockedUntil: number | null
}

type RateLimitStore = Map<string, RateLimitEntry>

function createRateLimiter(maxAttempts: number, windowMs: number, blockMs: number) {
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

const loginLimiter = createRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000)
const signupLimiter = createRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000)
const emailLimiter = createRateLimiter(3, 15 * 60 * 1000, 15 * 60 * 1000)
const totpLimiter = createRateLimiter(5, 5 * 60 * 1000, 5 * 60 * 1000)

function loginKey(ip: string, email: string) { return `login:${ip}:${email.toLowerCase()}` }
function emailKey(email: string) { return `email:${email.toLowerCase()}` }
function totpKey(userId: string) { return `totp:${userId}` }

// ── Lockout constants ──────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 10
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// ── Signup ────────────────────────────────────────────────────

export async function signupWithPassword(
  db: DatabaseAdapter,
  email: string,
  ip: string,
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
    const updates: Partial<Pick<User, 'failedLoginAttempts' | 'lockedAt'>> = { failedLoginAttempts: attempts }
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

// ── OAuth ─────────────────────────────────────────────────────

export function createOAuthRedirect(
  config: ResolvedAuthConfig,
  providerId: string,
): AuthResult<{ url: URL; codeVerifier: string; state: string }> {
  const provider = config.providerMap.get(providerId)
  if (!provider) return { ok: false, error: 'oauth-provider-unknown' }

  const { codeVerifier, codeChallenge } = generatePkcePair()
  const state = generateOtpToken()

  const url = buildAuthorizationUrl(provider.authorizationUrl, {
    clientId: provider.clientId,
    redirectUri: `${config.basePath}/oauth/${providerId}/callback`,
    scope: provider.scopes,
    state,
    codeChallenge,
  })

  return { ok: true, data: { url, codeVerifier, state } }
}

export async function handleOAuthCallback(
  db: DatabaseAdapter,
  config: ResolvedAuthConfig,
  providerId: string,
  code: string,
  codeVerifier: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>> {
  const provider = config.providerMap.get(providerId)
  if (!provider) return { ok: false, error: 'oauth-provider-unknown' }

  const isOIDC = Boolean(provider.discoveryUrl)

  // exchange code for access token (+ id_token if OIDC)
  let accessToken: string
  let idToken: string | undefined
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${config.basePath}/oauth/${providerId}/callback`,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: codeVerifier,
    })

    const res = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params,
    })

    if (!res.ok) return { ok: false, error: 'oauth-exchange-failed' }
    const data = await res.json() as Record<string, unknown>
    accessToken = String(data['access_token'])
    if (isOIDC) idToken = String(data['id_token'] ?? '')
  } catch {
    return { ok: false, error: 'oauth-exchange-failed' }
  }

  // ── OIDC path: validate id_token, extract claims ───────────────
  if (isOIDC && idToken && provider.discoveryUrl) {
    const { validateIdToken, extractEmailFromClaims, hasOIDC } = await import('../core/oidc.js')
    const clientId = provider.oidcClientId ?? provider.clientId

    let claims: Awaited<ReturnType<typeof validateIdToken>>
    try {
      claims = await validateIdToken(idToken, provider.discoveryUrl, clientId)
    } catch {
      return { ok: false, error: 'oauth-exchange-failed' }
    }

    const emailData = extractEmailFromClaims(claims)
    const email = emailData?.email ?? String(claims.sub)
    const emailVerified = emailData?.emailVerified ?? false

    // find or create user using OIDC claims
    let user: User
    const existingAccount = await db.findOAuthAccount(providerId, String(claims.sub))

    if (existingAccount) {
      const found = await db.findUserById(existingAccount.userId)
      if (!found) return { ok: false, error: 'user-not-found' }
      user = found
    } else {
      const existingUser = await db.findUserByEmail(email)
      if (existingUser) {
        user = existingUser
      } else {
        user = await db.createUser({ email, passwordHash: null })
        if (emailVerified) await db.updateUser(user.id, { emailVerified: true })
      }
      await db.createOAuthAccount({
        providerId,
        providerUserId: String(claims.sub),
        userId: user.id,
      })
    }

    const sessionToken = generateSessionToken()
    const session = buildSession(hashSessionToken(sessionToken), user.id)
    await db.createSession(session)

    return { ok: true, data: { user, token: sessionToken, session } }
  }

  // ── vanilla OAuth path: use userinfo endpoint ────────────────────
  let profile: OAuthProfile
  try {
    const res = await fetch(provider.userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return { ok: false, error: 'oauth-exchange-failed' }
    const raw = await res.json() as Record<string, unknown>
    profile = provider.mapProfile(raw)
  } catch {
    return { ok: false, error: 'oauth-exchange-failed' }
  }

  // find or create user
  let user: User
  const existingAccount = await db.findOAuthAccount(providerId, profile.providerUserId)

  if (existingAccount) {
    const found = await db.findUserById(existingAccount.userId)
    if (!found) return { ok: false, error: 'user-not-found' }
    user = found
  } else {
    // check if email already exists — link accounts
    const existingUser = await db.findUserByEmail(profile.email)
    if (existingUser) {
      user = existingUser
    } else {
      user = await db.createUser({ email: profile.email, passwordHash: null })
      if (profile.emailVerified) {
        await db.updateUser(user.id, { emailVerified: true })
      }
    }
    await db.createOAuthAccount({
      providerId,
      providerUserId: profile.providerUserId,
      userId: user.id,
    })
  }

  const sessionToken = generateSessionToken()
  const session = buildSession(hashSessionToken(sessionToken), user.id)
  await db.createSession(session)

  return { ok: true, data: { user, token: sessionToken, session } }
}

// ── TOTP ──────────────────────────────────────────────────────

export async function setupTotp(
  db: DatabaseAdapter,
  userId: string,
  secret: string,        // base32-encoded secret from generateTotpSecret
  authSecret: string,    // AUTH_SECRET env var — used to encrypt the secret at rest
): Promise<{ encryptedSecret: string; backupCodes: string[] }> {
  const existing = await db.findTotpCredential(userId)
  if (existing) return { ok: false, error: 'totp-already-enabled' } as any

  // encrypt before storing — never store plaintext secrets
  const { encryptTotpSecret } = await import('../../core/totp-crypto.js')
  const encryptedSecret = encryptTotpSecret(secret, authSecret)

  await db.createTotpCredential({
    userId,
    secret: encryptedSecret,
    lastUsedCounter: null,
  })

  // generate and hash backup codes
  const rawCodes = generateBackupCodes(10)
  const codesWithHash = rawCodes.map(code => ({ codeHash: hashBackupCode(code), userId, id: crypto.randomUUID(), usedAt: null }))
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
  const { decryptTotpSecret } = await import('../../core/totp-crypto.js')
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
  if (!credential) { if (ip) totpLimiter.clear(totpKey(userId)); return { ok: false, error: 'totp-not-enabled' } }

  // Decrypt the stored secret before verifying
  const { decryptTotpSecret } = await import('../../core/totp-crypto.js')
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

// ── Session revocation ─────────────────────────────────────────

export interface SessionInfo {
  id: string
  expiresAt: Date
  fresh: boolean
  createdAt: Date
}

export async function revokeSession(
  db: DatabaseAdapter,
  sessionId: string,
): Promise<void> {
  await db.deleteSessionById(sessionId)
}

export async function revokeAllSessions(
  db: DatabaseAdapter,
  userId: string,
): Promise<void> {
  await db.deleteAllUserSessions(userId)
}

/**
 * Returns safe session metadata — never the token hash.
 * The raw Session.id is the token hash, so we strip it.
 */
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
  // always return ok — don't leak whether email exists
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

// ── JWT refresh ─────────────────────────────────────────────────

export async function refreshAccessToken(
  db: DatabaseAdapter,
  rawRefreshToken: string,
  authSecret: string,
): Promise<AuthResult<{ accessToken: string; expiresAt: Date }>> {
  const tokenHash = hashRefreshToken(rawRefreshToken)
  const record = await db.findRefreshToken(tokenHash)
  if (!record) return { ok: false, error: 'token-invalid' }
  if (record.expiresAt < new Date()) {
    await db.deleteRefreshToken(tokenHash)
    return { ok: false, error: 'token-expired' }
  }

  // verify the session still exists and is valid
  const session = await db.findSession(record.sessionId)
  if (!session || session.expiresAt < new Date()) {
    await db.deleteRefreshToken(tokenHash)
    return { ok: false, error: 'token-invalid' }
  }

  const accessToken = createAccessToken(record.userId, record.sessionId, authSecret)
  return { ok: true, data: { accessToken, expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS) } }
}

export async function revokeRefreshToken(
  db: DatabaseAdapter,
  rawRefreshToken: string,
): Promise<void> {
  await db.deleteRefreshToken(hashRefreshToken(rawRefreshToken))
}

// ── RBAC middleware factory ─────────────────────────────────────

/**
 * Creates a route guard that requires one of the given roles.
 *
 * Usage in a route handler:
 *   const user = c.var.user  // from session middleware
 *   const check = requirePermission(user, { roles: ['admin'] })
 *   if (!check.allowed) return c.json({ error: 'forbidden' }, 403)
 */
export function requirePermission(
  user: User,
  opts: { roles?: string[]; action?: Action; resource?: Resource },
): { allowed: boolean } {
  if (!user) return { allowed: false }
  if (opts.roles?.length) {
    if (!requireRole(user, ...opts.roles)) return { allowed: false }
  }
  if (opts.action && opts.resource) {
    if (!hasPermission(user, opts.action, opts.resource)) return { allowed: false }
  }
  return { allowed: true }
}

// ── ABAC middleware factory ───────────────────────────────────────

/**
 * Creates a route guard that evaluates ABAC policies.
 *
 * Usage in a route handler:
 *   const check = requireAbac(user, { role: 'admin' }, { type: 'post' }, 'delete')
 *   if (!check.allowed) return c.json({ error: 'forbidden' }, 403)
 */
export function requireAbac(
  user: User,
  subjectAttrs: SubjectAttributes,
  resourceAttrs: ResourceAttributes,
  action: string,
  policies: AbacPolicy[],
  context?: AbacContext,
): AbacResult {
  if (!user) return { allowed: false, reason: 'no-user' }
  return evaluateAbac(policies, { ...subjectAttrs, role: (user as any)['role'] ?? 'user' }, resourceAttrs, action, context)
}
