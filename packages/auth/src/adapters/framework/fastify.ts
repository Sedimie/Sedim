// Fastify types are type-only imports — fastify lives in the user's project.
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { hashSessionToken } from '../../core/generate-token.js'
import type { User } from '../types.js'
import type { Session, SessionValidationResult } from '../../core/session.js'
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

export interface AuthFastifyRequest extends FastifyRequest {
  authUser?: User
  authSession?: Session
}

type RC = ReturnType<typeof resolveConfig>

function getCookie(req: FastifyRequest, name: string): string | null {
  const reqCookies = (req as unknown as { cookies?: Record<string, string> }).cookies
  if (reqCookies && typeof reqCookies === 'object' && reqCookies[name]) {
    return reqCookies[name] ?? null
  }
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match && match[1] !== undefined ? decodeURIComponent(match[1]) : null
}

function setCookie(
  reply: FastifyReply,
  name: string,
  value: string,
  options: {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'lax' | 'strict' | 'none' | 'Lax' | 'Strict' | 'None'
    expires?: Date
    maxAge?: number
    path?: string
  },
): void {
  const replyAny = reply as unknown as { setCookie?: (name: string, value: string, opts: typeof options) => void }
  if (typeof replyAny.setCookie === 'function') {
    replyAny.setCookie(name, value, options)
    return
  }

  let cookie = `${name}=${encodeURIComponent(value)}; Path=${options.path ?? '/'}`
  if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`
  if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`
  if (options.httpOnly) cookie += '; HttpOnly'
  if (options.secure) cookie += '; Secure'
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`

  const existing = reply.getHeader('set-cookie') ?? reply.getHeader('Set-Cookie')
  if (!existing) {
    reply.header('Set-Cookie', cookie)
  } else if (Array.isArray(existing)) {
    reply.header('Set-Cookie', [...existing, cookie])
  } else {
    reply.header('Set-Cookie', [existing as string, cookie])
  }
}

function clearCookie(reply: FastifyReply, name: string, options?: { path?: string }): void {
  const replyAny = reply as unknown as { clearCookie?: (name: string, opts?: { path?: string }) => void }
  if (typeof replyAny.clearCookie === 'function') {
    replyAny.clearCookie(name, options)
    return
  }
  setCookie(reply, name, '', {
    expires: new Date(0),
    maxAge: 0,
    path: options?.path ?? '/',
  })
}

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, c: RC): void {
  setCookie(reply, c.cookieName, token, {
    httpOnly: true,
    secure: c.secureCookies,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

function clearSessionCookie(reply: FastifyReply, c: RC): void {
  clearCookie(reply, c.cookieName, { path: '/' })
}

function getToken(req: FastifyRequest, c: RC): string | null {
  return getCookie(req, c.cookieName)
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
 * Attaches req.authUser and req.authSession if valid. Does not reject unauthenticated requests.
 */
export function createFastifySessionHook(config: AuthConfig) {
  const rc = resolveConfig(config)
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = getToken(req, rc)
    const result = await validateRequest(rc.db, token)
    if (result) {
      ;(req as unknown as { authUser: User }).authUser = result.user
      ;(req as unknown as { authSession: Session }).authSession = result.session
      if (result.session.expiresAt > new Date(Date.now() + 1000 * 60 * 60 * 24 * 15)) {
        setSessionCookie(reply, token!, result.session.expiresAt, rc)
      }
    }
  }
}

/** Rejects unauthenticated requests with 401. Mount in preHandler hook. */
export async function fastifyRequireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!(req as unknown as { authUser?: User }).authUser) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

export const requireAuth = fastifyRequireAuth

/**
 * Helper to retrieve session info on demand.
 */
export async function getSession(
  reqOrConfig: FastifyRequest | AuthConfig,
  maybeConfig?: AuthConfig,
): Promise<{ user: User; session: Session } | null> {
  if (reqOrConfig && 'headers' in reqOrConfig && maybeConfig) {
    const rc = resolveConfig(maybeConfig)
    const token = getToken(reqOrConfig as FastifyRequest, rc)
    return validateRequest(rc.db, token)
  }
  return null
}

/**
 * Creates a Fastify plugin with all auth routes.
 *
 * Usage:
 *   fastify.register(createFastifyAuthPlugin({ db, secret, providers: [...] }), { prefix: '/auth' })
 */
export function createFastifyAuthPlugin(config: AuthConfig): FastifyPluginAsync {
  const rc = resolveConfig(config)

  return async function authPlugin(fastify: FastifyInstance): Promise<void> {
    // CSRF guard — validates on all mutating requests
    fastify.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const cookieToken = getCookie(req, 'csrf_token')
        const headerToken = (req.headers['x-csrf-token'] as string) ?? ''
        if (!cookieToken || cookieToken !== headerToken) {
          reply.status(403).send({ error: 'csrf-invalid' })
          return reply
        }
      }
    })

    // GET /csrf-token — returns CSRF token, sets httpOnly cookie
    fastify.get('/csrf-token', async (_req: FastifyRequest, reply: FastifyReply) => {
      const token = generateCsrfToken()
      setCookie(reply, 'csrf_token', token, {
        httpOnly: true,
        secure: rc.secureCookies,
        sameSite: 'strict',
        maxAge: 86400,
        path: '/',
      })
      reply.header('X-CSRF-Token', token)
      return { token }
    })

    fastify.post('/signup', async (req: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = (req.body as { email?: string; password?: string }) ?? {}
      if (!email || !password) {
        reply.status(400).send({ error: 'email and password required' })
        return
      }
      const forwarded = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown'
      const ip = forwarded.split(',')[0]?.trim() ?? 'unknown'
      const r = await signupWithPassword(rc.db, email, ip, password)
      if (!r.ok) {
        reply.status(r.error === 'rate-limited' ? 429 : 409).send({ error: r.error })
        return
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      reply.status(201).send({ user: sanitizeUser(r.data.user) })
    })

    fastify.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = (req.body as { email?: string; password?: string }) ?? {}
      if (!email || !password) {
        reply.status(400).send({ error: 'email and password required' })
        return
      }
      const forwarded = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown'
      const ip = forwarded.split(',')[0]?.trim() ?? 'unknown'
      const r = await loginWithPassword(rc.db, ip, email, password)
      if (!r.ok) {
        reply.status(r.error === 'rate-limited' ? 429 : 401).send({ error: r.error })
        return
      }
      if (r.data.needsTotp) {
        setCookie(reply, 'auth_pending_mfa', `pending:${r.data.user.id}`, {
          httpOnly: true,
          secure: rc.secureCookies,
          sameSite: 'lax',
          maxAge: 300,
          path: '/',
        })
        return { requiresTotp: true }
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return { user: sanitizeUser(r.data.user) }
    })

    fastify.post('/logout', async (req: FastifyRequest, reply: FastifyReply) => {
      const token = getToken(req, rc)
      if (token) await logout(rc.db, hashSessionToken(token))
      clearSessionCookie(reply, rc)
      return { ok: true }
    })

    fastify.get('/session', async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await validateRequest(rc.db, getToken(req, rc))
      if (!r) {
        reply.status(401).send({ user: null })
        return
      }
      return { user: sanitizeUser(r.user) }
    })

    fastify.get('/sessions', async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await validateRequest(rc.db, getToken(req, rc))
      if (!r) {
        reply.status(401).send({ error: 'unauthorized' })
        return
      }
      const sessions = await listUserSessions(rc.db, r.user.id)
      return { sessions }
    })

    fastify.post('/sessions/revoke', async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await validateRequest(rc.db, getToken(req, rc))
      if (!r) {
        reply.status(401).send({ error: 'unauthorized' })
        return
      }
      const { sessionId } = (req.body as { sessionId?: string }) ?? {}
      if (!sessionId) {
        reply.status(400).send({ error: 'sessionId required' })
        return
      }
      await revokeSession(rc.db, sessionId)
      return { ok: true }
    })

    fastify.post('/sessions/revoke-all', async (req: FastifyRequest, reply: FastifyReply) => {
      const r = await validateRequest(rc.db, getToken(req, rc))
      if (!r) {
        reply.status(401).send({ error: 'unauthorized' })
        return
      }
      await revokeAllSessions(rc.db, r.user.id)
      clearSessionCookie(reply, rc)
      return { ok: true }
    })

    fastify.post('/magic-link', async (req: FastifyRequest, reply: FastifyReply) => {
      const { email } = (req.body as { email?: string }) ?? {}
      if (!email) {
        reply.status(400).send({ error: 'email required' })
        return
      }
      const forwarded = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown'
      const ip = forwarded.split(',')[0]?.trim() ?? 'unknown'
      const r = await createMagicLink(rc.db, email, ip)
      if (!r.ok) {
        reply.status(r.error === 'rate-limited' ? 429 : 400).send({ error: r.error })
        return
      }
      const magicLinkUrl = `${rc.basePath}/magic-link/verify?token=${r.data.token}`
      sendEmail(buildMagicLinkEmail({ email, magicLinkUrl }), rc.email).catch(console.error)
      return { ok: true }
    })

    fastify.get('/magic-link/verify', async (req: FastifyRequest, reply: FastifyReply) => {
      const { token } = (req.query as Record<string, string>) ?? {}
      if (!token) {
        reply.status(400).send({ error: 'token required' })
        return
      }
      const r = await verifyMagicLink(rc.db, token)
      if (!r.ok) {
        reply.status(400).send({ error: r.error })
        return
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return { user: sanitizeUser(r.data.user) }
    })

    fastify.get('/oauth/:provider', async (req: FastifyRequest, reply: FastifyReply) => {
      const provider = (req.params as Record<string, string>)?.['provider']
      if (!provider) {
        reply.status(400).send({ error: 'provider required' })
        return
      }
      const r = createOAuthRedirect(rc, provider)
      if (!r.ok) {
        reply.status(400).send({ error: r.error })
        return
      }
      setCookie(reply, 'oauth_code_verifier', r.data.codeVerifier, {
        httpOnly: true,
        secure: rc.secureCookies,
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      })
      setCookie(reply, 'oauth_state', r.data.state, {
        httpOnly: true,
        secure: rc.secureCookies,
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      })
      reply.redirect(r.data.url.toString())
    })

    fastify.get('/oauth/:provider/callback', async (req: FastifyRequest, reply: FastifyReply) => {
      const provider = (req.params as Record<string, string>)?.['provider']
      if (!provider) {
        reply.status(400).send({ error: 'provider required' })
        return
      }
      const q = (req.query as Record<string, string>) ?? {}
      const stateCookie = getCookie(req, 'oauth_state')
      const verifierCookie = getCookie(req, 'oauth_code_verifier')
      if (!q['code'] || !q['state'] || q['state'] !== stateCookie || !verifierCookie) {
        reply.status(400).send({ error: 'oauth-state-mismatch' })
        return
      }
      clearCookie(reply, 'oauth_state', { path: '/' })
      clearCookie(reply, 'oauth_code_verifier', { path: '/' })
      const r = await handleOAuthCallback(rc.db, rc, provider, q['code']!, verifierCookie)
      if (!r.ok) {
        reply.status(400).send({ error: r.error })
        return
      }
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      reply.redirect('/')
    })

    fastify.post('/totp/verify', async (req: FastifyRequest, reply: FastifyReply) => {
      const pending = getCookie(req, 'auth_pending_mfa')
      const { code } = (req.body as { code?: string }) ?? {}
      if (!pending?.startsWith('pending:') || !code) {
        reply.status(400).send({ error: 'invalid request' })
        return
      }
      const userId = pending.replace('pending:', '')
      const forwarded = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown'
      const ip = forwarded.split(',')[0]?.trim() ?? 'unknown'
      const r = await completeTotpLogin(rc.db, rc.secret, userId, code, ip)
      if (!r.ok) {
        reply.status(r.error === 'rate-limited' ? 429 : 401).send({ error: r.error })
        return
      }
      clearCookie(reply, 'auth_pending_mfa', { path: '/' })
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return { user: sanitizeUser(r.data.user) }
    })

    fastify.post('/totp/backup', async (req: FastifyRequest, reply: FastifyReply) => {
      const pending = getCookie(req, 'auth_pending_mfa')
      const { code } = (req.body as { code?: string }) ?? {}
      if (!pending?.startsWith('pending:') || !code) {
        reply.status(400).send({ error: 'invalid request' })
        return
      }
      const r = await verifyBackupCode(rc.db, pending.replace('pending:', ''), code)
      if (!r.ok) {
        reply.status(401).send({ error: r.error })
        return
      }
      clearCookie(reply, 'auth_pending_mfa', { path: '/' })
      setSessionCookie(reply, r.data.token, r.data.session.expiresAt, rc)
      return { user: sanitizeUser(r.data.user) }
    })

    fastify.post('/password-reset/request', async (req: FastifyRequest, reply: FastifyReply) => {
      const { email } = (req.body as { email?: string }) ?? {}
      if (!email) {
        reply.status(400).send({ error: 'email required' })
        return
      }
      const r = await createPasswordResetToken(rc.db, email)
      if (r.ok && r.data.token) {
        const resetUrl = `${rc.basePath}/password-reset/confirm?token=${r.data.token}`
        sendEmail(buildPasswordResetEmail({ email, resetUrl }), rc.email).catch(console.error)
      }
      return { ok: true }
    })

    fastify.post('/password-reset/confirm', async (req: FastifyRequest, reply: FastifyReply) => {
      const { token, password } = (req.body as { token?: string; password?: string }) ?? {}
      if (!token || !password) {
        reply.status(400).send({ error: 'token and password required' })
        return
      }
      const r = await confirmPasswordReset(rc.db, token, password)
      if (!r.ok) {
        reply.status(400).send({ error: r.error })
        return
      }
      clearSessionCookie(reply, rc)
      return { ok: true }
    })

    fastify.post('/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = getCookie(req, 'refresh_token')
      if (!refreshToken) {
        reply.status(401).send({ error: 'token-invalid' })
        return
      }
      const r = await refreshAccessToken(rc.db, refreshToken, rc.secret)
      if (!r.ok) {
        reply.status(401).send({ error: r.error })
        return
      }
      setCookie(reply, 'access_token', r.data.accessToken, {
        httpOnly: true,
        secure: rc.secureCookies,
        sameSite: 'lax',
        expires: r.data.expiresAt,
        path: '/',
      })
      return { ok: true }
    })

    fastify.post('/refresh/revoke', async (req: FastifyRequest, _reply: FastifyReply) => {
      const refreshToken = getCookie(req, 'refresh_token')
      if (refreshToken) await revokeRefreshToken(rc.db, refreshToken)
      return { ok: true }
    })
  }
}
