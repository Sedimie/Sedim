// src/sedim/auth/middleware.ts (re-exported from src/sedim/auth/index.ts)
// ── Express auth middleware ───────────────────────────────────
// Use these in your routes:
//   import { sessionMiddleware, requireAuth } from './sedim/auth'
//   app.use(sessionMiddleware)                    // attach user to all requests
//   app.get('/protected', requireAuth, handler)  // protect specific routes

import { createSessionMiddleware, expressRequireAuth } from './adapters/framework.js'
import { authConfig } from './config.js'

export const sessionMiddleware = createSessionMiddleware(authConfig)
export const requireAuth = expressRequireAuth
