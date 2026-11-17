import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildMagicLinkEmail,
  buildPasswordResetEmail,
  sendEmail,
  createEmailTransport,
  type EmailOptions,
} from '../core/email-transport.js'
import * as legacyEmailShim from '../core/email.js'

describe('email transport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

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

  describe('sendEmail multi-transport dispatch', () => {
    const dummyOpts: EmailOptions = {
      to: 'bob@example.com',
      subject: 'Hello',
      html: '<p>Test</p>',
      text: 'Test',
    }

    it('throws when resend config is missing', async () => {
      await expect(
        sendEmail(dummyOpts, { transport: 'resend' }),
      ).rejects.toThrow('Resend transport requires { apiKey }')
    })

    it('throws when postmark config is missing', async () => {
      await expect(
        sendEmail(dummyOpts, { transport: 'postmark' }),
      ).rejects.toThrow('Postmark transport requires { apiKey }')
    })

    it('throws when ses config is missing', async () => {
      await expect(
        sendEmail(dummyOpts, { transport: 'ses' }),
      ).rejects.toThrow('SES transport requires { region, from }')
    })

    it('throws when nodemailer smtp config is missing', async () => {
      await expect(
        sendEmail(dummyOpts, { transport: 'nodemailer' }),
      ).rejects.toThrow('Nodemailer transport requires { host, port, user, pass }')
    })

    it('dispatches to Resend via fetch', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'resend-123' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      await sendEmail(dummyOpts, {
        transport: 'resend',
        resend: { apiKey: 're_12345' },
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.resend.com/emails')
      expect(init.method).toBe('POST')
      expect(init.headers['Authorization']).toBe('Bearer re_12345')
      const payload = JSON.parse(init.body)
      expect(payload.to).toBe('bob@example.com')
      expect(payload.subject).toBe('Hello')
    })

    it('throws error when Resend returns non-ok status', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API Key',
      })
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        sendEmail(dummyOpts, {
          transport: 'resend',
          resend: { apiKey: 'bad_key' },
        }),
      ).rejects.toThrow('Resend error: 401 Invalid API Key')
    })

    it('dispatches to Postmark via fetch', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ MessageID: 'pm-123' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      await sendEmail(dummyOpts, {
        transport: 'postmark',
        postmark: { apiKey: 'pm_token' },
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.postmarkapp.com/email')
      expect(init.headers['Authorization']).toBe('Bearer pm_token')
      const payload = JSON.parse(init.body)
      expect(payload.To).toBe('bob@example.com')
      expect(payload.Subject).toBe('Hello')
    })
  })

  describe('createEmailTransport helper', () => {
    it('creates a transport instance bound to config', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      const transport = createEmailTransport({
        transport: 'resend',
        resend: { apiKey: 'key_abc' },
        defaultFrom: 'Auth <auth@myapp.com>',
      })

      expect(transport.config.transport).toBe('resend')
      await transport.send({
        to: 'user@domain.com',
        subject: 'Welcome',
        html: '<p>Welcome</p>',
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [, init] = fetchMock.mock.calls[0]
      const payload = JSON.parse(init.body)
      expect(payload.from).toBe('Auth <auth@myapp.com>')
      expect(payload.to).toBe('user@domain.com')
    })
  })

  describe('backwards compatibility shim (core/email.ts)', () => {
    it('re-exports all email transport functions and helpers from email.ts', () => {
      expect(typeof legacyEmailShim.sendEmail).toBe('function')
      expect(typeof legacyEmailShim.createEmailTransport).toBe('function')
      expect(typeof legacyEmailShim.buildMagicLinkEmail).toBe('function')
      expect(typeof legacyEmailShim.buildPasswordResetEmail).toBe('function')
    })
  })
})
