import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ── Auth schema for Drizzle — SQLite dialect ──────────────────
// SQLite has no native boolean or timestamp — use integer (0/1) and
// integer (unix ms) respectively. Drizzle handles the JS mapping.

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  passwordHash: text('password_hash'),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedAt: integer('locked_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  fresh: integer('fresh', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const otpTokens = sqliteTable('otp_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  type: text('type').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
})

export const oauthAccounts = sqliteTable('oauth_accounts', {
  providerId: text('provider_id').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  userId: text('user_id').notNull(),
})

export const totpCredentials = sqliteTable('totp_credentials', {
  userId: text('user_id').primaryKey(),
  secret: text('secret').notNull(),
  lastUsedCounter: integer('last_used_counter'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const backupCodes = sqliteTable('backup_codes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  codeHash: text('code_hash').notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
})

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  sessionId: text('session_id').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const authSchema = {
  users,
  sessions,
  otpTokens,
  oauthAccounts,
  totpCredentials,
  backupCodes,
  refreshTokens,
}
