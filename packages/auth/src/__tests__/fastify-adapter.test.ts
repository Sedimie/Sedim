import { describe, expect, it } from 'vitest'
import fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { hashSessionToken } from '../core/generate-token.js'
import {
  createFastifyAuthPlugin,
  createFastifySessionHook,
  fastifyRequireAuth,
  getSession,
} from '../adapters/framework/fastify.js'
import { createMockDb } from './mock-db.js'
import type { AuthConfig } from '../adapters/framework/framework-config.js'

describe('Fastify Framework Adapter', () => {
  const db = createMockDb() as any
  const config: AuthConfig = {
    db,
    secret: 'test-secret-at-least-32-characters-long',
    cookieName: 'sedim_session',
    secureCookies: false,
    basePath: '/auth',
  }

  async function buildTestApp() {
    const app = fastify()
    await app.register(fastifyCookie)
    await app.register(createFastifyAuthPlugin(config), { prefix: '/auth' })

    const sessionHook = createFastifySessionHook(config)
    app.addHook('onRequest', sessionHook)

    app.get('/protected', { preHandler: [fastifyRequireAuth] }, async (req) => {
      return { protected: true, user: (req as any).authUser }
    })

    return app
  }

  it('fetches CSRF token and rejects mutating requests without valid CSRF', async () => {
    const app = await buildTestApp()

    // 1. Fetch CSRF token
    const csrfRes = await app.inject({
      method: 'GET',
      url: '/auth/csrf-token',
    })
    expect(csrfRes.statusCode).toBe(200)
    const { token: csrfToken } = csrfRes.json()
    expect(csrfToken).toBeDefined()
    const cookies = csrfRes.cookies
    const csrfCookie = cookies.find((c) => c.name === 'csrf_token')
    expect(csrfCookie).toBeDefined()

    // 2. Mutating request without CSRF header fails with 403
    const badRes = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'test@example.com', password: 'Password123!' },
    })
    expect(badRes.statusCode).toBe(403)
    expect(badRes.json().error).toBe('csrf-invalid')
  })

  it('handles signup, login, session validation, and logout end-to-end', async () => {
    const app = await buildTestApp()

    // 1. Get CSRF token
    const csrfRes = await app.inject({
      method: 'GET',
      url: '/auth/csrf-token',
    })
    const { token: csrfToken } = csrfRes.json()
    const csrfCookieHeader = `csrf_token=${csrfToken}`

    // 2. Signup
    const signupRes = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: {
        'x-csrf-token': csrfToken,
        cookie: csrfCookieHeader,
      },
      payload: { email: 'fastify-user@example.com', password: 'StrongPassword123!' },
    })
    expect(signupRes.statusCode).toBe(201)
    expect(signupRes.json().user.email).toBe('fastify-user@example.com')
    const sessionCookie = signupRes.cookies.find((c) => c.name === 'sedim_session')
    expect(sessionCookie).toBeDefined()

    // 3. GET /auth/session with session cookie
    const sessionRes = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: {
        cookie: `sedim_session=${sessionCookie!.value}`,
      },
    })
    expect(sessionRes.statusCode).toBe(200)
    expect(sessionRes.json().user.email).toBe('fastify-user@example.com')

    // 4. Access protected route with session
    const protectedRes = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        cookie: `sedim_session=${sessionCookie!.value}`,
      },
    })
    expect(protectedRes.statusCode).toBe(200)
    expect(protectedRes.json().protected).toBe(true)
    expect(protectedRes.json().user.email).toBe('fastify-user@example.com')

    // 5. Protected route without session returns 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/protected',
    })
    expect(unauthRes.statusCode).toBe(401)
    expect(unauthRes.json().error).toBe('Unauthorized')

    // 6. Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: {
        'x-csrf-token': csrfToken,
        cookie: `${csrfCookieHeader}; sedim_session=${sessionCookie!.value}`,
      },
    })
    expect(logoutRes.statusCode).toBe(200)
    expect(logoutRes.json().ok).toBe(true)
  })

  it('getSession helper resolves session from Fastify request', async () => {
    const app = await buildTestApp()

    // Create session in mock db
    const user = await db.createUser({ email: 'helper@example.com', passwordHash: null })
    const rawToken = 'test-raw-session-token-xyz'
    const session = {
      id: hashSessionToken(rawToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    }
    await db.createSession(session)

    let retrieved: any = null
    app.get('/test-helper', async (req) => {
      retrieved = await getSession(req, config)
      return { ok: true }
    })

    await app.inject({
      method: 'GET',
      url: '/test-helper',
      headers: {
        cookie: `sedim_session=${rawToken}`,
      },
    })

    expect(retrieved).not.toBeNull()
    expect(retrieved.user.email).toBe('helper@example.com')
  })
})
