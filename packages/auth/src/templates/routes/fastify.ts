// src/sedim/auth/routes.ts (re-exported from src/sedim/auth/index.ts)
// ── Fastify auth plugin ───────────────────────────────────────
// Register this in your Fastify app:
//   import { authRoutes } from './sedim/auth'
//   app.register(authRoutes, { prefix: '/auth' })

import { createFastifyAuthPlugin } from './adapters/framework/fastify.js'
import { authConfig } from './config.js'

export const authRoutes = createFastifyAuthPlugin(authConfig)
export const authPlugin = authRoutes
