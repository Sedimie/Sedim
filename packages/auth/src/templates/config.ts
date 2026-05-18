// src/sedim/auth/config.ts
// ── Auth configuration ────────────────────────────────────────
// This is the only file you need to edit to wire auth to your project.
// Everything else in src/sedim/auth/ is stamped and ready to use.

import type { AuthConfig } from './adapters/framework-config.js'
import { dbAdapter } from '../auth-adapter.js'
{{PROVIDERS_IMPORT}}

export const authConfig: AuthConfig = {
  db: dbAdapter,

  // Your AUTH_SECRET env var — never hardcode this
  secret: process.env['AUTH_SECRET']!,

{{PROVIDERS_CONFIG}}
  // Base path for auth routes. Change this if you want a different prefix.
  basePath: '/api/auth',

  // Defaults to true in production automatically.
  // secureCookies: process.env['NODE_ENV'] === 'production',
}
