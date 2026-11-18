---
title: Auth API and Types
description: Complete API and type reference for @sedim/auth core, operations, adapters, and client libraries.
slug: auth/api
---

## Overview

The `@sedim/auth` module stamps production-ready authentication directly into your application. This reference documents all core operations, cryptographic helpers, framework adapter bindings, and database interfaces.

---

## Core Operations

All business logic operations reside in `adapters/framework/operations.ts`. They are framework-agnostic and operate against any implementation of the `DatabaseAdapter` interface.

### `signupWithPassword`

Creates a new user account with argon2id password hashing and provisions an initial active session.

```typescript
function signupWithPassword(
  db: DatabaseAdapter,
  email: string,
  ip: string,
  password: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>>
```

- **Parameters**:
  - `db`: The active database adapter.
  - `email`: Normalized user email address.
  - `ip`: Client IP address (used for rate-limiting).
  - `password`: Plaintext password.
- **Returns**: Result object containing sanitized user, raw session token, and session metadata, or `{ ok: false, error: 'rate-limited' | 'email-taken' }`.

### `loginWithPassword`

Validates user credentials against stored argon2id password hash, checks account lockout state, and handles TOTP 2FA challenge flow.

```typescript
function loginWithPassword(
  db: DatabaseAdapter,
  ip: string,
  email: string,
  password: string,
): Promise<AuthResult<{ user: User; token: string; session: Session; needsTotp: boolean }>>
```

- If `needsTotp: true`, the user must submit a code to `/totp/verify` or `/totp/backup` before a full session cookie is issued.

### `validateRequest`

Validates an incoming session token from cookies or authorization headers. Automatically handles session rolling extensions if the session is near expiration.

```typescript
function validateRequest(
  db: DatabaseAdapter,
  token: string | null,
): Promise<{ user: User; session: Session } | null>
```

- Returns `null` if the token is null, invalid, or expired.

### `logout`

Terminates the current session by deleting the token hash from persistence.

```typescript
function logout(
  db: DatabaseAdapter,
  sessionId: string,
): Promise<void>
```

### `createMagicLink` & `verifyMagicLink`

Passwordless email authentication with single-use cryptographic tokens.

```typescript
function createMagicLink(
  db: DatabaseAdapter,
  email: string,
  ip: string,
): Promise<AuthResult<{ token: string; expiresAt: Date }>>

function verifyMagicLink(
  db: DatabaseAdapter,
  token: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>>
```

### `createOAuthRedirect` & `handleOAuthCallback`

Standard authorization code flow with PKCE code verifier and cryptographic state verification. Supported providers: Google, GitHub, Discord.

```typescript
function createOAuthRedirect(
  config: ResolvedAuthConfig,
  providerName: string,
): AuthResult<{ url: URL; state: string; codeVerifier: string }>

function handleOAuthCallback(
  db: DatabaseAdapter,
  config: ResolvedAuthConfig,
  providerName: string,
  code: string,
  codeVerifier: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>>
```

### `completeTotpLogin` & `verifyBackupCode`

Two-factor authentication verification using RFC 6238 TOTP algorithms and single-use hashed recovery backup codes.

```typescript
function completeTotpLogin(
  db: DatabaseAdapter,
  secret: string,
  userId: string,
  code: string,
  ip: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>>

function verifyBackupCode(
  db: DatabaseAdapter,
  userId: string,
  code: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>>
```

### `listUserSessions`, `revokeSession` & `revokeAllSessions`

Multi-device session management and remote revocation.

```typescript
function listUserSessions(
  db: DatabaseAdapter,
  userId: string,
): Promise<Session[]>

function revokeSession(
  db: DatabaseAdapter,
  sessionId: string,
): Promise<void>

function revokeAllSessions(
  db: DatabaseAdapter,
  userId: string,
): Promise<void>
```

---

## Cryptography & Token Helpers

Located in `core/`:

| Helper | File | Purpose |
|---|---|---|
| `hashPassword(password)` | `core/hash-password.ts` | Argon2id password hash generation with secure salt. |
| `verifyPassword(hash, password)` | `core/hash-password.ts` | Constant-time Argon2id password hash verification. |
| `generateSessionToken()` | `core/generate-token.ts` | Generates 32 bytes of cryptographically secure random bytes encoded as base32. |
| `hashSessionToken(token)` | `core/generate-token.ts` | SHA-256 hash of token for safe database persistence. |
| `createTotpKey()` | `core/totp.ts` | Generates Base32-encoded HMAC-SHA1 secret key and `otpauth://` URI. |
| `verifyTotpCode(secret, code)` | `core/totp.ts` | RFC 6238 TOTP verification with clock drift tolerance. |

