// src/sedim/auth/index.ts
// ── Auth barrel ───────────────────────────────────────────────
// Re-exports everything you need to use auth in your app.
// Import from here, not from individual files.
//
// Server-side (Server Components, Route Handlers, Server Actions):
//   import { getSession, authConfig } from '@/sedim/auth'
//   import type { User, Session } from '@/sedim/auth'
//
// Client-side (Client Components):
//   import { useAuth } from '@/sedim/auth'
//   import { LoginForm, SignupForm } from '@/sedim/auth'

// ── Server exports ────────────────────────────────────────────
export { authConfig } from './config.js'
export { getSession } from './adapters/framework.js'
export type { User, OtpToken, OAuthAccount, TotpCredential, BackupCode } from './adapters/types.js'
export type { Session, SessionValidationResult } from './core/session.js'
export { hashPassword, verifyPassword, needsRehash } from './core/hash-password.js'
export { generateSessionToken, hashSessionToken } from './core/generate-token.js'
export { buildSession, validateSession } from './core/session.js'

// ── Client exports ────────────────────────────────────────────
export { useAuth } from './ui/use-auth.js'
export type { AuthUser, AuthError } from './ui/auth-client.js'
export { getSession as getClientSession, login, signup, logout, redirectToOAuth } from './ui/auth-client.js'
{{UI_EXPORTS}}
