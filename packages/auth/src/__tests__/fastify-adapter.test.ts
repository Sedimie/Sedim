import { describe, it, expect, beforeEach } from 'vitest'
import fastify from 'fastify'
import { createMockDb } from './mock-db.js'
import {
  createFastifyAuthPlugin,
  createFastifySessionHook,
  fastifyRequireAuth,
  getSession,
} from '../adapters/framework/fastify.js'
import type { AuthConfig } from '../adapters/framework/framework-config.js'
import type { DatabaseAdapter } from '../adapters/types.js'
import { hashPassword } from '../core/hash-password.js'
import { generateSessionToken, hashSessionToken } from '../core/generate-token.js'
import { buildSession } from '../core/session.js'

let db: DatabaseAdapter
let config: AuthConfig

beforeEach(() => {
  db = createMockDb() as unknown as DatabaseAdapter
  config = {
    db,
    secret: 'test-secret-at-least-32-characters-long-123456',
    basePath: '/auth',
    cookieName: 'auth_session',
    secureCookies: false,
    providers: [],
    email: {
      from: 'noreply@example.com',
      transport: {
        sendMail: async () => {},
      },
    },
  }
})

describe('fastify adapter', () => {
  describe('session hook & requireAuth', () => {
    it('populates authUser and authSession on valid session token', async () => {
      const app = fastify()
      const user = await db.createUser({ email: 'test@example.com', passwordHash: 'hash' })
      const rawToken = 'test-token-value-valid'
      const tokenHash = hashSessionToken(rawToken)
      const session = {
        ...buildSession(tokenHash, user.id),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        createdAt: new Date(),
      }
      await db.createSession(session)

      app.addHook('onRequest', createFastifySessionHook(config))
      app.get('/protected', { preHandler: [fastifyRequireAuth] }, async (req) => {
        return { user: (req as any).authUser, session: (req as any).authSession }
      })

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          cookie: `auth_session=${rawToken}`,
        },
      })

      expect(res.statusCode).toBe(200)
      const data = res.json()
      expect(data.user.id).toBe(user.id)
      expect(data.user.email).toBe('test@example.com')
      expect(data.session.id).toBe(tokenHash)
    })

    it('returns 401 when unauthenticated and requireAuth is applied', async () => {
      const app = fastify()
      app.addHook('onRequest', createFastifySessionHook(config))
      app.get('/protected', { preHandler: [fastifyRequireAuth] }, async (req) => {
        return { user: (req as any).authUser }
      })

      const res = await app.inject({
        method: 'GET',
        url: '/protected',
      })

      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ error: 'Unauthorized' })
    })

    it('allows getSession helper to retrieve session from request', async () => {
      const user = await db.createUser({ email: 'helper@example.com', passwordHash: 'hash' })
      const rawToken = 'test-token-helper'
      const tokenHash = hashSessionToken(rawToken)
      const session = {
        ...buildSession(tokenHash, user.id),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        createdAt: new Date(),
      }
      await db.createSession(session)

      const fakeReq = {
        headers: {
          cookie: `auth_session=${rawToken}`,
        },
      } as any

      const result = await getSession(fakeReq, config)
      expect(result).not.toBeNull()
      expect(result?.user.email).toBe('helper@example.com')
    })
  })

  describe('auth plugin routes', () => {
    it('sets and returns CSRF token on GET /csrf-token', async () => {
      const app = fastify()
      await app.register(createFastifyAuthPlugin(config), { prefix: '/auth' })

      const res = await app.inject({
        method: 'GET',
        url: '/auth/csrf-token',
      })

      expect(res.statusCode).toBe(200)
      const json = res.json()
      expect(typeof json.token).toBe('string')
      expect(json.token.length).toBeGreaterThan(10)
      expect(res.headers['x-csrf-token']).toBe(json.token)
      expect(res.headers['set-cookie']).toBeDefined()
    })

    it('rejects mutating requests without valid CSRF token', async () => {
      const app = fastify()
      await app.register(createFastifyAuthPlugin(config), { prefix: '/auth' })

      const res = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          email: 'no-csrf@example.com',
          password: 'Password123!',
        },
      })

      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ error: 'csrf-invalid' })
    })

    it('performs signup, sets session cookie and returns 201', async () => {
      const app = fastify()
      await app.register(createFastifyAuthPlugin(config), { prefix: '/auth' })

      // Get CSRF token
      const csrfRes = await app.inject({ method: 'GET', url: '/auth/csrf-token' })
      const csrfToken = csrfRes.json().token
      const csrfCookie = (csrfRes.headers['set-cookie'] as string).split(';')[0]

      const res = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        headers: {
          'x-csrf-token': csrfToken,
          cookie: csrfCookie,
        },
        payload: {
          email: 'newuser@example.com',
          password: 'Password123!',
        },
      })

      expect(res.statusCode).toBe(201)
      const json = res.json()
      expect(json.user.email).toBe('newuser@example.com')
      expect(json.user.passwordHash).toBeUndefined()
      expect(res.headers['set-cookie']).toBeDefined()
    })

    it('handles login with correct credentials', async () => {
      const app = fastify()
      await app.register(createFastifyAuthPlugin(config), { prefix: '/auth' })

      const passwordHash = await hashPassword('Password123!')
      await db.createUser({ email: 'login@example.com', passwordHash })

      const csrfRes = await app.inject({ method: 'GET', url: '/auth/csrf-token' })
      const csrfToken = csrfRes.json().token
      const csrfCookie = (csrfRes.headers['set-cookie'] as string).split(';')[0]

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: {
          'x-csrf-token': csrfToken,
          cookie: csrfCookie,
        },
        payload: {
          email: 'login@example.com',
          password: 'Password123!',
        },
      })

      expect(res.statusCode).toBe(200)
      const json = res.json()
      expect(json.user.email).toBe('login@example.com')
      expect(json.user.passwordHash).toBeUndefined()
      expect(res.headers['set-cookie']).toBeDefined()
    })

    it('returns session information on GET /session', async () => {
      const app = fastify()
      await app.register(createFastifyAuthPlugin(config), { prefix: '/auth' })

      const user = await db.createUser({ email: 'session@example.com', passwordHash: 'hash' })
      const rawToken = 'my-session-token'
      const tokenHash = hashSessionToken(rawToken)
      await db.createSession({
        ...buildSession(tokenHash, user.id),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        createdAt: new Date(),
      })

      const res = await app.inject({
        method: 'GET',
        url: '/auth/session',
        headers: {
          cookie: `auth_session=${rawToken}`,
        },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().user.email).toBe('session@example.com')
    })

    it('logs out and clears session cookie on POST /logout', async () => {
      const app = fastify()
      await app.register(createFastifyAuthPlugin(config), { prefix: '/auth' })

      const user = await db.createUser({ email: 'logout@example.com', passwordHash: 'hash' })
      const rawToken = 'logout-session-token'
      const tokenHash = hashSessionToken(rawToken)
      await db.createSession({
        ...buildSession(tokenHash, user.id),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        createdAt: new Date(),
      })

      const csrfRes = await app.inject({ method: 'GET', url: '/auth/csrf-token' })
      const csrfToken = csrfRes.json().token
      const csrfCookie = (csrfRes.headers['set-cookie'] as string).split(';')[0]

      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          'x-csrf-token': csrfToken,
          cookie: `${csrfCookie}; auth_session=${rawToken}`,
        },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ ok: true })
      const sessionAfter = await db.findSession(tokenHash)
      expect(sessionAfter).toBeNull()
    })

    it('lists and revokes user sessions', async () => {
      const app = fastify()
      await app.register(createFastifyAuthPlugin(config), { prefix: '/auth' })

      const user = await db.createUser({ email: 'sessions@example.com', passwordHash: 'hash' })
      const rawToken1 = 'session-token-1'
      const rawToken2 = 'session-token-2'
      const tokenHash1 = hashSessionToken(rawToken1)
      const tokenHash2 = hashSessionToken(rawToken2)
      await db.createSession({
        ...buildSession(tokenHash1, user.id),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        createdAt: new Date(),
      })
      await db.createSession({
        ...buildSession(tokenHash2, user.id),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        createdAt: new Date(),
      })

      // GET /sessions
      const listRes = await app.inject({
        method: 'GET',
        url: '/auth/sessions',
        headers: {
          cookie: `auth_session=${rawToken1}`,
        },
      })
      expect(listRes.statusCode).toBe(200)
      expect(listRes.json().sessions.length).toBe(2)

      // CSRF token
      const csrfRes = await app.inject({ method: 'GET', url: '/auth/csrf-token' })
      const csrfToken = csrfRes.json().token
      const csrfCookie = (csrfRes.headers['set-cookie'] as string).split(';')[0]

      // Revoke single session
      const revokeRes = await app.inject({
        method: 'POST',
        url: '/auth/sessions/revoke',
        headers: {
          'x-csrf-token': csrfToken,
          cookie: `${csrfCookie}; auth_session=${rawToken1}`,
        },
        payload: {
          sessionId: tokenHash2,
        },
      })
      expect(revokeRes.statusCode).toBe(200)
      expect(await db.findSession(tokenHash2)).toBeNull()

      // Revoke all sessions
      const revokeAllRes = await app.inject({
        method: 'POST',
        url: '/auth/sessions/revoke-all',
        headers: {
          'x-csrf-token': csrfToken,
          cookie: `${csrfCookie}; auth_session=${rawToken1}`,
        },
      })
      expect(revokeAllRes.statusCode).toBe(200)
      expect(await db.findSession(tokenHash1)).toBeNull()
    })
  })
})