---

## Database Adapter Interface

Any ORM adapter implements the `DatabaseAdapter` interface defined in `adapters/types.ts`:

```typescript
export interface DatabaseAdapter {
  // Users
  createUser(data: { email: string; passwordHash: string | null }): Promise<User>
  findUserByEmail(email: string): Promise<User | null>
  findUserById(id: string): Promise<User | null>
  updateUser(id: string, data: Partial<User>): Promise<User>

  // Sessions
  createSession(session: Session): Promise<void>
  findSession(tokenHash: string): Promise<Session | null>
  findSessionById(sessionId: string): Promise<Session | null>
  updateSessionExpiry(tokenHash: string, expiresAt: Date): Promise<void>
  deleteSession(tokenHash: string): Promise<void>
  deleteSessionById(sessionId: string): Promise<void>
  deleteAllUserSessions(userId: string): Promise<void>
  findAllUserSessions(userId: string): Promise<Session[]>

  // OTP Tokens (magic link / email verification)
  createOtpToken(data: Omit<OtpToken, 'id'>): Promise<OtpToken>
  findOtpToken(tokenHash: string, type: OtpToken['type']): Promise<OtpToken | null>
  deleteOtpToken(id: string): Promise<void>

  // OAuth Accounts
  createOAuthAccount(data: Omit<OAuthAccount, 'id'>): Promise<OAuthAccount>
  findOAuthAccount(provider: string, providerAccountId: string): Promise<OAuthAccount | null>

  // TOTP & 2FA
  createTotpCredential(data: Omit<TotpCredential, 'id'>): Promise<TotpCredential>
  findTotpCredential(userId: string): Promise<TotpCredential | null>
  createBackupCodes(codes: Omit<BackupCode, 'id'>[]): Promise<void>
  consumeBackupCode(userId: string, codeHash: string): Promise<boolean>
}
```

First-party implementations include:
- `createDrizzleAdapter(db, schema)`: Supports PostgreSQL, MySQL, and SQLite dialects.
- `createPrismaAdapter(prisma)`: Supports PostgreSQL, MySQL, and SQLite via Prisma Client.

---

## Framework Adapters

### Next.js (App Router)
```typescript
import { createNextjsAuthHandlers, getSession } from '@/sedim/auth'

// Route Handler: src/app/api/auth/[...all]/route.ts
export const { GET, POST } = createNextjsAuthHandlers(authConfig)

// Server Component / Server Action Session Lookup
const { user, session } = await getSession(authConfig) ?? {}
```

### Express
```typescript
import { createExpressAuthRouter, createSessionMiddleware, expressRequireAuth } from './sedim/auth'

app.use(createSessionMiddleware(authConfig))
app.use('/auth', createExpressAuthRouter(authConfig))
app.get('/protected', expressRequireAuth, (req, res) => {
  res.json({ user: res.locals.authUser })
})
```

### Hono
```typescript
import { createHonoAuthRoutes, createHonoSessionMiddleware, honoRequireAuth } from './sedim/auth'

app.use('*', createHonoSessionMiddleware(authConfig))
app.route('/auth', createHonoAuthRoutes(authConfig))
app.get('/protected', honoRequireAuth, (c) => {
  return c.json({ user: c.var.user })
})
```

### Fastify
```typescript
import { createFastifyAuthPlugin, createFastifySessionHook, fastifyRequireAuth } from './sedim/auth'

app.addHook('onRequest', createFastifySessionHook(authConfig))
app.register(createFastifyAuthPlugin(authConfig), { prefix: '/auth' })
app.get('/protected', { preHandler: [fastifyRequireAuth] }, async (req) => {
  return { user: req.authUser }
})
```

---

## Client API (`auth-client.ts`)

Pure TypeScript fetch client generated into frontend companion apps or Next.js clients:

```typescript
import { login, signup, logout, getSession, redirectToOAuth } from '@/sedim/auth'

// Signup
const { user } = await signup({ email: 'user@example.com', password: 'secretpassword' })

// Login
const result = await login({ email: 'user@example.com', password: 'secretpassword' })
if (result.requiresTotp) {
  // redirect or prompt for 2FA code
}

// Client-side Session Check
const user = await getSession()

// Logout
await logout()
```
