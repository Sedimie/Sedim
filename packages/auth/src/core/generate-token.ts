import { generateRandomString } from '@oslojs/crypto/random'
import type { RandomReader } from '@oslojs/crypto/random'
import { encodeHexLowerCase } from '@oslojs/encoding'
import { sha256 } from '@oslojs/crypto/sha2'

// Web Crypto API — available in Node 18+, Deno, Bun, edge runtimes
const secureRandom: RandomReader = {
  read(bytes: Uint8Array): void {
    // Mutate bytes in-place with random values. The void suppresses the
    // Uint8Array<ArrayBufferLike> return type incompatibility with ArrayBufferView<ArrayBuffer>.
    void bytes.set(crypto.getRandomValues(new Uint8Array(bytes.length)))
  },
}

const LOWER_ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789'
const UPPER_ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const BACKUP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Generates a session token to send to the client (cookie value).
 * Never store this directly — store hashSessionToken(token) instead.
 */
export function generateSessionToken(): string {
  return generateRandomString(secureRandom, LOWER_ALNUM, 40)
}

/**
 * SHA-256 hashes a session token for DB storage.
 * On each request: hash the cookie value, look up the hash in sessions table.
 */
export function hashSessionToken(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)))
}

/** Generates a token for magic links, email verification, and password reset. Single-use. */
export function generateOtpToken(): string {
  return generateRandomString(secureRandom, LOWER_ALNUM, 64)
}

/** Generates a PKCE code verifier. Store server-side before redirecting to OAuth provider. */
export function generateCodeVerifier(): string {
  return generateRandomString(secureRandom, UPPER_ALNUM, 64)
}

/**
 * Generates backup codes for MFA recovery. Format: XXXX-XXXX.
 * Hash each code before storing — use hashBackupCode(code).
 */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const a = generateRandomString(secureRandom, BACKUP_CHARS, 4)
    const b = generateRandomString(secureRandom, BACKUP_CHARS, 4)
    return `${a}-${b}`
  })
}

/** Hashes a backup code for DB storage. Normalises to uppercase before hashing. */
export function hashBackupCode(code: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(code.toUpperCase())))
}
