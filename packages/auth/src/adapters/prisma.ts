import type { Session } from '../core/session.js'
import type { DatabaseAdapter, User, OtpToken, OAuthAccount, TotpCredential, BackupCode } from './types.js'

// ── Prisma client interface ───────────────────────────────────
// We type only the models we use so this adapter doesn't need to
// import @prisma/client directly — the user passes their own instance.
//
// In the user's project, after stamping:
//   import { createPrismaAdapter } from './auth/adapters/prisma'
//   import { prisma } from './db'
//   export const dbAdapter = createPrismaAdapter(prisma)

interface PrismaClient {
  user: PrismaModel<UserCreateInput, UserWhereInput, UserUpdateInput>
  session: PrismaModel<SessionCreateInput, SessionWhereInput, SessionUpdateInput>
  otpToken: PrismaModel<OtpTokenCreateInput, OtpTokenWhereInput, Record<string, never>>
  oAuthAccount: PrismaModel<OAuthAccountCreateInput, OAuthAccountWhereInput, Record<string, never>>
  totpCredential: PrismaModel<TotpCredentialCreateInput, TotpCredentialWhereInput, TotpCredentialUpdateInput>
  backupCode: PrismaModel<BackupCodeCreateInput, BackupCodeWhereInput, BackupCodeUpdateInput>
}

interface PrismaModel<TCreate, TWhere, TUpdate> {
  create(args: { data: TCreate }): Promise<unknown>
  findUnique(args: { where: TWhere }): Promise<unknown>
  findFirst(args: { where: TWhere }): Promise<unknown>
  update(args: { where: TWhere; data: TUpdate }): Promise<unknown>
  delete(args: { where: TWhere }): Promise<void>
  deleteMany(args: { where: Partial<TWhere> }): Promise<void>
  createMany(args: { data: TCreate[] }): Promise<void>
}

// Input types — mirror what Prisma generates from the auth schema
interface UserCreateInput { id: string; email: string; emailVerified: boolean; passwordHash: string | null; createdAt: Date }
interface UserWhereInput { id?: string; email?: string }
interface UserUpdateInput { emailVerified?: boolean; passwordHash?: string | null }

interface SessionCreateInput { id: string; userId: string; expiresAt: Date; fresh: boolean }
interface SessionWhereInput { id?: string; userId?: string }
interface SessionUpdateInput { expiresAt?: Date; fresh?: boolean }

interface OtpTokenCreateInput { id: string; userId: string; tokenHash: string; type: string; expiresAt: Date }
interface OtpTokenWhereInput { id?: string; tokenHash?: string; type?: string; userId?: string }

interface OAuthAccountCreateInput { providerId: string; providerUserId: string; userId: string }
interface OAuthAccountWhereInput { providerId_providerUserId?: { providerId: string; providerUserId: string } }

interface TotpCredentialCreateInput { userId: string; secret: string; lastUsedCounter: number | null; createdAt: Date }
interface TotpCredentialWhereInput { userId?: string }
interface TotpCredentialUpdateInput { lastUsedCounter?: number }

interface BackupCodeCreateInput { id: string; userId: string; codeHash: string; usedAt: null }
interface BackupCodeWhereInput { id?: string; userId?: string; codeHash?: string }
interface BackupCodeUpdateInput { usedAt?: Date }

// ── Factory ───────────────────────────────────────────────────

/**
 * Creates a DatabaseAdapter backed by Prisma.
 *
 * @param prisma - Your Prisma client instance
 *
 * Example:
 *   import { createPrismaAdapter } from './auth/adapters/prisma'
 *   import { prisma } from './db'
 *   export const dbAdapter = createPrismaAdapter(prisma)
 */
export function createPrismaAdapter(prisma: PrismaClient): DatabaseAdapter {
  return {
    // ── users ───────────────────────────────────────────────

    async createUser(data) {
      return prisma.user.create({
        data: { id: crypto.randomUUID(), ...data, emailVerified: false, createdAt: new Date() },
      }) as Promise<User>
    },

    async findUserByEmail(email) {
      return (prisma.user.findUnique({ where: { email } }) as Promise<User | null>)
    },

    async findUserById(id) {
      return (prisma.user.findUnique({ where: { id } }) as Promise<User | null>)
    },

    async updateUser(id, data) {
      return prisma.user.update({ where: { id }, data }) as Promise<User>
    },

    // ── sessions ────────────────────────────────────────────

    async createSession(session) {
      await prisma.session.create({ data: session })
    },

    async findSession(tokenHash) {
      return (prisma.session.findUnique({ where: { id: tokenHash } }) as Promise<Session | null>)
    },

    async updateSessionExpiry(tokenHash, expiresAt) {
      await prisma.session.update({ where: { id: tokenHash }, data: { expiresAt } })
    },

    async deleteSession(tokenHash) {
      await prisma.session.delete({ where: { id: tokenHash } })
    },

    async deleteAllUserSessions(userId) {
      await prisma.session.deleteMany({ where: { userId } })
    },

    // ── otp tokens ──────────────────────────────────────────

    async createOtpToken(data) {
      return prisma.otpToken.create({
        data: { id: crypto.randomUUID(), ...data },
      }) as Promise<OtpToken>
    },

    async findOtpToken(tokenHash, type) {
      return (prisma.otpToken.findFirst({
        where: { tokenHash, type },
      }) as Promise<OtpToken | null>)
    },

    async deleteOtpToken(id) {
      await prisma.otpToken.delete({ where: { id } })
    },

    async deleteExpiredOtpTokens(userId) {
      await prisma.otpToken.deleteMany({ where: { userId } })
    },

    // ── oauth accounts ──────────────────────────────────────

    async createOAuthAccount(data) {
      await prisma.oAuthAccount.create({ data })
    },

    async findOAuthAccount(providerId, providerUserId) {
      return (prisma.oAuthAccount.findUnique({
        where: { providerId_providerUserId: { providerId, providerUserId } },
      }) as Promise<OAuthAccount | null>)
    },

    // ── totp ────────────────────────────────────────────────

    async createTotpCredential(data) {
      return prisma.totpCredential.create({
        data: { ...data, createdAt: new Date() },
      }) as Promise<TotpCredential>
    },

    async findTotpCredential(userId) {
      return (prisma.totpCredential.findUnique({ where: { userId } }) as Promise<TotpCredential | null>)
    },

    async updateTotpLastUsedCounter(userId, counter) {
      await prisma.totpCredential.update({
        where: { userId },
        data: { lastUsedCounter: counter },
      })
    },

    async deleteTotpCredential(userId) {
      await prisma.totpCredential.delete({ where: { userId } })
    },

    // ── backup codes ────────────────────────────────────────

    async createBackupCodes(codes) {
      await prisma.backupCode.createMany({
        data: codes.map(c => ({ ...c, usedAt: null })),
      })
    },

    async findBackupCode(userId, codeHash) {
      return (prisma.backupCode.findFirst({
        where: { userId, codeHash },
      }) as Promise<BackupCode | null>)
    },

    async markBackupCodeUsed(id) {
      await prisma.backupCode.update({ where: { id }, data: { usedAt: new Date() } })
    },

    async deleteAllBackupCodes(userId) {
      await prisma.backupCode.deleteMany({ where: { userId } })
    },
  }
}
