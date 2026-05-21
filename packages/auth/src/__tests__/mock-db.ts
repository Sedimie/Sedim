/**
 * Mock DatabaseAdapter for testing.
 * All state lives in plain Maps — no DB required.
 */
export function createMockDb() {
  const users = new Map<string, import('../../adapters/types.js').User>()
  const sessions = new Map<string, import('../../adapters/types.js').Session>()
  const otpTokens = new Map<string, import('../../adapters/types.js').OtpToken & { id: string }>()
  const refreshTokens = new Map<string, import('../../adapters/types.js').RefreshToken>()
  let userCounter = 0
  let sessionCounter = 0
  let otpCounter = 0

  return {
    users,
    sessions,
    otpTokens,
    refreshTokens,

    async createUser(data: { email: string; passwordHash: string | null }) {
      const user: import('../../adapters/types.js').User = {
        id: `user-${++userCounter}`,
        email: data.email,
        emailVerified: false,
        passwordHash: data.passwordHash,
        failedLoginAttempts: 0,
        lockedAt: null,
        createdAt: new Date(),
      }
      users.set(user.id, user)
      return user
    },

    async findUserByEmail(email: string) {
      return [...users.values()].find(u => u.email === email) ?? null
    },

    async findUserById(id: string) {
      return users.get(id) ?? null
    },

    async updateUser(id: string, data: Partial<Pick<import('../../adapters/types.js').User, 'emailVerified' | 'passwordHash' | 'failedLoginAttempts' | 'lockedAt'>>) {
      const user = users.get(id)
      if (!user) throw new Error(`User ${id} not found`)
      const updated = { ...user, ...data }
      users.set(id, updated)
      return updated
    },

    async createSession(session: import('../../core/session.js').Session) {
      sessions.set(session.id, session)
    },

    async findSession(tokenHash: string) {
      return sessions.get(tokenHash) ?? null
    },

    async findSessionById(sessionId: string) {
      return [...sessions.values()].find(s => s.id === sessionId) ?? null
    },

    async updateSessionExpiry(tokenHash: string, expiresAt: Date) {
      const s = sessions.get(tokenHash)
      if (s) sessions.set(tokenHash, { ...s, expiresAt })
    },

    async deleteSession(tokenHash: string) {
      sessions.delete(tokenHash)
    },

    async deleteSessionById(sessionId: string) {
      const s = [...sessions.values()].find(s => s.id === sessionId)
      if (s) sessions.delete(s.id)
    },

    async deleteAllUserSessions(userId: string) {
      for (const [hash, s] of sessions) {
        if (s.userId === userId) sessions.delete(hash)
      }
    },

    async findAllUserSessions(userId: string) {
      return [...sessions.values()].filter(s => s.userId === userId)
    },

    async createOtpToken(data: Omit<import('../../adapters/types.js').OtpToken, 'id'>) {
      const token: import('../../adapters/types.js').OtpToken & { id: string } = {
        id: `otp-${++otpCounter}`,
        ...data,
      }
      otpTokens.set(token.id, token)
      return token
    },

    async findOtpToken(tokenHash: string, type: import('../../adapters/types.js').OtpToken['type']) {
      return [...otpTokens.values()].find(t => t.tokenHash === tokenHash && t.type === type) ?? null
    },

    async deleteOtpToken(id: string) {
      otpTokens.delete(id)
    },

    async deleteExpiredOtpTokens(_userId: string) {
      // in mock we don't auto-delete
    },

    async createOAuthAccount(_data: import('../../adapters/types.js').OAuthAccount) {
      // no-op for mock
    },

    async findOAuthAccount(_providerId: string, _providerUserId: string) {
      return null
    },

    async createTotpCredential(_data: Omit<import('../../adapters/types.js').TotpCredential, 'createdAt'>) {
      // no-op
    },

    async findTotpCredential(_userId: string) {
      return null
    },

    async updateTotpLastUsedCounter(_userId: string, _counter: number) {
      // no-op
    },

    async deleteTotpCredential(_userId: string) {
      // no-op
    },

    async createBackupCodes(_codes: Omit<import('../../adapters/types.js').BackupCode, 'usedAt'>[]) {
      // no-op
    },

    async findBackupCode(_userId: string, _codeHash: string) {
      return null
    },

    async markBackupCodeUsed(_id: string) {
      // no-op
    },

    async deleteAllBackupCodes(_userId: string) {
      // no-op
    },

    async createRefreshToken(data: Omit<import('../../adapters/types.js').RefreshToken, 'createdAt'>) {
      const rt: import('../../adapters/types.js').RefreshToken = { ...data, createdAt: new Date() }
      refreshTokens.set(rt.id, rt)
    },

    async findRefreshToken(id: string) {
      return refreshTokens.get(id) ?? null
    },

    async deleteRefreshToken(id: string) {
      refreshTokens.delete(id)
    },

    async deleteExpiredRefreshTokens() {
      const now = new Date()
      for (const [id, rt] of refreshTokens) {
        if (rt.expiresAt < now) refreshTokens.delete(id)
      }
    },
  }
}

export type MockDb = ReturnType<typeof createMockDb>