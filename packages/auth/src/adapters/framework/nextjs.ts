import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hashSessionToken } from '../../core/generate-token.js'
import { createRefreshToken } from '../../core/jwt.js'
import { encodeBase32LowerCaseNoPadding } from '@oslojs/encoding'

function generateCsrfToken(): string {
  return encodeBase32LowerCaseNoPadding(crypto.getRandomValues(new Uint8Array(32)))
}
import type { User } from '../types.js'
import type { Session } from '../../core/session.js'
import type { AuthConfig } from './framework-config.js'
import { resolveConfig } from './framework-config.js'
import {
  signupWithPassword,
  loginWithPassword,
  logout,
  validateRequest,
  createMagicLink,
  verifyMagicLink,
  createOAuthRedirect,
  handleOAuthCallback,
  completeTotpLogin,
  verifyBackupCode,
  createPasswordResetToken,
  confirmPasswordReset,
  listUserSessions,
  revokeSession,
  revokeAllSessions,
  refreshAccessToken,
  revokeRefreshToken,
} from './operations.js'
import { sendEmail, buildMagicLinkEmail, buildPasswordResetEmail } from '../../core/email-transport.js'

// ── Cookie helpers ────────────────────────────────────────────

async function setSessionCookie(
  token: string,
  expiresAt: Date,
  config: ReturnType<typeof resolveConfig>,
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(config.cookieName, token, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

async function clearSessionCookie(config: ReturnType<typeof resolveConfig>): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(config.cookieName)
}

async function getSessionToken(config: ReturnType<typeof resolveConfig>): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(config.cookieName)?.value ?? null
}

// ── Server-side session helper ────────────────────────────────

/**
 * Gets the current session in Server Components, Server Actions, and Route Handlers.
 *
 * Usage in a Server Component:
 *   const { user } = await getSession(authConfig) ?? {}
 */
export async function getSession(
  config: AuthConfig,
): Promise<{ user: User; session: Session } | null> {
  const resolved = resolveConfig(config)
  const token = await getSessionToken(resolved)
  return validateRequest(resolved.db, token)
}

/**
 * Lightweight session getter for Server Components — no HTTP round-trip.
 * Uses cookies() directly and calls validateRequest against the DB.
 *
 * Usage in a Server Component:
 *   import { getServerSession } from './auth-client'
 *   const user = await getServerSession(authConfig)
 */
export async function getServerSession(config: AuthConfig): Promise<User | null> {
  const resolved = resolveConfig(config)
  const token = await getSessionToken(resolved)
  const result = await validateRequest(resolved.db, token)
  return result ? sanitizeUser(result.user) : null
}

// ── Route handler factory ─────────────────────────────────────

/**
 * Creates Next.js App Router route handlers for all auth endpoints.
 * Mount at app/api/auth/[...all]/route.ts
 *
 * Usage:
 *   import { createNextjsAuthHandlers } from './auth/adapters/framework/nextjs'
 *   export const { GET, POST } = createNextjsAuthHandlers({ db, secret, providers: [...] })
 */
