import type { Session } from '../core/session.js'
import type { DatabaseAdapter, User, OtpToken, OAuthAccount, TotpCredential, BackupCode } from './types.js'

// ── Schema shape the adapter expects ─────────────────────────
// The user owns their Drizzle schema. This adapter accepts the table
// references as constructor arguments rather than importing them directly.
// The tables must have the columns defined in AuthDrizzleSchema below.
//
// In the user's project, after stamping:
//   import { createDrizzleAdapter } from './auth/adapters/drizzle'
//   import * as schema from './db/schema/auth'
//   import { db } from './db'
//
//   export const dbAdapter = createDrizzleAdapter(db, schema)

// Column shape contracts — what each table must expose.
// These are structural types, not imports, so they work with any Drizzle table.

export interface AuthDrizzleSchema {
  users: DrizzleTable<{
    id: string
    email: string
    emailVerified: boolean
    passwordHash: string | null
    createdAt: Date
  }>
  sessions: DrizzleTable<{
    id: string
    userId: string
    expiresAt: Date
    fresh: boolean
  }>
  otpTokens: DrizzleTable<{
    id: string
    userId: string
    tokenHash: string
    type: string
    expiresAt: Date
  }>
  oauthAccounts: DrizzleTable<{
    providerId: string
    providerUserId: string
    userId: string
  }>
  totpCredentials: DrizzleTable<{
    userId: string
    secret: string
    lastUsedCounter: number | null
    createdAt: Date
  }>
  backupCodes: DrizzleTable<{
    id: string
    userId: string
    codeHash: string
    usedAt: Date | null
  }>
}

// Minimal Drizzle table interface — accepts any Drizzle table regardless of dialect.
// The index signature makes it compatible with PgTableWithColumns, MySqlTable, etc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleTable<_TShape> = Record<string, any>

// Drizzle db client interface — the subset of methods we use
interface DrizzleDb {
  select(): DrizzleSelectBuilder
  insert(table: unknown): DrizzleInsertBuilder
  update(table: unknown): DrizzleUpdateBuilder
  delete(table: unknown): DrizzleDeleteBuilder
}

interface DrizzleSelectBuilder {
  from(table: unknown): DrizzleSelectFromBuilder
}
interface DrizzleSelectFromBuilder {
  where(condition: unknown): Promise<unknown[]>
}
interface DrizzleInsertBuilder {
  values(data: unknown): { returning(): Promise<unknown[]> }
}
interface DrizzleUpdateBuilder {
  set(data: unknown): { where(condition: unknown): Promise<void> }
}
interface DrizzleDeleteBuilder {
  where(condition: unknown): Promise<void>
}

// ── Factory ───────────────────────────────────────────────────

/**
 * Creates a DatabaseAdapter backed by Drizzle ORM.
 *
 * @param db     - Your Drizzle database instance
 * @param schema - Your auth schema tables (users, sessions, etc.)
 * @param eq     - Drizzle's eq() operator, imported from 'drizzle-orm'
 * @param and    - Drizzle's and() operator, imported from 'drizzle-orm'
 *
 * Example:
 *   import { eq, and } from 'drizzle-orm'
 *   import { db } from './db'
 *   import * as schema from './db/schema/auth'
 *   export const dbAdapter = createDrizzleAdapter(db, schema, eq, and)
 */
