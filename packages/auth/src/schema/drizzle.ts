import { pgTable, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'

// ── Auth schema for Drizzle — PostgreSQL dialect ──────────────
// For MySQL use schema/drizzle-mysql.ts, for SQLite use schema/drizzle-sqlite.ts
// plan-config.ts stamps the correct file based on detected DB type.

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  passwordHash: text('password_hash'),
  /** Consecutive failed login attempts. Reset to 0 on success. */
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  /** If locked, the timestamp when the lock expires. Null = not locked. */
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  fresh: boolean('fresh').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const otpTokens = pgTable('otp_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  type: text('type', { enum: ['magic-link', 'email-verification', 'password-reset'] }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const oauthAccounts = pgTable('oauth_accounts', {
  providerId: text('provider_id').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const totpCredentials = pgTable('totp_credentials', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  lastUsedCounter: integer('last_used_counter'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const backupCodes = pgTable('backup_codes', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
})

export const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),          // hashed token — lookup key
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
