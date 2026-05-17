import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
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

// Hono context variable types
type AuthVariables = {
  user: User | undefined
  session: Session | undefined
}

// ── Cookie helpers ────────────────────────────────────────────

function setSessionCookie(
  c: Context,
  token: string,
  expiresAt: Date,
  config: ReturnType<typeof resolveConfig>,
): void {
  setCookie(c, config.cookieName, token, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'Lax',
    expires: expiresAt,
    path: '/',
  })
}

// ── Session middleware ────────────────────────────────────────

/**
 * Reads and validates the session on every request.
 * Sets c.var.user and c.var.session if valid.
 *
 * Usage:
 *   app.use('*', createHonoSessionMiddleware(authConfig))
 */
export function createHonoSessionMiddleware(config: AuthConfig): MiddlewareHandler<{ Variables: AuthVariables }> {
  const resolved = resolveConfig(config)
  return async (c, next) => {
    const token = getCookie(c, resolved.cookieName) ?? null
    const result = await validateRequest(resolved.db, token)
    if (result) {
      c.set('user', result.user)
      c.set('session', result.session)
    }
    await next()
  }
}

/**
 * Middleware that rejects unauthenticated requests with 401.
 */
export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  if (!c.var.user) return c.json({ error: 'Unauthorized' }, 401)
  await next()
}

// ── Route factory ─────────────────────────────────────────────

/**
 * Creates a Hono app with all auth routes.
 * Mount it on your main app at the auth base path.
 *
 * Usage:
 *   import { Hono } from 'hono'
 *   import { createHonoAuthRoutes } from './auth/adapters/framework/hono'
 *   const app = new Hono()
 *   app.route('/auth', createHonoAuthRoutes({ db, secret, providers: [...] }))
 */
