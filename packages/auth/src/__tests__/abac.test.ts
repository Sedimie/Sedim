import { describe, it, expect } from 'vitest'
import { evaluateAbac, buildPolicy, DEFAULT_ABAC_POLICIES } from '../core/abac.js'
import type { AbacPolicy } from '../core/abac.js'

describe('abac', () => {
  describe('evaluateAbac', () => {
    it('returns allow when policy matches', () => {
      const policies: AbacPolicy[] = [
        buildPolicy({ effect: 'allow', subject: { role: 'admin' }, resource: { type: 'post' }, action: 'delete' }),
      ]
      const result = evaluateAbac(policies, { role: 'admin' }, { type: 'post' }, 'delete')
      expect(result.allowed).toBe(true)
    })

    it('returns deny when no policy matches', () => {
      const policies: AbacPolicy[] = [
        buildPolicy({ effect: 'allow', subject: { role: 'admin' }, resource: { type: 'post' }, action: 'delete' }),
      ]
      const result = evaluateAbac(policies, { role: 'user' }, { type: 'post' }, 'delete')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('no-matching-policy')
    })

    it('wildcard action matches any action', () => {
      const policies: AbacPolicy[] = [
        buildPolicy({ effect: 'allow', subject: { role: 'user' }, resource: { type: 'post' }, action: '*' }),
      ]
      expect(evaluateAbac(policies, { role: 'user' }, { type: 'post' }, 'delete').allowed).toBe(true)
      expect(evaluateAbac(policies, { role: 'user' }, { type: 'post' }, 'update').allowed).toBe(true)
    })

    it('wildcard resource matches any resource type', () => {
      const policies: AbacPolicy[] = [
        buildPolicy({ effect: 'allow', subject: { role: 'admin' }, resource: { type: '*' }, action: 'delete' }),
      ]
      expect(evaluateAbac(policies, { role: 'admin' }, { type: 'post' }, 'delete').allowed).toBe(true)
      expect(evaluateAbac(policies, { role: 'admin' }, { type: 'user' }, 'delete').allowed).toBe(true)
    })

    it('first matching policy wins', () => {
      const policies: AbacPolicy[] = [
        buildPolicy({ effect: 'deny', subject: { role: 'user' }, resource: { type: 'post' }, action: 'delete' }),
        buildPolicy({ effect: 'allow', subject: { role: '*' }, resource: { type: '*' }, action: '*' }),
      ]
      const result = evaluateAbac(policies, { role: 'user' }, { type: 'post' }, 'delete')
      expect(result.allowed).toBe(false)
      expect(result.matchedPolicy?.id).toBe(policies[0].id)
    })

    it('skips policies with non-matching subject attributes', () => {
      const policies: AbacPolicy[] = [
        buildPolicy({ effect: 'allow', subject: { role: 'admin' }, resource: { type: 'post' }, action: 'delete' }),
        buildPolicy({ effect: 'allow', subject: {}, resource: { type: '*' }, action: 'read' }),
      ]
      const result = evaluateAbac(policies, { role: 'user' }, { type: 'comment' }, 'read')
      expect(result.allowed).toBe(true)
    })

    it('returns matchedPolicy on allow', () => {
      const policies: AbacPolicy[] = [
        buildPolicy({ effect: 'allow', subject: { role: 'admin' }, resource: { type: 'post' }, action: 'delete' }),
      ]
      const result = evaluateAbac(policies, { role: 'admin' }, { type: 'post' }, 'delete')
      expect(result.allowed).toBe(true)
      expect(result.matchedPolicy?.effect).toBe('allow')
    })
  })

  describe('buildPolicy', () => {
    it('creates a policy with a generated id if not provided', () => {
      const policy = buildPolicy({ effect: 'allow' })
      expect(policy.id).toBeTruthy()
    })

    it('uses provided id and description', () => {
      const policy = buildPolicy({ id: 'my-id', description: 'my description', effect: 'deny' })
      expect(policy.id).toBe('my-id')
      expect(policy.description).toBe('my description')
      expect(policy.effect).toBe('deny')
    })
  })

  describe('DEFAULT_ABAC_POLICIES', () => {
    it('contains deny-unverified-email policy', () => {
      const denyPolicy = DEFAULT_ABAC_POLICIES.find(p => p.id === 'deny-unverified-email')
      expect(denyPolicy).toBeTruthy()
      expect(denyPolicy?.effect).toBe('deny')
      expect(denyPolicy?.subject?.emailVerified).toBe(false)
    })

    it('contains allow-admin-all policy', () => {
      const adminPolicy = DEFAULT_ABAC_POLICIES.find(p => p.id === 'allow-admin-all')
      expect(adminPolicy).toBeTruthy()
      expect(adminPolicy?.effect).toBe('allow')
      expect(adminPolicy?.subject?.role).toBe('admin')
    })
  })
})