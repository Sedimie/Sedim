import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hashSessionToken } from '../../core/generate-token.js'
import type { User } from '../types.js'
import type { Session } from '../../core/session.js'
import type { AuthConfig } from './config.js'
import { resolveConfig } from './config.js'
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
} from './operations.js'

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

    // POST /api/auth/signup
    if (path === 'signup') {
      const { email, password } = body as { email?: string; password?: string }
      if (!email || !password) {
        return NextResponse.json({ error: 'email and password required' }, { status: 400 })
      }
      const result = await signupWithPassword(resolved.db, email, password)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })

      await setSessionCookie(result.data.token, result.data.session.expiresAt, resolved)
      return NextResponse.json({ user: sanitizeUser(result.data.user) }, { status: 201 })
    }

    // POST /api/auth/login
    if (path === 'login') {
      const { email, password } = body as { email?: string; password?: string }
      if (!email || !password) {
        return NextResponse.json({ error: 'email and password required' }, { status: 400 })
      }
      const result = await loginWithPassword(resolved.db, email, password)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 })

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
      const result = await createMagicLink(resolved.db, email)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      // return token so caller can send email — don't expose in production response
      return NextResponse.json({ ok: true, token: result.data.token })
    }

    // POST /api/auth/totp/verify
    if (path === 'totp/verify') {
      const pendingCookie = req.cookies.get('auth_pending_mfa')?.value
      const { code } = body as { code?: string }
      if (!pendingCookie?.startsWith('pending:') || !code) {
        return NextResponse.json({ error: 'invalid request' }, { status: 400 })
      }
      const userId = pendingCookie.replace('pending:', '')
      const result = await completeTotpLogin(resolved.db, userId, code)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 })

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
      await createPasswordResetToken(resolved.db, email)
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

    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return { GET, POST }
}

function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash: _, ...safe } = user
  return safe
}
