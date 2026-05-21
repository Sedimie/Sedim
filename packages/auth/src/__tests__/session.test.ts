import { describe, it, expect } from 'vitest'
import { buildSession, validateSession } from '../core/session.js'
import { SESSION_DURATION_MS } from '../core/session.js'

describe('session', () => {
  describe('buildSession', () => {
    it('creates a session with the given token hash as id', () => {
      const session = buildSession('token-hash-abc', 'user-1')
      expect(session.id).toBe('token-hash-abc')
      expect(session.userId).toBe('user-1')
    })

    it('sets expiresAt to 30 days from now', () => {
      const before = Date.now()
      const session = buildSession('hash', 'user-1')
      const after = Date.now()
      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + SESSION_DURATION_MS)
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(after + SESSION_DURATION_MS)
    })

    it('marks fresh as true on creation', () => {
      const session = buildSession('hash', 'user-1')
      expect(session.fresh).toBe(true)
    })

    it('sets createdAt', () => {
      const before = Date.now()
      const session = buildSession('hash', 'user-1')
      const after = Date.now()
      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(session.createdAt.getTime()).toBeLessThanOrEqual(after)
    })
  })

  describe('validateSession', () => {
    it('returns the session when valid and not past halfway point', () => {
      const session = buildSession('hash', 'user-1')
      const result = validateSession(session)
      expect(result).not.toBeNull()
      expect(result!.extended).toBe(false)
      expect(result!.session.id).toBe(session.id)
    })

    it('extends the session when past the halfway point', () => {
      // Session expires 7 days from now — well past the midpoint (15 days) of a 30-day window.
      // The validateSession check: now >= (expiresAt - SESSION_DURATION_MS/2) → true
      const futureSession = {
        ...buildSession('hash', 'user-1'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
      const result = validateSession(futureSession)
      expect(result).not.toBeNull()
      expect(result!.extended).toBe(true)
      expect(result!.session.fresh).toBe(false)
    })

    it('returns null when session is expired', () => {
      const expired = { ...buildSession('hash', 'user-1'), expiresAt: new Date(Date.now() - 1000) }
      const result = validateSession(expired)
      expect(result).toBeNull()
    })

    it('returns null exactly at expiry boundary', () => {
      const boundary = Date.now() - 1
      const session = { ...buildSession('hash', 'user-1'), expiresAt: new Date(boundary) }
      const result = validateSession(session)
      expect(result).toBeNull()
    })
  })
})