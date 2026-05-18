import { hashPassword, verifyPassword, needsRehash } from '../core/hash-password.js'
import { generateSessionToken, hashSessionToken, generateOtpToken, hashBackupCode } from '../core/generate-token.js'
import { buildSession, validateSession } from '../core/session.js'
import { generatePkcePair, buildAuthorizationUrl } from '../core/pkce.js'
import { verifyTotpCode } from '../core/totp.js'
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

// ── Signup ────────────────────────────────────────────────────

export async function signupWithPassword(
  db: DatabaseAdapter,
  email: string,
  password: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>> {
  const existing = await db.findUserByEmail(email)
  if (existing) return { ok: false, error: 'email-taken' }

  const passwordHash = await hashPassword(password)
  const user = await db.createUser({ email, passwordHash })

  const token = generateSessionToken()
  const session = buildSession(hashSessionToken(token), user.id)
  await db.createSession(session)

  return { ok: true, data: { user, token, session } }
}

// ── Login ─────────────────────────────────────────────────────

export async function loginWithPassword(
  db: DatabaseAdapter,
  email: string,
  password: string,
): Promise<AuthResult<{ user: User; token: string; session: Session; needsTotp: boolean }>> {
  const user = await db.findUserByEmail(email)
  if (!user || !user.passwordHash) return { ok: false, error: 'invalid-credentials' }

  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) return { ok: false, error: 'invalid-credentials' }

  // silently rehash if parameters have been upgraded
  if (needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(password)
    await db.updateUser(user.id, { passwordHash: newHash })
  }

  const totp = await db.findTotpCredential(user.id)
  if (totp) {
    // TOTP is enabled — don't create a full session yet.
    // Return needsTotp: true so the framework adapter can issue a
    // short-lived "pending MFA" token instead of a full session cookie.
    return { ok: true, data: { user, token: '', session: {} as Session, needsTotp: true } }
  }

  const token = generateSessionToken()
  const session = buildSession(hashSessionToken(token), user.id)
  await db.createSession(session)

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
): Promise<AuthResult<{ token: string; userId: string }>> {
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

  // exchange code for access token
  let accessToken: string
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
  } catch {
    return { ok: false, error: 'oauth-exchange-failed' }
  }

  // fetch user profile from provider
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

export async function completeTotpLogin(
  db: DatabaseAdapter,
  userId: string,
  code: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>> {
  const credential = await db.findTotpCredential(userId)
  if (!credential) return { ok: false, error: 'totp-not-enabled' }

  const { valid, usedCounter } = verifyTotpCode(credential.secret, code)
  if (!valid) return { ok: false, error: 'totp-invalid' }

  // reject replay within drift window
  if (usedCounter !== null && credential.lastUsedCounter !== null && usedCounter <= credential.lastUsedCounter) {
    return { ok: false, error: 'totp-invalid' }
  }

  if (usedCounter !== null) {
    await db.updateTotpLastUsedCounter(userId, usedCounter)
  }

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