export function createDrizzleAdapter(
  db: DrizzleDb,
  schema: AuthDrizzleSchema,
  eq: (col: unknown, val: unknown) => unknown,
  and: (...conditions: unknown[]) => unknown,
  lt: (col: unknown, val: unknown) => unknown,
): DatabaseAdapter {
  return {
    // ── users ───────────────────────────────────────────────

    async createUser(data) {
      const id = crypto.randomUUID()
      const rows = await db
        .insert(schema.users)
        .values({ id, ...data, emailVerified: false, createdAt: new Date() })
        .returning()
      return rows[0] as User
    },

    async findUserByEmail(email) {
      const rows = await db.select().from(schema.users).where(eq(schema.users['email'], email))
      return (rows[0] as User) ?? null
    },

    async findUserById(id) {
      const rows = await db.select().from(schema.users).where(eq(schema.users['id'], id))
      return (rows[0] as User) ?? null
    },

    async updateUser(id, data) {
      await db.update(schema.users).set(data).where(eq(schema.users['id'], id))
      const rows = await db.select().from(schema.users).where(eq(schema.users['id'], id))
      return rows[0] as User
    },

    // ── sessions ────────────────────────────────────────────

    async createSession(session) {
      await db.insert(schema.sessions).values(session).returning()
    },

    async findSession(tokenHash) {
      const rows = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions['id'], tokenHash))
      return (rows[0] as Session) ?? null
    },

    async updateSessionExpiry(tokenHash, expiresAt) {
      await db
        .update(schema.sessions)
        .set({ expiresAt })
        .where(eq(schema.sessions['id'], tokenHash))
    },

    async deleteSession(tokenHash) {
      await db.delete(schema.sessions).where(eq(schema.sessions['id'], tokenHash))
    },

    async deleteAllUserSessions(userId) {
      await db.delete(schema.sessions).where(eq(schema.sessions['userId'], userId))
    },

    // ── otp tokens ──────────────────────────────────────────

    async createOtpToken(data) {
      const id = crypto.randomUUID()
      const rows = await db.insert(schema.otpTokens).values({ id, ...data }).returning()
      return rows[0] as OtpToken
    },

    async findOtpToken(tokenHash, type) {
      const rows = await db
        .select()
        .from(schema.otpTokens)
        .where(and(eq(schema.otpTokens['tokenHash'], tokenHash), eq(schema.otpTokens['type'], type)))
      return (rows[0] as OtpToken) ?? null
    },

    async deleteOtpToken(id) {
      await db.delete(schema.otpTokens).where(eq(schema.otpTokens['id'], id))
    },

    async deleteExpiredOtpTokens(userId) {
      await db.delete(schema.otpTokens).where(
        and(
          eq(schema.otpTokens['userId'], userId),
          lt(schema.otpTokens['expiresAt'], new Date())
        )
      )
    },

    // ── oauth accounts ──────────────────────────────────────

    async createOAuthAccount(data) {
      await db.insert(schema.oauthAccounts).values(data).returning()
    },

    async findOAuthAccount(providerId, providerUserId) {
      const rows = await db
        .select()
        .from(schema.oauthAccounts)
        .where(
          and(
            eq(schema.oauthAccounts['providerId'], providerId),
            eq(schema.oauthAccounts['providerUserId'], providerUserId),
          ),
        )
      return (rows[0] as OAuthAccount) ?? null
    },

    // ── totp ────────────────────────────────────────────────

    async createTotpCredential(data) {
      const rows = await db
        .insert(schema.totpCredentials)
        .values({ ...data, createdAt: new Date() })
        .returning()
      return rows[0] as TotpCredential
    },

    async findTotpCredential(userId) {
      const rows = await db
        .select()
        .from(schema.totpCredentials)
        .where(eq(schema.totpCredentials['userId'], userId))
      return (rows[0] as TotpCredential) ?? null
    },

    async updateTotpLastUsedCounter(userId, counter) {
      await db
        .update(schema.totpCredentials)
        .set({ lastUsedCounter: counter })
        .where(eq(schema.totpCredentials['userId'], userId))
    },

    async deleteTotpCredential(userId) {
      await db.delete(schema.totpCredentials).where(eq(schema.totpCredentials['userId'], userId))
    },

    // ── backup codes ────────────────────────────────────────

    async createBackupCodes(codes) {
      await db.insert(schema.backupCodes).values(codes).returning()
    },

    async findBackupCode(userId, codeHash) {
      const rows = await db
        .select()
        .from(schema.backupCodes)
        .where(
          and(
            eq(schema.backupCodes['userId'], userId),
            eq(schema.backupCodes['codeHash'], codeHash),
          ),
        )
      return (rows[0] as BackupCode) ?? null
    },

    async markBackupCodeUsed(id) {
      await db
        .update(schema.backupCodes)
        .set({ usedAt: new Date() })
        .where(eq(schema.backupCodes['id'], id))
    },

    async deleteAllBackupCodes(userId) {
      await db.delete(schema.backupCodes).where(eq(schema.backupCodes['userId'], userId))
    },
  }
}
