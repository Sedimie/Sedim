// Express types are type-only imports — express lives in the user's project.
import type { Request, Response, NextFunction, Router, RequestHandler } from 'express'
import { hashSessionToken } from '../core/generate-token.js'
import { createRefreshToken } from '../core/jwt.js'
import type { User } from './types.js'
import type { Session } from '../core/session.js'
import type { AuthConfig } from './framework-config.js'
import { resolveConfig } from './framework-config.js'
import {
  signupWithPassword, loginWithPassword, logout, validateRequest,
  createMagicLink, verifyMagicLink, createOAuthRedirect, handleOAuthCallback,
  completeTotpLogin, verifyBackupCode, createPasswordResetToken, confirmPasswordReset,
  listUserSessions, revokeSession, revokeAllSessions,
  refreshAccessToken, revokeRefreshToken,
} from './operations.js'
import { sendEmail, buildMagicLinkEmail, buildPasswordResetEmail } from '../core/email-transport.js'

// Auth data is attached to res.locals so it doesn't require module augmentation.
// Access in route handlers: res.locals['authUser'] and res.locals['authSession']
export interface AuthLocals {
  authUser?: User
  authSession?: Session
}

type RC = ReturnType<typeof resolveConfig>

function setSessionCookie(res: Response, token: string, expiresAt: Date, c: RC): void {
  res.cookie(c.cookieName, token, { httpOnly: true, secure: c.secureCookies, sameSite: 'lax', expires: expiresAt, path: '/' })
}

function clearSessionCookie(res: Response, c: RC): void {
  res.clearCookie(c.cookieName, { path: '/' })
}

function getToken(req: Request, c: RC): string | null {
  return (req.cookies as Record<string, string> | undefined)?.[c.cookieName] ?? null
}

function getCookies(req: Request): Record<string, string> {
  return (req.cookies as Record<string, string> | undefined) ?? {}
}

function generateCsrfToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
}

function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash: _, ...safe } = user
  return safe
}

/**
 * Reads and validates the session on every request.
 * Attaches req.user and req.session if valid. Does not reject unauthenticated requests.
 */
export function createSessionMiddleware(config: AuthConfig): RequestHandler {
  const rc = resolveConfig(config)
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = getToken(req, rc)
    const result = await validateRequest(rc.db, token)
    if (result) {
      res.locals['authUser'] = result.user
      res.locals['authSession'] = result.session
      if (result.session.expiresAt > new Date(Date.now() + 1000 * 60 * 60 * 24 * 15)) {
        setSessionCookie(res, token!, result.session.expiresAt, rc)
      }
    }
    next()
  }
}

/** Rejects unauthenticated requests with 401. Mount after createSessionMiddleware. */
export function requireAuth(_req: Request, res: Response, next: NextFunction): void {
  if (!res.locals['authUser']) { res.status(401).json({ error: 'Unauthorized' }); return }
  next()
}

/**
 * Creates an Express Router with all auth routes.
 *
 * Usage:
 *   app.use('/auth', createExpressAuthRouter({ db, secret, providers: [...] }))
 */