export function createNextjsAuthHandlers(config: AuthConfig): {
  GET: (req: NextRequest, ctx: { params: Promise<{ all: string[] }> }) => Promise<NextResponse>
  POST: (req: NextRequest, ctx: { params: Promise<{ all: string[] }> }) => Promise<NextResponse>
} {
  const resolved = resolveConfig(config)

  async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ all: string[] }> },
  ): Promise<NextResponse> {
    const { all } = await ctx.params
    const path = all.join('/')

    // GET /api/auth/session
    if (path === 'session') {
      const token = await getSessionToken(resolved)
      const result = await validateRequest(resolved.db, token)
      if (!result) return NextResponse.json({ user: null }, { status: 401 })
      return NextResponse.json({ user: sanitizeUser(result.user) })
    }

    // GET /api/auth/csrf-token — returns CSRF token, sets httpOnly cookie
    if (path === 'csrf-token') {
      const token = generateCsrfToken()
      const response = NextResponse.json({ token })
      response.cookies.set('csrf_token', token, {
        httpOnly: true, secure: resolved.secureCookies, sameSite: 'strict',
        maxAge: 86400, path: '/',
      })
      response.headers.set('X-CSRF-Token', token)
      return response
    }

    // GET /api/auth/sessions — list all sessions for the current user
    if (path === 'sessions') {
      const token = await getSessionToken(resolved)
      const sessionResult = await validateRequest(resolved.db, token)
      if (!sessionResult) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

      const sessions = await listUserSessions(resolved.db, sessionResult.user.id)
      return NextResponse.json({ sessions })
    }

    // GET /api/auth/magic-link/verify?token=...
    if (path === 'magic-link/verify') {
      const token = req.nextUrl.searchParams.get('token')
      if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

      const result = await verifyMagicLink(resolved.db, token)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

      await setSessionCookie(result.data.token, result.data.session.expiresAt, resolved)
      return NextResponse.redirect(new URL('/', req.url))
    }

    // GET /api/auth/oauth/:provider
    if (path.startsWith('oauth/') && !path.includes('/callback')) {
      const provider = path.replace('oauth/', '')
      const result = createOAuthRedirect(resolved, provider)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

      const response = NextResponse.redirect(result.data.url)
      response.cookies.set('oauth_code_verifier', result.data.codeVerifier, {
        httpOnly: true, secure: resolved.secureCookies, sameSite: 'lax', maxAge: 600, path: '/',
      })
      response.cookies.set('oauth_state', result.data.state, {
        httpOnly: true, secure: resolved.secureCookies, sameSite: 'lax', maxAge: 600, path: '/',
      })
      return response
    }

    // GET /api/auth/oauth/:provider/callback
    if (path.startsWith('oauth/') && path.endsWith('/callback')) {
      const provider = path.replace('oauth/', '').replace('/callback', '')
      const code = req.nextUrl.searchParams.get('code')
      const state = req.nextUrl.searchParams.get('state')
      const storedState = req.cookies.get('oauth_state')?.value
      const codeVerifier = req.cookies.get('oauth_code_verifier')?.value

      if (!code || !state || state !== storedState || !codeVerifier) {
        return NextResponse.json({ error: 'oauth-state-mismatch' }, { status: 400 })
      }

      const result = await handleOAuthCallback(resolved.db, resolved, provider, code, codeVerifier)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

      const response = NextResponse.redirect(new URL('/', req.url))
      response.cookies.delete('oauth_state')
      response.cookies.delete('oauth_code_verifier')
      response.cookies.set(resolved.cookieName, result.data.token, {
        httpOnly: true, secure: resolved.secureCookies, sameSite: 'lax',
        expires: result.data.session.expiresAt, path: '/',
      })
      return response
    }

    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ all: string[] }> },
  ): Promise<NextResponse> {
    const { all } = await ctx.params
    const path = all.join('/')
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    // CSRF guard — strict same-site for mutating requests
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const cookieToken = req.cookies.get('csrf_token')?.value
      const headerToken = req.headers.get('x-csrf-token') ?? ''
      if (!cookieToken || cookieToken !== headerToken) {
        return NextResponse.json({ error: 'csrf-invalid' }, { status: 403 })
      }
    }

    // POST /api/auth/signup
    if (path === 'signup') {
      const { email, password } = body as { email?: string; password?: string }
      if (!email || !password) {
        return NextResponse.json({ error: 'email and password required' }, { status: 400 })
      }
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      const result = await signupWithPassword(resolved.db, ip, email, password)
      if (!result.ok) {
        const status = result.error === 'rate-limited' ? 429 : 409
        return NextResponse.json({ error: result.error }, { status })
      }

      await setSessionCookie(result.data.token, result.data.session.expiresAt, resolved)
      return NextResponse.json({ user: sanitizeUser(result.data.user) }, { status: 201 })
    }

    // POST /api/auth/login
    if (path === 'login') {
      const { email, password } = body as { email?: string; password?: string }
      if (!email || !password) {
        return NextResponse.json({ error: 'email and password required' }, { status: 400 })
      }
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      const result = await loginWithPassword(resolved.db, ip, email, password)
      if (!result.ok) {
        const status = result.error === 'rate-limited' ? 429 : 401
        return NextResponse.json({ error: result.error }, { status })
      }

      if (result.data.needsTotp) {
        const response = NextResponse.json({ requiresTotp: true })
        response.cookies.set('auth_pending_mfa', `pending:${result.data.user.id}`, {
          httpOnly: true, secure: resolved.secureCookies, sameSite: 'lax', maxAge: 300, path: '/',
        })
        return response
      }

      await setSessionCookie(result.data.token, result.data.session.expiresAt, resolved)
      return NextResponse.json({ user: sanitizeUser(result.data.user) })
    }

    // POST /api/auth/logout
    if (path === 'logout') {
      const token = await getSessionToken(resolved)
      if (token) await logout(resolved.db, hashSessionToken(token))
      await clearSessionCookie(resolved)
      return NextResponse.json({ ok: true })
    }

    // POST /api/auth/magic-link
    if (path === 'magic-link') {
      const { email } = body as { email?: string }
      if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      const result = await createMagicLink(resolved.db, email, ip)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.error === 'rate-limited' ? 429 : 400 })
      }
      const magicLinkUrl = `${resolved.basePath}/magic-link/verify?token=${result.data.token}`
      sendEmail(buildMagicLinkEmail({ email, magicLinkUrl }), resolved.email).catch(console.error)
      return NextResponse.json({ ok: true })
    }

    // POST /api/auth/totp/verify
    if (path === 'totp/verify') {
      const pendingCookie = req.cookies.get('auth_pending_mfa')?.value
      const { code } = body as { code?: string }
      if (!pendingCookie?.startsWith('pending:') || !code) {
        return NextResponse.json({ error: 'invalid request' }, { status: 400 })
      }
      const userId = pendingCookie.replace('pending:', '')
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      const result = await completeTotpLogin(resolved.db, resolved.secret, userId, code, ip)
      if (!result.ok) {
        const status = result.error === 'rate-limited' ? 429 : 401
        return NextResponse.json({ error: result.error }, { status })
      }

      const response = NextResponse.json({ user: sanitizeUser(result.data.user) })
      response.cookies.delete('auth_pending_mfa')
      response.cookies.set(resolved.cookieName, result.data.token, {
        httpOnly: true, secure: resolved.secureCookies, sameSite: 'lax',
        expires: result.data.session.expiresAt, path: '/',
      })
      return response
    }

    // POST /api/auth/totp/backup
    if (path === 'totp/backup') {
      const pendingCookie = req.cookies.get('auth_pending_mfa')?.value
      const { code } = body as { code?: string }
      if (!pendingCookie?.startsWith('pending:') || !code) {
        return NextResponse.json({ error: 'invalid request' }, { status: 400 })
      }
      const userId = pendingCookie.replace('pending:', '')
      const result = await verifyBackupCode(resolved.db, userId, code)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 })

      const response = NextResponse.json({ user: sanitizeUser(result.data.user) })
      response.cookies.delete('auth_pending_mfa')
      response.cookies.set(resolved.cookieName, result.data.token, {
        httpOnly: true, secure: resolved.secureCookies, sameSite: 'lax',
        expires: result.data.session.expiresAt, path: '/',
      })
      return response
    }

    // POST /api/auth/password-reset/request
    if (path === 'password-reset/request') {
      const { email } = body as { email?: string }
      if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
      const result = await createPasswordResetToken(resolved.db, email)
      if (result.ok && result.data.token) {
        const resetUrl = `${resolved.basePath}/password-reset/confirm?token=${result.data.token}`
        sendEmail(buildPasswordResetEmail({ email, resetUrl }), resolved.email).catch(console.error)
      }
      return NextResponse.json({ ok: true })
    }

    // POST /api/auth/password-reset/confirm
    if (path === 'password-reset/confirm') {
      const { token, password } = body as { token?: string; password?: string }
      if (!token || !password) {
        return NextResponse.json({ error: 'token and password required' }, { status: 400 })
      }
      const result = await confirmPasswordReset(resolved.db, token, password)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      await clearSessionCookie(resolved)
      return NextResponse.json({ ok: true })
    }

    // POST /api/auth/sessions/revoke — revoke a single session
    if (path === 'sessions/revoke') {
      const token = await getSessionToken(resolved)
      const sessionResult = await validateRequest(resolved.db, token)
      if (!sessionResult) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

      const { sessionId } = body as { sessionId?: string }
      if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

      await revokeSession(resolved.db, sessionId)
      return NextResponse.json({ ok: true })
    }

    // POST /api/auth/sessions/revoke-all — revoke all sessions except current
    if (path === 'sessions/revoke-all') {
      const token = await getSessionToken(resolved)
      const sessionResult = await validateRequest(resolved.db, token)
      if (!sessionResult) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

      await revokeAllSessions(resolved.db, sessionResult.user.id)
      await clearSessionCookie(resolved)
      return NextResponse.json({ ok: true })
    }

    // POST /api/auth/refresh — rotate JWT access token using refresh token cookie
    if (path === 'refresh') {
      const refreshToken = req.cookies.get('refresh_token')?.value
      if (!refreshToken) return NextResponse.json({ error: 'token-invalid' }, { status: 401 })
      const result = await refreshAccessToken(resolved.db, refreshToken, resolved.secret)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 })
      const response = NextResponse.json({ ok: true })
      response.cookies.set('access_token', result.data.accessToken, {
        httpOnly: true, secure: resolved.secureCookies, sameSite: 'lax',
        expires: result.data.expiresAt, path: '/',
      })
      return response
    }

    // POST /api/auth/refresh/revoke — invalidate the refresh token (called on logout)
    if (path === 'refresh/revoke') {
      const refreshToken = req.cookies.get('refresh_token')?.value
      if (refreshToken) await revokeRefreshToken(resolved.db, refreshToken)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return { GET, POST }
}

function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _pass, ...safe } = user
  return safe as Omit<User, 'passwordHash'>
}
