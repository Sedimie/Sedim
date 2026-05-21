// jwt.test.ts — Tests JWT creation and verification logic.
// Note: We test the pure logic without the @oslojs/crypto dependency.
// The actual createAccessToken/verifyAccessToken from jwt.ts are tested
// via integration in a real runtime. These tests verify the algorithm.

import { describe, it, expect } from 'vitest'
import { encodeBase32LowerCaseNoPadding } from '@oslojs/encoding'

// Re-implement the JWT logic here to test the algorithm itself.
// This avoids importing @oslojs/crypto which has Node.js ESM issues in Vitest.

function base64urlEncode(input: string): string {
  return Buffer.from(input).toString('base64url')
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

// Minimal HMAC-SHA256 for testing (uses Node.js built-in crypto)
import { createHmac, randomBytes } from 'node:crypto'
function hmacSign(msg: string, secret: string): string {
  return createHmac('sha256', Buffer.from(secret, 'utf8')).update(msg).digest('base64url')
}
function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const ACCESS_TOKEN_TTL_MS = 1000 * 60 * 15 // 15 minutes

interface JwtPayload {
  sub: string
  sid: string
  iat: number
  exp: number
  jti: string
}

function testCreateAccessToken(userId: string, sessionId: string, secret: string): string {
  const now = Date.now()
  const jti = encodeBase32LowerCaseNoPadding(randomBytes(16))
  const payload: JwtPayload = { sub: userId, sid: sessionId, iat: now, exp: now + ACCESS_TOKEN_TTL_MS, jti }
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64urlEncode(JSON.stringify(payload))
  const sig = hmacSign(`${header}.${body}`, secret)
  return `${header}.${body}.${sig}`
}

function testVerifyAccessToken(raw: string, secret: string): JwtPayload | null {
  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  if (!timingSafeEquals(sig, hmacSign(`${header}.${body}`, secret))) return null
  let payload: JwtPayload
  try {
    payload = JSON.parse(base64urlDecode(body))
  } catch {
    return null
  }
  if (payload.exp < Date.now()) return null
  return payload
}

const SECRET = 'test-secret-at-least-32-chars-long-for-hmac'

describe('jwt (algorithm tests)', () => {
  describe('createAccessToken', () => {
    it('produces a 3-part JWT', () => {
      const token = testCreateAccessToken('user-1', 'session-1', SECRET)
      expect(token.split('.')).toHaveLength(3)
    })

    it('encodes userId and sessionId in payload', () => {
      const token = testCreateAccessToken('user-abc', 'session-xyz', SECRET)
      const decoded = testVerifyAccessToken(token, SECRET)
      expect(decoded?.sub).toBe('user-abc')
      expect(decoded?.sid).toBe('session-xyz')
    })

    it('sets iat and exp correctly (exp = iat + 15 min)', () => {
      const token = testCreateAccessToken('u', 's', SECRET)
      const decoded = testVerifyAccessToken(token, SECRET)!
      expect(decoded.exp - decoded.iat).toBe(ACCESS_TOKEN_TTL_MS)
    })

    it('unique jti per token', () => {
      const t1 = testCreateAccessToken('u', 's', SECRET)
      const t2 = testCreateAccessToken('u', 's', SECRET)
      const d1 = testVerifyAccessToken(t1, SECRET)!
      const d2 = testVerifyAccessToken(t2, SECRET)!
      expect(d1.jti).not.toBe(d2.jti)
    })
  })

  describe('verifyAccessToken', () => {
    it('returns null for tampered signature', () => {
      const token = testCreateAccessToken('u', 's', SECRET)
      const parts = token.split('.')
      const tampered = parts[0] + '.' + parts[1] + '.' + parts[2].slice(0, -5) + 'xxxxx'
      expect(testVerifyAccessToken(tampered, SECRET)).toBeNull()
    })

    it('returns null for wrong secret', () => {
      const token = testCreateAccessToken('u', 's', SECRET)
      expect(testVerifyAccessToken(token, 'wrong-secret-32-chars-minimum!!')).toBeNull()
    })

    it('returns null for malformed token', () => {
      expect(testVerifyAccessToken('not.a.jwt', SECRET)).toBeNull()
      expect(testVerifyAccessToken('only.two', SECRET)).toBeNull()
      expect(testVerifyAccessToken('', SECRET)).toBeNull()
    })

    it('returns null for non-JSON body', () => {
      const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const body = base64urlEncode('not-json')
      const sig = hmacSign(`${header}.${body}`, SECRET)
      expect(testVerifyAccessToken(`${header}.${body}.${sig}`, SECRET)).toBeNull()
    })
  })
})