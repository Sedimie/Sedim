import { mysqlTable, text, boolean, datetime, int } from 'drizzle-orm/mysql-core'

// ── Auth schema for Drizzle — MySQL dialect ───────────────────

export const users = mysqlTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  passwordHash: text('password_hash'),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedAt: datetime('locked_at'),
  createdAt: datetime('created_at').notNull(),
})

export const sessions = mysqlTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: datetime('expires_at').notNull(),
  fresh: boolean('fresh').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
})

export const otpTokens = mysqlTable('otp_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  type: text('type').notNull(),
  expiresAt: datetime('expires_at').notNull(),
})

export const oauthAccounts = mysqlTable('oauth_accounts', {
  providerId: text('provider_id').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  userId: text('user_id').notNull(),
})

export const totpCredentials = mysqlTable('totp_credentials', {
  userId: text('user_id').primaryKey(),
  secret: text('secret').notNull(),
  lastUsedCounter: int('last_used_counter'),
  createdAt: datetime('created_at').notNull(),
})

export const backupCodes = mysqlTable('backup_codes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  codeHash: text('code_hash').notNull(),
  usedAt: datetime('used_at'),
})

export const refreshTokens = mysqlTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  sessionId: text('session_id').notNull(),
  expiresAt: datetime('expires_at').notNull(),
  createdAt: datetime('created_at').notNull(),
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
