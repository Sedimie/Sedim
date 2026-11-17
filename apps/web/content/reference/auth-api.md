---
title: Auth API & Types Reference
description: Complete reference for @sedim/auth operations, data types, adapters, and framework entrypoints.
slug: reference/auth-api
---

# Auth API & Types Reference

This document provides a comprehensive reference for the core operations, interfaces, framework adapters, and persistence models provided by `@sedim/auth` and stamped into user projects.

---

## 1. Core Data Models

These models define the database persistence contract and are exported from `src/sedim/auth/adapters/types.ts`.

### `User`
```typescript
export interface User {
  id: string
  email: string
  emailVerified: boolean
  passwordHash: string | null
  failedLoginAttempts: number
  lockedAt: Date | null
  createdAt: Date
}
```

### `Session`
```typescript
export interface Session {
  id: string
  userId: string
  expiresAt: Date
  fresh?: boolean
}
```

### `OAuthAccount`
```typescript
export interface OAuthAccount {
  provider: 'google' | 'github' | 'discord'
  providerUserId: string
  userId: string
  createdAt: Date
}
```

### `TotpCredential`
```typescript
export interface TotpCredential {
  userId: string
  encryptedSecret: string
  verifiedAt: Date | null
  createdAt: Date
}
```

---

## 2. Core Authentication Operations

All operations return a discriminated union `AuthResult<T>`:
```typescript
export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthError }
```

### `signupWithPassword`
Registers a new user and provisions a session. Enforces Argon2id hashing and IP-based rate limiting.
```typescript
export async function signupWithPassword(
  db: DatabaseAdapter,
  email: string,
  ip: string,
  password: string,
): Promise<AuthResult<{ user: User; session: Session; token: string }>>
```

### `loginWithPassword`
Verifies user password and checks for account lockouts. If TOTP is configured, returns `needsTotp: true`.
```typescript
export async function loginWithPassword(
  db: DatabaseAdapter,
  ip: string,
  email: string,
  password: string,
): Promise<AuthResult<{ user: User; session: Session; token: string; needsTotp: boolean }>>
```

### `validateRequest`
Validates an incoming session token from HTTP cookies. If the session is within its renewal window, automatically extends its lifespan.
```typescript
export async function validateRequest(
  db: DatabaseAdapter,
  rawToken: string | null,
): Promise<{ user: User; session: Session } | null>
```

### `completeTotpLogin`
Verifies an entered 6-digit TOTP code against the encrypted secret using RFC 6238 time-step truncation.
```typescript
export async function completeTotpLogin(
  db: DatabaseAdapter,
  secretKey: string,
  userId: string,
  code: string,
  ip: string,
): Promise<AuthResult<{ user: User; session: Session; token: string }>>
```

### `createOAuthRedirect`
Constructs the provider authorization URL with PKCE (`code_challenge`) and CSRF `state`.
```typescript
export function createOAuthRedirect(
  config: ResolvedAuthConfig,
  provider: string,
): AuthResult<{ url: URL; state: string; codeVerifier: string }>
```

### `handleOAuthCallback`
Handles the OAuth callback by validating the PKCE `code_verifier`, exchanging the code for user profiles, and linking accounts.
```typescript
export async function handleOAuthCallback(
  db: DatabaseAdapter,
  config: ResolvedAuthConfig,
  provider: string,
  code: string,
  codeVerifier: string,
): Promise<AuthResult<{ user: User; session: Session; token: string }>>
```

---

## 3. Framework Adapters

Sedim provides native, idiomatic adapters for supported server frameworks:

### Next.js App Router (`nextjs.ts`)
```typescript
// Route handler: src/app/api/auth/[...all]/route.ts
export const { GET, POST } = createNextjsAuthHandlers(authConfig)

// Server Component / Server Action helper:
const { user, session } = await getSession(authConfig) ?? {}
```

### Express (`express.ts`)
```typescript
import { createExpressAuthRouter, createSessionMiddleware, requireAuth } from './sedim/auth'

app.use(createSessionMiddleware(authConfig))
app.use('/auth', createExpressAuthRouter(authConfig))
app.get('/protected', requireAuth, (req, res) => {
  res.json({ user: res.locals.authUser })
})
```

### Hono (`hono.ts`)
```typescript
import { createHonoAuthRoutes, createHonoSessionMiddleware, requireAuth } from './sedim/auth'

app.use('*', createHonoSessionMiddleware(authConfig))
app.route('/auth', createHonoAuthRoutes(authConfig))
```

### Fastify (`fastify.ts`)
```typescript
import { createFastifyAuthPlugin, createFastifySessionHook, fastifyRequireAuth } from './sedim/auth'

app.addHook('onRequest', createFastifySessionHook(authConfig))
app.register(createFastifyAuthPlugin(authConfig), { prefix: '/auth' })
```

---

## 4. Database Adapters (`DatabaseAdapter`)

Sedim decouples business logic from persistence via the `DatabaseAdapter` interface. Stamped adapters implement full CRUD queries for:
- **Drizzle ORM** (`src/sedim/auth/adapters/drizzle.ts`): PostgreSQL, MySQL, and SQLite dialects.
- **Prisma** (`src/sedim/auth/adapters/prisma.ts`): Typed Prisma client delegates.
