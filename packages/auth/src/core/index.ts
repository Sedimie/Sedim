// ── Auth core — public API ────────────────────────────────────
// Pure functions. No framework. No DB. No side effects.
// Everything here is injectable and testable in isolation.

export { hashPassword, verifyPassword, needsRehash } from './hash-password.js'

export {
  generateSessionToken,
  hashSessionToken,
  generateOtpToken,
  generateCodeVerifier,
  generateBackupCodes,
  hashBackupCode,
} from './generate-token.js'

export {
  buildSession,
  validateSession,
  SESSION_DURATION_MS,
} from './session.js'

export type { Session, SessionValidationResult } from './session.js'

export { generatePkcePair, deriveCodeChallenge, buildAuthorizationUrl } from './pkce.js'

export {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  buildTotpUri,
} from './totp.js'
