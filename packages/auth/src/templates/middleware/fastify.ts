// src/sedim/auth/middleware.ts (re-exported from src/sedim/auth/index.ts)
// ── Fastify auth hooks ─────────────────────────────────────────
// Use these in your routes:
//   import { sessionHook, requireAuth } from './sedim/auth'
//   fastify.addHook('onRequest', sessionHook)   // attach user to all requests
//   fastify.get('/protected', { preHandler: [requireAuth] }, handler)

import { createFastifySessionHook, fastifyRequireAuth } from './adapters/framework/fastify.js'
import { authConfig } from './config.js'

export const sessionHook = createFastifySessionHook(authConfig)
export const requireAuth = fastifyRequireAuth
