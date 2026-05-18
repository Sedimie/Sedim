// src/sedim/auth/router.ts (re-exported from src/sedim/auth/index.ts)
// ── Express auth router ───────────────────────────────────────
// Mount this in your Express app:
//   import { authRouter } from './sedim/auth'
//   app.use('/auth', authRouter)

import { createExpressAuthRouter } from './adapters/framework.js'
import { authConfig } from './config.js'

export const authRouter = createExpressAuthRouter(authConfig)