export function createHonoAuthRoutes(config: AuthConfig) {
  const { Hono } = require('hono') as typeof import('hono')
  const app = new Hono<{ Variables: AuthVariables }>()
  const resolved = resolveConfig(config)

  // POST /signup
  app.post('/signup', async (c) => {
    const { email, password } = await c.req.json<{ email?: string; password?: string }>()
    if (!email || !password) return c.json({ error: 'email and password required' }, 400)

    const result = await signupWithPassword(resolved.db, email, password)
    if (!result.ok) return c.json({ error: result.error }, 409)

    setSessionCookie(c, result.data.token, result.data.session.expiresAt, resolved)
    return c.json({ user: sanitizeUser(result.data.user) }, 201)
  })

  // POST /login
  app.post('/login', async (c) => {
    const { email, password } = await c.req.json<{ email?: string; password?: string }>()
    if (!email || !password) return c.json({ error: 'email and password required' }, 400)

    const result = await loginWithPassword(resolved.db, email, password)
    if (!result.ok) return c.json({ error: result.error }, 401)

    if (result.data.needsTotp) {
      setCookie(c, 'auth_pending_mfa', `pending:${result.data.user.id}`, {
        httpOnly: true, secure: resolved.secureCookies, sameSite: 'Lax', maxAge: 300, path: '/',
      })
      return c.json({ requiresTotp: true })
    }

    setSessionCookie(c, result.data.token, result.data.session.expiresAt, resolved)
    return c.json({ user: sanitizeUser(result.data.user) })
  })

  // POST /logout
  app.post('/logout', async (c) => {
    const token = getCookie(c, resolved.cookieName) ?? null
    if (token) await logout(resolved.db, hashSessionToken(token))
    deleteCookie(c, resolved.cookieName, { path: '/' })
    return c.json({ ok: true })
  })

  // GET /session
  app.get('/session', async (c) => {
    const token = getCookie(c, resolved.cookieName) ?? null
    const result = await validateRequest(resolved.db, token)
    if (!result) return c.json({ user: null }, 401)
    return c.json({ user: sanitizeUser(result.user) })
  })

  // POST /magic-link
  app.post('/magic-link', async (c) => {
    const { email } = await c.req.json<{ email?: string }>()
    if (!email) return c.json({ error: 'email required' }, 400)
    const result = await createMagicLink(resolved.db, email)
    if (!result.ok) return c.json({ error: result.error }, 400)
    return c.json({ ok: true, token: result.data.token })
  })

  // GET /magic-link/verify?token=...
  app.get('/magic-link/verify', async (c) => {
    const token = c.req.query('token')
    if (!token) return c.json({ error: 'token required' }, 400)
    const result = await verifyMagicLink(resolved.db, token)
    if (!result.ok) return c.json({ error: result.error }, 400)
    setSessionCookie(c, result.data.token, result.data.session.expiresAt, resolved)
    return c.redirect('/')
  })

  // GET /oauth/:provider
  app.get('/oauth/:provider', (c) => {
    const provider = c.req.param('provider')
    const result = createOAuthRedirect(resolved, provider)
    if (!result.ok) return c.json({ error: result.error }, 400)

    setCookie(c, 'oauth_code_verifier', result.data.codeVerifier, {
      httpOnly: true, secure: resolved.secureCookies, sameSite: 'Lax', maxAge: 600, path: '/',
    })
    setCookie(c, 'oauth_state', result.data.state, {
      httpOnly: true, secure: resolved.secureCookies, sameSite: 'Lax', maxAge: 600, path: '/',
    })
    return c.redirect(result.data.url.toString())
  })

  // GET /oauth/:provider/callback
  app.get('/oauth/:provider/callback', async (c) => {
    const provider = c.req.param('provider')
    const code = c.req.query('code')
    const state = c.req.query('state')
    const storedState = getCookie(c, 'oauth_state')
    const codeVerifier = getCookie(c, 'oauth_code_verifier')

    if (!code || !state || state !== storedState || !codeVerifier) {
      return c.json({ error: 'oauth-state-mismatch' }, 400)
    }

    deleteCookie(c, 'oauth_state', { path: '/' })
    deleteCookie(c, 'oauth_code_verifier', { path: '/' })

    const result = await handleOAuthCallback(resolved.db, resolved, provider, code, codeVerifier)
    if (!result.ok) return c.json({ error: result.error }, 400)

    setSessionCookie(c, result.data.token, result.data.session.expiresAt, resolved)
    return c.redirect('/')
  })

  // POST /totp/verify
  app.post('/totp/verify', async (c) => {
    const pendingCookie = getCookie(c, 'auth_pending_mfa')
    const { code } = await c.req.json<{ code?: string }>()
    if (!pendingCookie?.startsWith('pending:') || !code) return c.json({ error: 'invalid request' }, 400)

    const userId = pendingCookie.replace('pending:', '')
    const result = await completeTotpLogin(resolved.db, userId, code)
    if (!result.ok) return c.json({ error: result.error }, 401)

    deleteCookie(c, 'auth_pending_mfa', { path: '/' })
    setSessionCookie(c, result.data.token, result.data.session.expiresAt, resolved)
    return c.json({ user: sanitizeUser(result.data.user) })
  })

  // POST /totp/backup
  app.post('/totp/backup', async (c) => {
    const pendingCookie = getCookie(c, 'auth_pending_mfa')
    const { code } = await c.req.json<{ code?: string }>()
    if (!pendingCookie?.startsWith('pending:') || !code) return c.json({ error: 'invalid request' }, 400)

    const userId = pendingCookie.replace('pending:', '')
    const result = await verifyBackupCode(resolved.db, userId, code)
    if (!result.ok) return c.json({ error: result.error }, 401)

    deleteCookie(c, 'auth_pending_mfa', { path: '/' })
    setSessionCookie(c, result.data.token, result.data.session.expiresAt, resolved)
    return c.json({ user: sanitizeUser(result.data.user) })
  })

  // POST /password-reset/request
  app.post('/password-reset/request', async (c) => {
    const { email } = await c.req.json<{ email?: string }>()
    if (!email) return c.json({ error: 'email required' }, 400)
    await createPasswordResetToken(resolved.db, email)
    return c.json({ ok: true })
  })

  // POST /password-reset/confirm
  app.post('/password-reset/confirm', async (c) => {
    const { token, password } = await c.req.json<{ token?: string; password?: string }>()
    if (!token || !password) return c.json({ error: 'token and password required' }, 400)
    const result = await confirmPasswordReset(resolved.db, token, password)
    if (!result.ok) return c.json({ error: result.error }, 400)
    deleteCookie(c, resolved.cookieName, { path: '/' })
    return c.json({ ok: true })
  })

  return app
}

function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash: _, ...safe } = user
  return safe
}
