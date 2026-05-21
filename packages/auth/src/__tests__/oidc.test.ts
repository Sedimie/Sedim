import { describe, it, expect } from 'vitest'
import { decodeIdTokenUnverified, extractEmailFromClaims, hasOIDC } from '../core/oidc.js'
import type { OIDCClaims } from '../core/oidc.js'

describe('OIDC utilities', () => {
  describe('decodeIdTokenUnverified', () => {
    it('decodes a raw JWT payload', () => {
      // HS256 signed token — header: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
      // payload: { "sub": "user-123", "email": "alice@example.com", "email_verified": true, "aud": "client-id", "iss": "https://issuer.example.com", "exp": 9999999999, "iat": 1000000000 }
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiYXVkIjoiY2xpZW50LWlkIiwiaXNzIjoiaHR0cHM6Ly9pc3N1ZXIuZXhhbXBsZS5jb20iLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTAwMDAwMDAwMH0.foobar'
      const claims = decodeIdTokenUnverified(token)
      expect(claims.sub).toBe('user-123')
      expect(claims.email).toBe('alice@example.com')
      expect(claims.email_verified).toBe(true)
      expect(claims.iss).toBe('https://issuer.example.com')
    })

    it('throws on malformed token', () => {
      expect(() => decodeIdTokenUnverified('not.a.jwt')).toThrow()
    })
  })

  describe('extractEmailFromClaims', () => {
    it('extracts email and verified flag', () => {
      const claims: OIDCClaims = {
        sub: 'user-123',
        email: 'alice@example.com',
        email_verified: true,
        aud: 'client-id',
        iss: 'https://issuer.example.com',
        exp: 9999999999,
        iat: 1000000000,
      }
      const result = extractEmailFromClaims(claims)
      expect(result).toEqual({ email: 'alice@example.com', emailVerified: true })
    })

    it('returns null when no email in claims', () => {
      const claims: OIDCClaims = {
        sub: 'user-123',
        aud: 'client-id',
        iss: 'https://issuer.example.com',
        exp: 9999999999,
        iat: 1000000000,
      }
      const result = extractEmailFromClaims(claims)
      expect(result).toBeNull()
    })
  })

  describe('hasOIDC', () => {
    it('returns true when discoveryUrl is set', () => {
      const provider = { discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration' }
      expect(hasOIDC(provider)).toBe(true)
    })

    it('returns false when discoveryUrl is absent', () => {
      const provider = { discoveryUrl: undefined }
      expect(hasOIDC(provider)).toBe(false)
    })
  })
})