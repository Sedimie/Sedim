import { describe, expect, it } from 'vitest'
import * as legacyEmail from '../core/email.js'
import * as emailTransport from '../core/email-transport.js'

describe('email backward compatibility', () => {
  it('re-exports all email transport methods from core/email', () => {
    expect(legacyEmail.sendEmail).toBe(emailTransport.sendEmail)
    expect(legacyEmail.buildMagicLinkEmail).toBe(emailTransport.buildMagicLinkEmail)
    expect(legacyEmail.buildPasswordResetEmail).toBe(emailTransport.buildPasswordResetEmail)
  })

  it('builds templates identically through legacy import', () => {
    const magicEmail = legacyEmail.buildMagicLinkEmail({
      email: 'user@example.com',
      magicLinkUrl: 'https://example.com/magic-link?token=123',
    })

    expect(magicEmail.to).toBe('user@example.com')
    expect(magicEmail.subject).toBe('Your sign-in link')
    expect(magicEmail.html).toContain('https://example.com/magic-link?token=123')

    const resetEmail = legacyEmail.buildPasswordResetEmail({
      email: 'user@example.com',
      resetUrl: 'https://example.com/reset-password?token=456',
    })

    expect(resetEmail.to).toBe('user@example.com')
    expect(resetEmail.subject).toBe('Reset your password')
    expect(resetEmail.html).toContain('https://example.com/reset-password?token=456')
  })
})
