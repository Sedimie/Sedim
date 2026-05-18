// ── Auth inter-module contract ────────────────────────────────
// Other modules (chat, notifications, billing) import from here
// to get the minimal interface they need from auth.
// They never import the full auth module — only this contract.
//
// Usage in another module's plan-config.ts:
//   import type { AuthContract } from '@sedim/auth/contracts'
//
//   // receive it as a constructor argument, don't import auth directly
//   function createChatAdapter(auth: AuthContract, db: DatabaseAdapter) { ... }

export interface AuthContract {
  /** Validates a session token and returns the user, or null if invalid/expired. */
  getCurrentUser(sessionToken: string): Promise<AuthUser | null>
}

export interface AuthUser {
  id: string
  email: string
  emailVerified: boolean
}
