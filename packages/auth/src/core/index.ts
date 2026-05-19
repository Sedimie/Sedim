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

export type { Session, SessionValidationResult, SessionInfo } from './session.js'

export { generatePkcePair, deriveCodeChallenge, buildAuthorizationUrl } from './pkce.js'

export {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  buildTotpUri,
} from './totp.js'

export {
  createRateLimiter,
  loginLimiter,
  signupLimiter,
  emailLimiter,
  totpLimiter,
  buildLoginKey,
  buildEmailKey,
  buildTotpKey,
} from './rate-limit.js'

export type { RateLimiter, RateLimitConfig } from './rate-limit.js'

export {
  hasPermission,
  hasPermissions,
  requireRole,
  hasMinimumRole,
  ROLE_DEFINITIONS,
} from './rbac.js'

export type { Permission, RoleDefinition, Action as RbacAction, Resource as RbacResource } from './rbac.js'

export {
  evaluateAbac,
  evaluateAbacWithDefaults,
  buildPolicy,
  DEFAULT_ABAC_POLICIES,
} from './abac.js'

export type {
  AbacPolicy,
  AbacResult,
  AbacContext,
  SubjectAttributes,
  ResourceAttributes,
  EnvironmentAttributes,
} from './abac.js'

export {
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  hashRefreshToken,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from './jwt.js'

export type { JwtAccessToken, RefreshTokenRecord } from './jwt.js'
