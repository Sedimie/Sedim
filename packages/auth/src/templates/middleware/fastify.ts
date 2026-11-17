// src/sedim/auth/middleware.ts (re-exported from src/sedim/auth/index.ts)
// ── Fastify auth hooks / middleware ───────────────────────────
// Use these in your Fastify app or routes:
//   import { sessionHook, requireAuth } from './sedim/auth'
//   app.addHook('onRequest', sessionHook)
//   app.get('/protected', { preHandler: [requireAuth] }, handler)

import { createFastifySessionHook, fastifyRequireAuth } from './adapters/framework/fastify.js'
import { authConfig } from './config.js'

export const sessionHook = createFastifySessionHook(authConfig)
export const requireAuth = fastifyRequireAuth
