import type { Session } from '../core/session.js'

// ── User ──────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  emailVerified: boolean
  passwordHash: string | null // null for OAuth-only accounts
  /** Number of consecutive failed login attempts. Reset to 0 on successful login. */
  failedLoginAttempts: number
  /** If locked, the timestamp when the lock expires. Null if not locked. */
  lockedAt: Date | null
  createdAt: Date
}

// ── OTP tokens (magic links, email verification, password reset) ──

export interface OtpToken {
  id: string
  userId: string
  tokenHash: string // SHA-256 hash of the raw token — never store raw
  type: 'magic-link' | 'email-verification' | 'password-reset'
  expiresAt: Date
}

// ── OAuth accounts ────────────────────────────────────────────

export interface OAuthAccount {
  providerId: string // e.g. 'google', 'github'
  providerUserId: string // the user's ID on the provider side
  userId: string // foreign key to users table
}

// ── TOTP credentials ──────────────────────────────────────────

export interface TotpCredential {
  userId: string
  secret: string // base32-encoded secret — encrypt at rest in production
  lastUsedCounter: number | null
  createdAt: Date
}

// ── Backup codes ──────────────────────────────────────────────

export interface BackupCode {
  id: string
  userId: string
  codeHash: string // SHA-256 hash of the raw code
  usedAt: Date | null
}

// ── Refresh tokens (JWT refresh tokens stored in DB) ───────────

export interface RefreshToken {
  id: string        // hashed token — lookup key
  userId: string
  sessionId: string
  expiresAt: Date
  createdAt: Date
}

// ── DatabaseAdapter ───────────────────────────────────────────
// The contract every ORM adapter must implement.
// The core never imports Drizzle, Prisma, or any DB client directly —
// it receives this interface and calls through it.

export interface DatabaseAdapter {
  // users
  createUser(data: { email: string; passwordHash: string | null }): Promise<User>
  findUserByEmail(email: string): Promise<User | null>
  findUserById(id: string): Promise<User | null>
  updateUser(id: string, data: Partial<Pick<User, 'emailVerified' | 'passwordHash' | 'failedLoginAttempts' | 'lockedAt'>>): Promise<User>

  // sessions
  createSession(session: Session): Promise<void>
  findSession(tokenHash: string): Promise<Session | null>
  /** Find a session by its own ID (used for single-session revocation). */
  findSessionById(sessionId: string): Promise<Session | null>
  updateSessionExpiry(tokenHash: string, expiresAt: Date): Promise<void>
  deleteSession(tokenHash: string): Promise<void>
  deleteSessionById(sessionId: string): Promise<void>
  deleteAllUserSessions(userId: string): Promise<void>
  /** Returns all sessions for a user (for session list / revocation UI). */
  findAllUserSessions(userId: string): Promise<Session[]>

  // otp tokens
  createOtpToken(data: Omit<OtpToken, 'id'>): Promise<OtpToken>
  findOtpToken(tokenHash: string, type: OtpToken['type']): Promise<OtpToken | null>
  deleteOtpToken(id: string): Promise<void>
  deleteExpiredOtpTokens(userId: string): Promise<void>

  // oauth accounts
  createOAuthAccount(data: OAuthAccount): Promise<void>
  findOAuthAccount(providerId: string, providerUserId: string): Promise<OAuthAccount | null>

  // totp
  createTotpCredential(data: Omit<TotpCredential, 'createdAt'>): Promise<TotpCredential>
  findTotpCredential(userId: string): Promise<TotpCredential | null>
  updateTotpLastUsedCounter(userId: string, counter: number): Promise<void>
  deleteTotpCredential(userId: string): Promise<void>

  // backup codes
  createBackupCodes(codes: Omit<BackupCode, 'usedAt'>[]): Promise<void>
  findBackupCode(userId: string, codeHash: string): Promise<BackupCode | null>
  markBackupCodeUsed(id: string): Promise<void>
  deleteAllBackupCodes(userId: string): Promise<void>

  // refresh tokens
  createRefreshToken(data: Omit<RefreshToken, 'createdAt'>): Promise<void>
  findRefreshToken(id: string): Promise<RefreshToken | null>
  deleteRefreshToken(id: string): Promise<void>
  deleteExpiredRefreshTokens(): Promise<void>
}

// ── SessionTransport ──────────────────────────────────────────
// How the session token moves between server and client.
// Kept separate from DatabaseAdapter because it's framework-specific —
// Express, Next.js, and Hono all set cookies differently.
// Framework adapters implement this alongside their route handlers.

export interface SessionTransport {
  setSessionCookie(token: string, expiresAt: Date): void
  getSessionCookie(): string | null
  clearSessionCookie(): void
}
