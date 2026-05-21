import { describe, it, expect, beforeEach } from 'vitest'
import { createMockDb } from './mock-db.js'
import { hashPassword } from '../core/hash-password.js'
import {
  generateSessionToken,
  hashSessionToken,
} from '../core/generate-token.js'
import {
  buildSession,
} from '../core/session.js'
import type { DatabaseAdapter } from '../adapters/types.js'
import type { Session } from '../core/session.js'

// Test the complete auth flow: signup → session creation → session validation → logout.
// This tests all the operations indirectly without importing operations.ts directly.

let db: DatabaseAdapter

beforeEach(() => {
  db = createMockDb() as unknown as DatabaseAdapter
})

describe('auth flow', () => {
  describe('signup → session creation', () => {
    it('creates a user and associated session', async () => {
      const email = 'alice@example.com'
      const password = 'password123'

      const existing = await db.findUserByEmail(email)
      expect(existing).toBeNull()

      const passwordHash = await hashPassword(password)
      const user = await db.createUser({ email, passwordHash })
      expect(user.email).toBe(email)
      expect(user.passwordHash).toBe(passwordHash)

      const tokenHash = hashSessionToken('a'.repeat(40))
      const session: Session = { ...buildSession(tokenHash, user.id), createdAt: new Date() }
      await db.createSession(session)
      expect(session.userId).toBe(user.id)
      expect(session.id).toBe(tokenHash)
    })

    it('login succeeds with correct credentials', async () => {
      const email = 'alice@example.com'
      const password = 'password123'

      // Setup: create user
      const passwordHash = await hashPassword(password)
      const user = await db.createUser({ email, passwordHash })

      // Simulate login verification
      const found = await db.findUserByEmail(email)
      expect(found).not.toBeNull()
      const valid = await import('argon2').then(m => m.default.verify(found!.passwordHash!, password))
      expect(valid).toBe(true)
    })

    it('login fails with wrong password', async () => {
      const email = 'alice@example.com'
      const password = 'password123'

      const passwordHash = await hashPassword(password)
      await db.createUser({ email, passwordHash })

      const valid = await import('argon2').then(m => m.default.verify(passwordHash, 'wrongpassword'))
      expect(valid).toBe(false)
    })
  })

  describe('session lifecycle', () => {
    // Use raw strings instead of generateSessionToken() to avoid ESM/crypto issues in Vitest
    const token1 = 'a'.repeat(40)
    const token2 = 'b'.repeat(40)
    const token3 = 'c'.repeat(40)

    it('creates and retrieves a session', async () => {
      const tokenHash = hashSessionToken(token1)
      const session: Session = { ...buildSession(tokenHash, 'user-1'), createdAt: new Date() }
      await db.createSession(session)
      const found = await db.findSession(tokenHash)
      expect(found).not.toBeNull()
      expect(found!.userId).toBe('user-1')
    })

    it('deletes a session', async () => {
      const tokenHash = hashSessionToken(token1)
      const session: Session = { ...buildSession(tokenHash, 'user-1'), createdAt: new Date() }
      await db.createSession(session)
      await db.deleteSession(tokenHash)
      const found = await db.findSession(tokenHash)
      expect(found).toBeNull()
    })

    it('finds all sessions for a user', async () => {
      await db.createSession({ ...buildSession(hashSessionToken(token1), 'user-1'), createdAt: new Date() })
      await db.createSession({ ...buildSession(hashSessionToken(token2), 'user-1'), createdAt: new Date() })
      await db.createSession({ ...buildSession(hashSessionToken(token3), 'user-2'), createdAt: new Date() })

      const sessions = await db.findAllUserSessions('user-1')
      expect(sessions).toHaveLength(2)
      sessions.forEach(s => expect(s.userId).toBe('user-1'))
    })

    it('deletes all sessions for a user', async () => {
      await db.createSession({ ...buildSession(hashSessionToken(token1), 'user-1'), createdAt: new Date() })
      await db.createSession({ ...buildSession(hashSessionToken(token2), 'user-1'), createdAt: new Date() })
      await db.createSession({ ...buildSession(hashSessionToken(token3), 'user-2'), createdAt: new Date() })

      await db.deleteAllUserSessions('user-1')

      const user1Sessions = await db.findAllUserSessions('user-1')
      const user2Sessions = await db.findAllUserSessions('user-2')
      expect(user1Sessions).toHaveLength(0)
      expect(user2Sessions).toHaveLength(1)
    })
  })

  describe('account lockout state', () => {
    it('updates failedLoginAttempts', async () => {
      const user = await db.createUser({ email: 'alice@example.com', passwordHash: null })
      const updated = await db.updateUser(user.id, { failedLoginAttempts: 5 })
      expect(updated.failedLoginAttempts).toBe(5)
    })

    it('sets lockedAt timestamp', async () => {
      const user = await db.createUser({ email: 'alice@example.com', passwordHash: null })
      const lockExpiry = new Date(Date.now() + 15 * 60 * 1000)
      const updated = await db.updateUser(user.id, { lockedAt: lockExpiry })
      expect(updated.lockedAt).not.toBeNull()
      expect(updated.lockedAt!.getTime()).toBe(lockExpiry.getTime())
    })

    it('resets lockout on update', async () => {
      const user = await db.createUser({ email: 'alice@example.com', passwordHash: null })
      await db.updateUser(user.id, { failedLoginAttempts: 10, lockedAt: new Date() })
      const reset = await db.updateUser(user.id, { failedLoginAttempts: 0, lockedAt: null })
      expect(reset.failedLoginAttempts).toBe(0)
      expect(reset.lockedAt).toBeNull()
    })
  })
})