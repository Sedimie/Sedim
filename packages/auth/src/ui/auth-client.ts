// src/sedim/auth/ui/auth-client.ts
// ── Auth API client ───────────────────────────────────────────
// Typed fetch wrappers for all auth endpoints.
// Components import from here — not raw fetch.
// If you change basePath in config.ts, update BASE_PATH here too.

// If you change basePath in config.ts, update BASE_PATH here too.
// API_BASE_PATH is substituted at stamp time: /api/auth for Next.js, /auth for Express/Hono.
const BASE_PATH = (() => {
  if (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_API_URL']) {
    return `${process.env['NEXT_PUBLIC_API_URL']}/api/auth`
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) {
    return `${(import.meta as any).env.VITE_API_URL}{{API_BASE_PATH}}`
  }
  return '{{API_BASE_PATH}}'
})()

export interface AuthUser {
  id: string
  email: string
  emailVerified: boolean
  createdAt: string
}

export interface AuthSession {
  user: AuthUser | null
}

export interface SessionInfo {
  id: string
  expiresAt: string
  fresh: boolean
  createdAt: string
}

export type AuthError =
  | 'invalid-credentials'
  | 'email-taken'
  | 'user-not-found'
  | 'token-expired'
  | 'token-invalid'
  | 'totp-invalid'
  | 'totp-not-enabled'
  | 'backup-code-invalid'
  | 'oauth-provider-unknown'
  | 'account-locked'
  | 'rate-limited'
  | 'network-error'
  | string

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthError }

// ── CSRF token ──────────────────────────────────────────────────

let _csrfToken: string | null = null

/**
 * Fetches and caches the CSRF token from the server.
 * Call this once on app init (e.g., in a root layout or auth provider).
 */
export async function loadCsrfToken(): Promise<string | null> {
  const result = await get<{ token: string }>('/csrf-token')
  if (result.ok) {
    _csrfToken = result.data.token
    return _csrfToken
  }
  return null
}

function csrfHeader(): Record<string, string> {
  return _csrfToken ? { 'x-csrf-token': _csrfToken } : {}
}

// ── Internal fetch helpers ───────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<AuthResult<T>> {
  try {
    const res = await fetch(`${BASE_PATH}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeader() },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    })
    const json = await res.json() as Record<string, unknown>
    if (!res.ok) return { ok: false, error: (json['error'] as AuthError) ?? 'network-error' }
    return { ok: true, data: json as T }
  } catch {
    return { ok: false, error: 'network-error' }
  }
}

async function get<T>(path: string): Promise<AuthResult<T>> {
  try {
    const res = await fetch(`${BASE_PATH}${path}`, { credentials: 'same-origin' })
    const json = await res.json() as Record<string, unknown>
    if (!res.ok) return { ok: false, error: (json['error'] as AuthError) ?? 'network-error' }
    return { ok: true, data: json as T }
  } catch {
    return { ok: false, error: 'network-error' }
  }
}

// ── Session ───────────────────────────────────────────────────

export async function getSession(): Promise<AuthUser | null> {
  const result = await get<{ user: AuthUser | null }>('/session')
  return result.ok ? result.data.user : null
}

export async function listSessions(): Promise<AuthResult<SessionInfo[]>> {
  return get<{ sessions: SessionInfo[] }>('/sessions')
}

export async function revokeSession(sessionId: string): Promise<AuthResult<{ ok: true }>> {
  return post('/sessions/revoke', { sessionId })
}

export async function revokeAllSessions(): Promise<AuthResult<{ ok: true }>> {
  return post('/sessions/revoke-all', {})
}

// ── Email + Password ──────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<AuthResult<{ user: AuthUser } | { requiresTotp: true }>> {
  return post('/login', { email, password })
}

export async function signup(
  email: string,
  password: string,
): Promise<AuthResult<{ user: AuthUser }>> {
  return post('/signup', { email, password })
}

export async function logout(): Promise<void> {
  await post('/logout', {})
}

// ── Magic link ────────────────────────────────────────────────

export async function requestMagicLink(email: string): Promise<AuthResult<{ ok: true }>> {
  return post('/magic-link', { email })
}

// ── Password reset ────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<AuthResult<{ ok: true }>> {
  return post('/password-reset/request', { email })
}

export async function confirmPasswordReset(
  token: string,
  password: string,
): Promise<AuthResult<{ ok: true }>> {
  return post('/password-reset/confirm', { token, password })
}

// ── TOTP ──────────────────────────────────────────────────────

export async function verifyTotp(code: string): Promise<AuthResult<{ user: AuthUser }>> {
  return post('/totp/verify', { code })
}

export async function verifyBackupCode(code: string): Promise<AuthResult<{ user: AuthUser }>> {
  return post('/totp/backup', { code })
}

// ── OAuth ─────────────────────────────────────────────────────
// Redirects the browser — no fetch needed.

export function redirectToOAuth(provider: 'google' | 'github' | 'discord' | string): void {
  window.location.href = `${BASE_PATH}/oauth/${provider}`
}

// ── JWT refresh ────────────────────────────────────────────────

/**
 * Refreshes an expired or expiring access token using the httpOnly refresh_token cookie.
 * The browser never sees the refresh token — it lives in an httpOnly cookie.
 */
export async function refreshAccessToken(): Promise<AuthResult<{ ok: true }>> {
  return post('/refresh', {})
}

/**
 * Revokes the refresh token (used on logout for full token cleanup).
 */
export async function revokeRefreshToken(): Promise<AuthResult<{ ok: true }>> {
  return post('/refresh/revoke', {})
}

// ── Server Components (Next.js App Router) ─────────────────────

/**
 * Gets the current session in Server Components and Route Handlers.
 * Reads the session cookie directly — no HTTP round-trip.
 *
 * Usage:
 *   import { getServerSession } from './auth-client'
 *   const user = await getServerSession()
 */
export async function getServerSession(): Promise<AuthUser | null> {
  const result = await get<{ user: AuthUser | null }>('/session')
  return result.ok ? result.data.user : null
}
