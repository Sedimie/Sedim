// src/sedim/auth/routes.ts (re-exported from src/sedim/auth/index.ts)
// ── Hono auth routes ──────────────────────────────────────────
// Mount this in your Hono app:
//   import { authRoutes } from './sedim/auth'
//   app.route('/auth', authRoutes)

import { createHonoAuthRoutes } from './adapters/framework.js'
import { authConfig } from './config.js'

export const authRoutes = createHonoAuthRoutes(authConfig)
