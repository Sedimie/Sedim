import { describe, it, expect } from 'vitest'
import {
  generateSessionToken,
  hashSessionToken,
  generateOtpToken,
  hashBackupCode,
  generateBackupCodes,
  generateCodeVerifier,
} from '../core/generate-token.js'

describe('generate-token', () => {
  describe('generateSessionToken', () => {
    it('produces a 40-character alphanumeric token', () => {
      const token = generateSessionToken()
      expect(token.length).toBe(40)
      expect(/^[a-z0-9]+$/.test(token)).toBe(true)
    })

    it('produces different tokens on each call', () => {
      const t1 = generateSessionToken()
      const t2 = generateSessionToken()
      expect(t1).not.toBe(t2)
    })
  })

  describe('hashSessionToken', () => {
    it('produces a hex string', () => {
      const hash = hashSessionToken(generateSessionToken())
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
    })

    it('produces a consistent hash for the same input', () => {
      const token = 'abc123'
      const h1 = hashSessionToken(token)
      const h2 = hashSessionToken(token)
      expect(h1).toBe(h2)
    })

    it('produces different hashes for different inputs', () => {
      const h1 = hashSessionToken('input1')
      const h2 = hashSessionToken('input2')
      expect(h1).not.toBe(h2)
    })
  })

  describe('generateOtpToken', () => {
    it('produces a 64-character token', () => {
      const token = generateOtpToken()
      expect(token.length).toBe(64)
    })

    it('produces different tokens on each call', () => {
      const t1 = generateOtpToken()
      const t2 = generateOtpToken()
      expect(t1).not.toBe(t2)
    })
  })

  describe('generateBackupCodes', () => {
    it('produces the requested number of codes', () => {
      const codes = generateBackupCodes(10)
      expect(codes.length).toBe(10)
    })

    it('each code is in XXXX-XXXX format', () => {
      const codes = generateBackupCodes(5)
      codes.forEach(code => {
        expect(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)).toBe(true)
      })
    })

    it('produces no duplicate codes', () => {
      const codes = generateBackupCodes(100)
      const unique = new Set(codes)
      expect(unique.size).toBe(100)
    })
  })

  describe('hashBackupCode', () => {
    it('normalises to uppercase before hashing', () => {
      const h1 = hashBackupCode('abcd-1234')
      const h2 = hashBackupCode('ABCD-1234')
      expect(h1).toBe(h2)
    })

    it('produces a consistent hex hash', () => {
      const h = hashBackupCode('WXYZ-9876')
      expect(/^[0-9a-f]+$/.test(h)).toBe(true)
    })
  })

  describe('generateCodeVerifier', () => {
    it('produces a 64-character alphanumeric string', () => {
      const verifier = generateCodeVerifier()
      expect(verifier.length).toBe(64)
      // PKCE spec allows upper/lower letters, digits, '-', '.', '_', '~'
      expect(/^[A-Za-z0-9._~-]+$/.test(verifier)).toBe(true)
    })
  })
})