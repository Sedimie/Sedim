// src/app/api/auth/[...all]/route.ts
// ── Next.js auth route handler ────────────────────────────────
// Handles all auth endpoints under /api/auth/*
// Do not rename this file — Next.js requires this exact path.

import { createNextjsAuthHandlers } from '{{ROUTE_TO_AUTH_IMPORT}}/adapters/framework.js'
import { authConfig } from '{{ROUTE_TO_AUTH_IMPORT}}/config.js'

export const { GET, POST } = createNextjsAuthHandlers(authConfig)
