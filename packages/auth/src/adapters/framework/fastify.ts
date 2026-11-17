// Fastify types are type-only imports — fastify lives in the user's project.
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { hashSessionToken } from '../../core/generate-token.js'
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

export interface AuthRequestData {
  authUser?: User
  authSession?: Session
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: User
    authSession?: Session
  }
}

type RC = ReturnType<typeof resolveConfig>

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, c: RC): void {
  if (typeof (reply as any).setCookie === 'function') {
    ;(reply as any).setCookie(c.cookieName, token, {
      httpOnly: true,
      secure: c.secureCookies,
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })
  } else {
    reply.header(
      'Set-Cookie',
      `${c.cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${c.secureCookies ? '; Secure' : ''}`,
    )
  }
}

function clearSessionCookie(reply: FastifyReply, c: RC): void {
  if (typeof (reply as any).clearCookie === 'function') {
    ;(reply as any).clearCookie(c.cookieName, { path: '/' })
  } else {
    reply.header(
      'Set-Cookie',
      `${c.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`,
    )
  }
}

function getCookies(req: FastifyRequest): Record<string, string> {
  if (req.cookies && typeof req.cookies === 'object') {
    return req.cookies as Record<string, string>
  }
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return {}
  const cookies: Record<string, string> = {}
  for (const pair of cookieHeader.split(';')) {
    const [k, v] = pair.trim().split('=')
    if (k && v !== undefined) {
      cookies[k] = decodeURIComponent(v)
    }
  }
  return cookies
}

function getToken(req: FastifyRequest, c: RC): string | null {
  const cookies = getCookies(req)
  return cookies[c.cookieName] ?? null
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
 * Attaches request.authUser and request.authSession if valid.
 */
export function createFastifySessionHook(config: AuthConfig) {
  const rc = resolveConfig(config)
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = getToken(request, rc)
    const result = await validateRequest(rc.db, token)
    if (result) {
      request.authUser = result.user
      request.authSession = result.session
      if (result.session.expiresAt > new Date(Date.now() + 1000 * 60 * 60 * 24 * 15)) {
        setSessionCookie(reply, token!, result.session.expiresAt, rc)
      }
    }
  }
}

/**
 * Rejects unauthenticated requests with 401. Mount as a preHandler hook.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.authUser) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

export const fastifyRequireAuth = requireAuth

/**
 * Reads the current session for a Fastify request.
 */
export async function getSession(
  req: FastifyRequest,
  config: AuthConfig,
): Promise<{ user: User; session: Session } | null> {
  const rc = resolveConfig(config)
  const token = getToken(req, rc)
  const result = await validateRequest(rc.db, token)
  if (!result) return null
  return { user: result.user, session: result.session }
}

/**
 * Creates a Fastify plugin that registers all auth routes.
 *
 * Usage:
 *   import fastify from 'fastify'
 *   import { createFastifyAuthPlugin } from './sedim/auth/adapters/framework/fastify.js'
 *   import { authConfig } from './sedim/auth/config.js'
 *
 *   const app = fastify()
 *   app.register(createFastifyAuthPlugin(authConfig), { prefix: '/auth' })
 */
