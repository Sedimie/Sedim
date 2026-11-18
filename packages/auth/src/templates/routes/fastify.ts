// src/sedim/auth/routes.ts (re-exported from src/sedim/auth/index.ts)
// ── Fastify auth plugin ─────────────────────────────────────────
// Register this in your Fastify app:
//   import { authPlugin } from './sedim/auth'
//   fastify.register(authPlugin, { prefix: '/auth' })

import { createFastifyAuthPlugin } from './adapters/framework/fastify.js'
import { authConfig } from './config.js'

export const authPlugin = createFastifyAuthPlugin(authConfig)
