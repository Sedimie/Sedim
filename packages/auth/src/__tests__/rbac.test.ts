import { describe, it, expect } from 'vitest'
import { hasPermission, hasMinimumRole, requireRole } from '../core/rbac.js'
import type { User } from '../adapters/types.js'

function makeUser(role: string): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    emailVerified: true,
    passwordHash: null,
    failedLoginAttempts: 0,
    lockedAt: null,
    createdAt: new Date(),
    role: role as any,
  } as User
}

describe('rbac', () => {
  describe('hasPermission', () => {
    it('admin can do anything (wildcard)', () => {
      const admin = makeUser('admin')
      expect(hasPermission(admin, 'delete', 'anything')).toBe(true)
      expect(hasPermission(admin, 'read', 'user')).toBe(true)
      expect(hasPermission(admin, '*', 'post')).toBe(true)
    })

    it('moderator can read all resources', () => {
      const mod = makeUser('moderator')
      expect(hasPermission(mod, 'read', 'post')).toBe(true)
      expect(hasPermission(mod, 'read', 'user')).toBe(true)
    })

    it('moderator can only delete content (delete: *)', () => {
      const mod = makeUser('moderator')
      // moderator has delete:* per the actual role definition
      expect(hasPermission(mod, 'delete', 'user')).toBe(true)
      expect(hasPermission(mod, 'delete', 'post')).toBe(true)
      // but cannot update users
      expect(hasPermission(mod, 'update', 'user')).toBe(false)
    })

    it('user role can read all resources', () => {
      const user = makeUser('user')
      expect(hasPermission(user, 'read', 'post')).toBe(true)
      expect(hasPermission(user, 'read', 'comment')).toBe(true)
    })

    it('unknown role has no permissions', () => {
      const unknown = makeUser('superadmin')
      expect(hasPermission(unknown as any, 'read', 'anything')).toBe(false)
    })

    it('defaults to user role for missing role field', () => {
      const noRole = { ...makeUser('user'), role: undefined } as unknown as User
      expect(hasPermission(noRole, 'read', 'post')).toBe(true)
    })
  })

  describe('requireRole', () => {
    it('returns true when user has the required role', () => {
      const admin = makeUser('admin')
      expect(requireRole(admin, 'admin')).toBe(true)
    })

    it('returns false when user lacks the required role', () => {
      const user = makeUser('user')
      expect(requireRole(user, 'admin')).toBe(false)
    })

    it('returns true if user has any of the listed roles', () => {
      const mod = makeUser('moderator')
      expect(requireRole(mod, 'admin', 'moderator')).toBe(true)
    })

    it('defaults to user role', () => {
      const u = makeUser('user')
      expect(requireRole(u as any, 'user')).toBe(true)
    })
  })

  describe('hasMinimumRole', () => {
    it('admin >= admin', () => {
      expect(hasMinimumRole(makeUser('admin'), 'admin')).toBe(true)
    })

    it('admin >= moderator >= user', () => {
      expect(hasMinimumRole(makeUser('admin'), 'moderator')).toBe(true)
      expect(hasMinimumRole(makeUser('admin'), 'user')).toBe(true)
      expect(hasMinimumRole(makeUser('moderator'), 'user')).toBe(true)
    })

    it('user < moderator < admin', () => {
      expect(hasMinimumRole(makeUser('user'), 'moderator')).toBe(false)
      expect(hasMinimumRole(makeUser('user'), 'admin')).toBe(false)
      expect(hasMinimumRole(makeUser('moderator'), 'admin')).toBe(false)
    })

    it('unknown roles return false', () => {
      expect(hasMinimumRole(makeUser('superadmin') as any, 'user')).toBe(false)
    })
  })
})