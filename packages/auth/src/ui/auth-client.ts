// src/sedim/auth/ui/auth-client.ts
// ── Auth API client ───────────────────────────────────────────
// Typed fetch wrappers for all auth endpoints.
// Components import from here — not raw fetch.
// If you change basePath in config.ts, update BASE_PATH here too.

const BASE_PATH =
  typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_API_URL']
    ? `${process.env['NEXT_PUBLIC_API_URL']}/api/auth`
    : typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL
      ? `${(import.meta as any).env.VITE_API_URL}/api/auth`
      : '/api/auth'

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
  | 'network-error'
  | string

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthError }

async function post<T>(path: string, body: unknown): Promise<AuthResult<T>> {
  try {
    const res = await fetch(`${BASE_PATH}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