export function createFastifyAuthPlugin(config: AuthConfig): FastifyPluginAsync {
  const rc = resolveConfig(config)

  return async (fastify: FastifyInstance) => {
    // CSRF guard — validates on all mutating requests
    fastify.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        const cookies = getCookies(request)
        const cookieToken = cookies['csrf_token']
        const headerToken = (request.headers['x-csrf-token'] as string) ?? ''
        if (!cookieToken || cookieToken !== headerToken) {
          reply.status(403).send({ error: 'csrf-invalid' })
          return reply
        }
      }
    })

    // GET /csrf-token
    fastify.get('/csrf-token', async (_req: FastifyRequest, reply: FastifyReply) => {
      const token = generateCsrfToken()
      if (typeof (reply as any).setCookie === 'function') {
        ;(reply as any).setCookie('csrf_token', token, {
          httpOnly: true,
          secure: rc.secureCookies,
          sameSite: 'strict',
          maxAge: 86400,
          path: '/',
        })
      } else {
        reply.header(
          'Set-Cookie',
          `csrf_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${rc.secureCookies ? '; Secure' : ''}`,
        )
      }
      reply.header('X-CSRF-Token', token)
      return reply.status(200).send({ token })
    })

    // POST /signup
    fastify.post('/signup', async (req: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = (req.body ?? {}) as { email?: string; password?: string }
      if (!email || !password) {
        return reply.status(400).send({ error: 'email and password required' })
      }
      const forwarded = req.headers['x-forwarded-for']
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null) ?? req.ip ?? 'unknown'
      const r = await signupWithPassword(rc.db, email, ip, password)
      if (!r.ok) {
        return reply.status(r.error === 'rate-limited' ? 429 : 409).send({ error: r.error })
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return reply.status(201).send({ user: sanitizeUser(r.data.user) })
    })

    // POST /login
    fastify.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = (req.body ?? {}) as { email?: string; password?: string }
      if (!email || !password) {
        return reply.status(400).send({ error: 'email and password required' })
      }
      const forwarded = req.headers['x-forwarded-for']
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null) ?? req.ip ?? 'unknown'
      const r = await loginWithPassword(rc.db, ip, email, password)
      if (!r.ok) {
        return reply.status(r.error === 'rate-limited' ? 429 : 401).send({ error: r.error })
      }
      if (r.data.needsTotp) {
        if (typeof (reply as any).setCookie === 'function') {
          ;(reply as any).setCookie('auth_pending_mfa', `pending:${r.data.user.id}`, {
            httpOnly: true,
            secure: rc.secureCookies,
            sameSite: 'lax',
            maxAge: 300,
            path: '/',
          })
        } else {
          reply.header(
            'Set-Cookie',
            `auth_pending_mfa=pending:${r.data.user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300${rc.secureCookies ? '; Secure' : ''}`,
          )
        }
        return reply.status(200).send({ requiresTotp: true })
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return reply.status(200).send({ user: sanitizeUser(r.data.user) })
    })

    // POST /logout
    fastify.post('/logout', async (req: FastifyRequest, reply: FastifyReply) => {
      const token = getToken(req, rc)
      if (token) await logout(rc.db, hashSessionToken(token))
      clearSessionCookie(reply, rc)
      return reply.status(200).send({ ok: true })
    })

    // GET /session
    fastify.get('/session', async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await validateRequest(rc.db, getToken(req, rc))
      if (!r) {
        return reply.status(401).send({ user: null })
      }
      return reply.status(200).send({ user: sanitizeUser(r.user) })
    })

    // GET /sessions
    fastify.get('/sessions', async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await validateRequest(rc.db, getToken(req, rc))
      if (!r) {
        return reply.status(401).send({ error: 'unauthorized' })
      }
      const sessions = await listUserSessions(rc.db, r.user.id)
      return reply.status(200).send({ sessions })
    })

    // POST /sessions/revoke
    fastify.post('/sessions/revoke', async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await validateRequest(rc.db, getToken(req, rc))
      if (!r) {
        return reply.status(401).send({ error: 'unauthorized' })
      }
      const { sessionId } = (req.body ?? {}) as { sessionId?: string }
      if (!sessionId) {
        return reply.status(400).send({ error: 'sessionId required' })
      }
      await revokeSession(rc.db, sessionId)
      return reply.status(200).send({ ok: true })
    })

    // POST /sessions/revoke-all
    fastify.post('/sessions/revoke-all', async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await validateRequest(rc.db, getToken(req, rc))
      if (!r) {
        return reply.status(401).send({ error: 'unauthorized' })
      }
      await revokeAllSessions(rc.db, r.user.id)
      clearSessionCookie(reply, rc)
      return reply.status(200).send({ ok: true })
    })

    // POST /magic-link
    fastify.post('/magic-link', async (req: FastifyRequest, reply: FastifyReply) => {
      const { email } = (req.body ?? {}) as { email?: string }
      if (!email) {
        return reply.status(400).send({ error: 'email required' })
      }
      const forwarded = req.headers['x-forwarded-for']
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null) ?? req.ip ?? 'unknown'
      const r = await createMagicLink(rc.db, email, ip)
      if (!r.ok) {
        return reply.status(r.error === 'rate-limited' ? 429 : 400).send({ error: r.error })
      }
      const magicLinkUrl = `${rc.basePath}/magic-link/verify?token=${r.data.token}`
      sendEmail(buildMagicLinkEmail({ email, magicLinkUrl }), rc.email).catch(console.error)
      return reply.status(200).send({ ok: true })
    })

    // GET /magic-link/verify
    fastify.get('/magic-link/verify', async (req: FastifyRequest, reply: FastifyReply) => {
      const token = (req.query as Record<string, string>)?.['token']
      if (!token) {
        return reply.status(400).send({ error: 'token required' })
      }
      const r = await verifyMagicLink(rc.db, token)
      if (!r.ok) {
        return reply.status(400).send({ error: r.error })
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return reply.status(200).send({ user: sanitizeUser(r.data.user) })
    })

    // GET /oauth/:provider
    fastify.get('/oauth/:provider', async (req: FastifyRequest, reply: FastifyReply) => {
      const provider = (req.params as Record<string, string>)?.['provider']!
      const r = createOAuthRedirect(rc, provider)
      if (!r.ok) {
        return reply.status(400).send({ error: r.error })
      }
      if (typeof (reply as any).setCookie === 'function') {
        ;(reply as any).setCookie('oauth_code_verifier', r.data.codeVerifier, {
          httpOnly: true,
          secure: rc.secureCookies,
          sameSite: 'lax',
          maxAge: 600,
          path: '/',
        })
        ;(reply as any).setCookie('oauth_state', r.data.state, {
          httpOnly: true,
          secure: rc.secureCookies,
          sameSite: 'lax',
          maxAge: 600,
          path: '/',
        })
      } else {
        reply.header(
          'Set-Cookie',
          `oauth_code_verifier=${r.data.codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${rc.secureCookies ? '; Secure' : ''}`,
        )
      }
      return reply.redirect(r.data.url.toString())
    })

    // GET /oauth/:provider/callback
    fastify.get('/oauth/:provider/callback', async (req: FastifyRequest, reply: FastifyReply) => {
      const provider = (req.params as Record<string, string>)?.['provider']!
      const q = (req.query as Record<string, string>) ?? {}
      const c = getCookies(req)
      if (!q['code'] || !q['state'] || q['state'] !== c['oauth_state'] || !c['oauth_code_verifier']) {
        return reply.status(400).send({ error: 'oauth-state-mismatch' })
      }
      if (typeof (reply as any).clearCookie === 'function') {
        ;(reply as any).clearCookie('oauth_state', { path: '/' })
        ;(reply as any).clearCookie('oauth_code_verifier', { path: '/' })
      }
      const r = await handleOAuthCallback(rc.db, rc, provider, q['code']!, c['oauth_code_verifier']!)
      if (!r.ok) {
        return reply.status(400).send({ error: r.error })
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return reply.redirect('/')
    })

    // POST /totp/verify
    fastify.post('/totp/verify', async (req: FastifyRequest, reply: FastifyReply) => {
      const pending = getCookies(req)['auth_pending_mfa']
      const { code } = (req.body ?? {}) as { code?: string }
      if (!pending?.startsWith('pending:') || !code) {
        return reply.status(400).send({ error: 'invalid request' })
      }
      const userId = pending.replace('pending:', '')
      const forwarded = req.headers['x-forwarded-for']
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null) ?? req.ip ?? 'unknown'
      const r = await completeTotpLogin(rc.db, rc.secret, userId, code, ip)
      if (!r.ok) {
        return reply.status(r.error === 'rate-limited' ? 429 : 401).send({ error: r.error })
      }
      if (typeof (reply as any).clearCookie === 'function') {
        ;(reply as any).clearCookie('auth_pending_mfa', { path: '/' })
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return reply.status(200).send({ user: sanitizeUser(r.data.user) })
    })

    // POST /totp/backup
    fastify.post('/totp/backup', async (req: FastifyRequest, reply: FastifyReply) => {
      const pending = getCookies(req)['auth_pending_mfa']
      const { code } = (req.body ?? {}) as { code?: string }
      if (!pending?.startsWith('pending:') || !code) {
        return reply.status(400).send({ error: 'invalid request' })
      }
      const r = await verifyBackupCode(rc.db, pending.replace('pending:', ''), code)
      if (!r.ok) {
        return reply.status(401).send({ error: r.error })
      }
      if (typeof (reply as any).clearCookie === 'function') {
        ;(reply as any).clearCookie('auth_pending_mfa', { path: '/' })
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return reply.status(200).send({ user: sanitizeUser(r.data.user) })
    })

    // POST /password-reset/request
    fastify.post('/password-reset/request', async (req: FastifyRequest, reply: FastifyReply) => {
      const { email } = (req.body ?? {}) as { email?: string }
      if (!email) {
        return reply.status(400).send({ error: 'email required' })
      }
      const r = await createPasswordResetToken(rc.db, email)
      if (r.ok && r.data.token) {
        const resetUrl = `${rc.basePath}/password-reset/confirm?token=${r.data.token}`
        sendEmail(buildPasswordResetEmail({ email, resetUrl }), rc.email).catch(console.error)
      }
      return reply.status(200).send({ ok: true })
    })

    // POST /password-reset/confirm
    fastify.post('/password-reset/confirm', async (req: FastifyRequest, reply: FastifyReply) => {
      const { token, password } = (req.body ?? {}) as { token?: string; password?: string }
      if (!token || !password) {
        return reply.status(400).send({ error: 'token and password required' })
      }
      const r = await confirmPasswordReset(rc.db, token, password)
      if (!r.ok) {
        return reply.status(400).send({ error: r.error })
      }
      clearSessionCookie(reply, rc)
      return reply.status(200).send({ ok: true })
    })

    // POST /refresh
    fastify.post('/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = getCookies(req)['refresh_token']
      if (!refreshToken) {
        return reply.status(401).send({ error: 'token-invalid' })
      }
      const r = await refreshAccessToken(rc.db, refreshToken, rc.secret)
      if (!r.ok) {
        return reply.status(401).send({ error: r.error })
      }
      if (typeof (reply as any).setCookie === 'function') {
        ;(reply as any).setCookie('access_token', r.data.accessToken, {
          httpOnly: true,
          secure: rc.secureCookies,
          sameSite: 'lax',
          expires: r.data.expiresAt,
          path: '/',
        })
      } else {
        reply.header(
          'Set-Cookie',
          `access_token=${r.data.accessToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${r.data.expiresAt.toUTCString()}${rc.secureCookies ? '; Secure' : ''}`,
        )
      }
      return reply.status(200).send({ ok: true })
    })

    // POST /refresh/revoke
    fastify.post('/refresh/revoke', async (req: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = getCookies(req)['refresh_token']
      if (refreshToken) await revokeRefreshToken(rc.db, refreshToken)
      return reply.status(200).send({ ok: true })
    })
  }
}

export const createFastifyAuthRoutes = createFastifyAuthPlugin
