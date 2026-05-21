import { describe, it, expect } from 'vitest'
import { encryptTotpSecret, decryptTotpSecret } from '../core/totp-crypto.js'

const AUTH_SECRET = 'test-auth-secret-32-chars-minimum!!'

describe('totp-crypto', () => {
  describe('encryptTotpSecret', () => {
    it('produces a non-empty encrypted string', () => {
      const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP', AUTH_SECRET)
      expect(encrypted).toBeTruthy()
      expect(encrypted.length).toBeGreaterThan(0)
    })

    it('produces different outputs for same input (random nonce)', () => {
      const e1 = encryptTotpSecret('JBSWY3DPEHPK3PXP', AUTH_SECRET)
      const e2 = encryptTotpSecret('JBSWY3DPEHPK3PXP', AUTH_SECRET)
      expect(e1).not.toBe(e2)
    })

    it('produces output in nonce:tag:ciphertext format', () => {
      const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP', AUTH_SECRET)
      const parts = encrypted.split(':')
      expect(parts.length).toBe(3)
      expect(parts.every(p => p.length > 0)).toBe(true)
    })
  })

  describe('decryptTotpSecret', () => {
    it('round-trips a secret correctly', () => {
      const original = 'JBSWY3DPEHPK3PXP'
      const encrypted = encryptTotpSecret(original, AUTH_SECRET)
      const decrypted = decryptTotpSecret(encrypted, AUTH_SECRET)
      expect(decrypted).toBe(original)
    })

    it('returns null when given a tampered ciphertext', () => {
      const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP', AUTH_SECRET)
      const parts = encrypted.split(':')
      // flip a character in the ciphertext (last part)
      const tampered = parts[0] + ':' + parts[1] + ':' + parts[2].split('').map((c, i) => i === 0 ? (c === 'a' ? 'b' : 'a') : c).join('')
      const decrypted = decryptTotpSecret(tampered, AUTH_SECRET)
      expect(decrypted).toBeNull()
    })

    it('returns null when given a wrong auth secret', () => {
      const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP', AUTH_SECRET)
      const decrypted = decryptTotpSecret(encrypted, 'wrong-secret-32-chars-minimum!!')
      expect(decrypted).toBeNull()
    })

    it('returns null for malformed input', () => {
      expect(decryptTotpSecret('not:valid:format', AUTH_SECRET)).toBeNull()
      expect(decryptTotpSecret('', AUTH_SECRET)).toBeNull()
    })
  })
})