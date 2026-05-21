import { describe, it, expect } from 'vitest'
import { buildMagicLinkEmail, buildPasswordResetEmail } from '../core/email-transport.js'

describe('email transport', () => {
  describe('buildMagicLinkEmail', () => {
    it('builds email with html and text', () => {
      const email = buildMagicLinkEmail({
        email: 'alice@example.com',
        magicLinkUrl: 'https://example.com/auth/magic-link/verify?token=abc123',
      })
      expect(email.to).toBe('alice@example.com')
      expect(email.subject).toBe('Your sign-in link')
      expect(email.html).toContain('alice@example.com')
      expect(email.html).toContain('https://example.com/auth/magic-link/verify?token=abc123')
      expect(email.text).toContain('alice@example.com')
      expect(email.text).toContain('https://example.com/auth/magic-link/verify?token=abc123')
    })

    it('handles missing email gracefully', () => {
      const email = buildMagicLinkEmail({
        email: '',
        magicLinkUrl: 'https://example.com/auth/magic-link/verify?token=abc123',
      })
      expect(email.html).not.toContain('undefined')
      expect(email.text).not.toContain('undefined')
    })
  })

  describe('buildPasswordResetEmail', () => {
    it('builds email with html and text', () => {
      const email = buildPasswordResetEmail({
        email: 'alice@example.com',
        resetUrl: 'https://example.com/auth/password-reset/confirm?token=xyz',
      })
      expect(email.to).toBe('alice@example.com')
      expect(email.subject).toBe('Reset your password')
      expect(email.html).toContain('alice@example.com')
      expect(email.html).toContain('https://example.com/auth/password-reset/confirm?token=xyz')
      expect(email.text).toContain('alice@example.com')
    })
  })
})