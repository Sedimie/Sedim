// Express types are type-only imports — express lives in the user's project.
import type { Request, Response, NextFunction, Router, RequestHandler } from 'express'
import { hashSessionToken } from '../../core/generate-token.js'
import type { User } from '../types.js'
import type { Session } from '../../core/session.js'
import type { AuthConfig } from './config.js'
import { resolveConfig } from './config.js'
import {
  signupWithPassword, loginWithPassword, logout, validateRequest,
  createMagicLink, verifyMagicLink, createOAuthRedirect, handleOAuthCallback,
  completeTotpLogin, verifyBackupCode, createPasswordResetToken, confirmPasswordReset,
} from './operations.js'

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

  router.post('/signup', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return }
    const r = await signupWithPassword(rc.db, email, password)
    if (!r.ok) { res.status(409).json({ error: r.error }); return }
    setSessionCookie(res, r.data.token, r.data.session.expiresAt, rc)
    res.status(201).json({ user: sanitizeUser(r.data.user) })
  })

  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return }
    const r = await loginWithPassword(rc.db, email, password)
    if (!r.ok) { res.status(401).json({ error: r.error }); return }
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

  router.post('/magic-link', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string }
    if (!email) { res.status(400).json({ error: 'email required' }); return }
    const r = await createMagicLink(rc.db, email)
    if (!r.ok) { res.status(400).json({ error: r.error }); return }
    res.status(200).json({ ok: true, token: r.data.token })
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
    const r = await completeTotpLogin(rc.db, pending.replace('pending:', ''), code)
    if (!r.ok) { res.status(401).json({ error: r.error }); return }
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
    await createPasswordResetToken(rc.db, email)
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

  return router
}