export function createExpressAuthRouter(config: AuthConfig): Router {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Router } = require('express') as typeof import('express')
  const router: Router = Router()
  const rc = resolveConfig(config)

  // CSRF guard — validates on all mutating requests
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const cookieToken = (req.cookies as Record<string, string>)['csrf_token']
      const headerToken = (req.headers['x-csrf-token'] as string) ?? ''
      if (!cookieToken || cookieToken !== headerToken) {
        res.status(403).json({ error: 'csrf-invalid' }); return
      }
    }
    next()
  })

  // GET /csrf-token — returns CSRF token, sets httpOnly cookie
  router.get('/csrf-token', (_req: Request, res: Response) => {
    const token = generateCsrfToken()
    res.cookie('csrf_token', token, { httpOnly: true, secure: rc.secureCookies, sameSite: 'strict', maxAge: 86400, path: '/' })
    res.setHeader('X-CSRF-Token', token)
    res.status(200).json({ token })
  })

  router.post('/signup', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return }
    const ip = (req.headers['x-forwarded-for'] as string ?? 'unknown').split(',')[0]?.trim() ?? 'unknown'
    const r = await signupWithPassword(rc.db, ip, email, password)
    if (!r.ok) { res.status(r.error === 'rate-limited' ? 429 : 409).json({ error: r.error }); return }
    setSessionCookie(res, r.data.token, r.data.session.expiresAt, rc)
    res.status(201).json({ user: sanitizeUser(r.data.user) })
  })

  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return }
    const ip = (req.headers['x-forwarded-for'] as string ?? 'unknown').split(',')[0]?.trim() ?? 'unknown'
    const r = await loginWithPassword(rc.db, ip, email, password)
    if (!r.ok) { res.status(r.error === 'rate-limited' ? 429 : 401).json({ error: r.error }); return }
    if (r.data.needsTotp) {
      res.cookie('auth_pending_mfa', `pending:${r.data.user.id}`, { httpOnly: true, secure: rc.secureCookies, sameSite: 'lax', maxAge: 300000, path: '/' })
      res.status(200).json({ requiresTotp: true })
      return
    }
    setSessionCookie(res, r.data.token, r.data.session.expiresAt, rc)
    res.status(200).json({ user: sanitizeUser(r.data.user) })
  })

  router.post('/logout', async (req: Request, res: Response) => {
    const token = getToken(req, rc)
    if (token) await logout(rc.db, hashSessionToken(token))
    clearSessionCookie(res, rc)
    res.status(200).json({ ok: true })
  })

  router.get('/session', async (req: Request, res: Response) => {
    const r = await validateRequest(rc.db, getToken(req, rc))
    if (!r) { res.status(401).json({ user: null }); return }
    res.status(200).json({ user: sanitizeUser(r.user) })
  })

  router.get('/sessions', async (req: Request, res: Response) => {
    const r = await validateRequest(rc.db, getToken(req, rc))
    if (!r) { res.status(401).json({ error: 'unauthorized' }); return }
    const sessions = await listUserSessions(rc.db, r.user.id)
    res.status(200).json({ sessions })
  })

  router.post('/sessions/revoke', async (req: Request, res: Response) => {
    const r = await validateRequest(rc.db, getToken(req, rc))
    if (!r) { res.status(401).json({ error: 'unauthorized' }); return }
    const { sessionId } = req.body as { sessionId?: string }
    if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return }
    await revokeSession(rc.db, sessionId)
    res.status(200).json({ ok: true })
  })

  router.post('/sessions/revoke-all', async (req: Request, res: Response) => {
    const r = await validateRequest(rc.db, getToken(req, rc))
    if (!r) { res.status(401).json({ error: 'unauthorized' }); return }
    await revokeAllSessions(rc.db, r.user.id)
    clearSessionCookie(res, rc)
    res.status(200).json({ ok: true })
  })

  router.post('/magic-link', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string }
    if (!email) { res.status(400).json({ error: 'email required' }); return }
    const ip = (req.headers['x-forwarded-for'] as string ?? 'unknown').split(',')[0]?.trim() ?? 'unknown'
    const r = await createMagicLink(rc.db, email, ip)
    if (!r.ok) { res.status(r.error === 'rate-limited' ? 429 : 400).json({ error: r.error }); return }
    const magicLinkUrl = `${rc.basePath}/magic-link/verify?token=${r.data.token}`
    sendEmail(buildMagicLinkEmail({ email, magicLinkUrl }), rc.email).catch(console.error)
    res.status(200).json({ ok: true })
  })

  router.get('/magic-link/verify', async (req: Request, res: Response) => {
    const token = (req.query as Record<string, string>)['token']
    if (!token) { res.status(400).json({ error: 'token required' }); return }
    const r = await verifyMagicLink(rc.db, token)
    if (!r.ok) { res.status(400).json({ error: r.error }); return }
    setSessionCookie(res, r.data.token, r.data.session.expiresAt, rc)
    res.status(200).json({ user: sanitizeUser(r.data.user) })
  })

  router.get('/oauth/:provider', (req: Request, res: Response) => {
    const provider = (req.params as Record<string, string>)['provider']!
    const r = createOAuthRedirect(rc, provider)
    if (!r.ok) { res.status(400).json({ error: r.error }); return }
    res.cookie('oauth_code_verifier', r.data.codeVerifier, { httpOnly: true, secure: rc.secureCookies, sameSite: 'lax', maxAge: 600000, path: '/' })
    res.cookie('oauth_state', r.data.state, { httpOnly: true, secure: rc.secureCookies, sameSite: 'lax', maxAge: 600000, path: '/' })
    res.redirect(r.data.url.toString())
  })

  router.get('/oauth/:provider/callback', async (req: Request, res: Response) => {
    const provider = (req.params as Record<string, string>)['provider']!
    const q = req.query as Record<string, string>
    const c = getCookies(req)
    if (!q['code'] || !q['state'] || q['state'] !== c['oauth_state'] || !c['oauth_code_verifier']) {
      res.status(400).json({ error: 'oauth-state-mismatch' }); return
    }
    res.clearCookie('oauth_state', { path: '/' })
    res.clearCookie('oauth_code_verifier', { path: '/' })
    const r = await handleOAuthCallback(rc.db, rc, provider, q['code']!, c['oauth_code_verifier']!)
    if (!r.ok) { res.status(400).json({ error: r.error }); return }
    setSessionCookie(res, r.data.token, r.data.session.expiresAt, rc)
    res.redirect('/')
  })

  router.post('/totp/verify', async (req: Request, res: Response) => {
    const pending = getCookies(req)['auth_pending_mfa']
    const { code } = req.body as { code?: string }
    if (!pending?.startsWith('pending:') || !code) { res.status(400).json({ error: 'invalid request' }); return }
    const userId = pending.replace('pending:', '')
    const ip = (req.headers['x-forwarded-for'] as string ?? 'unknown').split(',')[0]?.trim() ?? 'unknown'
    const r = await completeTotpLogin(rc.db, rc.secret, userId, code, ip)
    if (!r.ok) { res.status(r.error === 'rate-limited' ? 429 : 401).json({ error: r.error }); return }
    res.clearCookie('auth_pending_mfa', { path: '/' })
    setSessionCookie(res, r.data.token, r.data.session.expiresAt, rc)
    res.status(200).json({ user: sanitizeUser(r.data.user) })
  })

  router.post('/totp/backup', async (req: Request, res: Response) => {
    const pending = getCookies(req)['auth_pending_mfa']
    const { code } = req.body as { code?: string }
    if (!pending?.startsWith('pending:') || !code) { res.status(400).json({ error: 'invalid request' }); return }
    const r = await verifyBackupCode(rc.db, pending.replace('pending:', ''), code)
    if (!r.ok) { res.status(401).json({ error: r.error }); return }
    res.clearCookie('auth_pending_mfa', { path: '/' })
    setSessionCookie(res, r.data.token, r.data.session.expiresAt, rc)
    res.status(200).json({ user: sanitizeUser(r.data.user) })
  })

  router.post('/password-reset/request', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string }
    if (!email) { res.status(400).json({ error: 'email required' }); return }
    const r = await createPasswordResetToken(rc.db, email)
    if (r.ok && r.data.token) {
      const resetUrl = `${rc.basePath}/password-reset/confirm?token=${r.data.token}`
      sendEmail(buildPasswordResetEmail({ email, resetUrl }), rc.email).catch(console.error)
    }
    res.status(200).json({ ok: true })
  })

  router.post('/password-reset/confirm', async (req: Request, res: Response) => {
    const { token, password } = req.body as { token?: string; password?: string }
    if (!token || !password) { res.status(400).json({ error: 'token and password required' }); return }
    const r = await confirmPasswordReset(rc.db, token, password)
    if (!r.ok) { res.status(400).json({ error: r.error }); return }
    clearSessionCookie(res, rc)
    res.status(200).json({ ok: true })
  })

  router.post('/refresh', async (req: Request, res: Response) => {
    const refreshToken = (req.cookies as Record<string, string>)['refresh_token']
    if (!refreshToken) { res.status(401).json({ error: 'token-invalid' }); return }
    const r = await refreshAccessToken(rc.db, refreshToken, rc.secret)
    if (!r.ok) { res.status(401).json({ error: r.error }); return }
    res.cookie('access_token', r.data.accessToken, { httpOnly: true, secure: rc.secureCookies, sameSite: 'lax', expires: r.data.expiresAt, path: '/' })
    res.status(200).json({ ok: true })
  })

  router.post('/refresh/revoke', async (req: Request, res: Response) => {
    const refreshToken = (req.cookies as Record<string, string>)['refresh_token']
    if (refreshToken) await revokeRefreshToken(rc.db, refreshToken)
    res.status(200).json({ ok: true })
  })

  return router
}
