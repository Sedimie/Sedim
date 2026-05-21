# Auth Module

The `@sedim/auth` module stamps a complete, production-ready auth system into your project. Every file is stamped under `src/sedim/auth/` — fully readable, editable, and owned by you.

## Features

| Feature | Description |
|---------|-------------|
| **Email + Password** | Argon2id hashing (OWASP params: 64MB, 3 iterations), account lockout after 10 failed attempts |
| **Session management** | SHA-256 hashed 40-char tokens, httpOnly cookies, sliding window expiry, full revocation |
| **OAuth** | Google, GitHub, Discord — PKCE (RFC 7636) on all flows, PKCE required (no "plain" method) |
| **TOTP** | RFC 6238 Google Authenticator compatible, AES-256-GCM encrypted at rest, 8 backup codes |
| **Magic links** | Non-leaking (always returns success to prevent email enumeration) |
| **JWT** | Hybrid: HMAC-SHA256 short-lived JWTs (15 min) + DB-backed refresh tokens (30 days, rotation) |
| **RBAC** | Role-based access control — admin, moderator, user defaults with `hasPermission`, `requireRole` |
| **ABAC** | Attribute-based access control — policy engine with `evaluateAbac`, `buildPolicy` |
| **Rate limiting** | Sliding window, per-IP and per-user, configurable store (in-memory default, Redis-ready) |
| **Email** | nodemailer, Resend, Postmark, AWS SES — configurable per-deployment |

## Session strategy

Sedim uses **session-cookie by default** (DB-backed sessions). This gives full revocation capability — you can invalidate a session immediately.

JWT mode is available for stateless APIs. It uses a hybrid approach: short-lived signed JWTs (15 min) with a DB-backed refresh token (30 days) that rotates on every use. The browser never sees the refresh token — it's httpOnly.

## Stamped files

```
src/sedim/auth/
├── core/
│   ├── hash-password.ts    # Argon2id (64MB, 3 iters, OWASP params)
│   ├── generate-token.ts    # Session tokens, OTP tokens, PKCE verifiers, backup codes
│   ├── session.ts          # Session building + sliding-window validation
│   ├── pkce.ts             # RFC 7636 PKCE — S256 code challenge/verifier
│   ├── totp.ts             # RFC 6238 TOTP (RFC 6238)
│   ├── totp-crypto.ts      # AES-256-GCM encryption for TOTP secrets
│   ├── rbac.ts             # Role definitions + hasPermission/requireRole helpers
│   ├── abac.ts             # Policy engine for attribute-based access control
│   ├── jwt.ts              # Hybrid JWT: HMAC-SHA256 access token + refresh token
│   ├── email-transport.ts  # Multi-transport: nodemailer/resend/postmark/SES
│   └── rate-limit.ts       # Sliding-window rate limiter
├── adapters/
│   ├── types.ts            # User, Session, OAuthAccount, TOTP, OTP interfaces
│   ├── drizzle.ts          # Drizzle ORM adapter (pg, mysql, sqlite)
│   ├── prisma.ts           # Prisma ORM adapter
│   └── framework/
│       ├── framework-config.ts  # resolveConfig, createAuthRouter, requireAuth
│       ├── operations.ts        # All auth operations (login, signup, OAuth, TOTP, etc.)
│       ├── express.ts           # Express router at /auth/*
│       ├── hono.ts              # Hono route at /auth/*
│       └── nextjs.ts            # Next.js App Router handler
├── ui/                     # UI components (only if UI tier chosen)
│   ├── auth-client.ts      # Typed API client for frontend
│   ├── use-auth.ts         # React hook for auth state
│   ├── headless/           # Unstyled components (no CSS)
│   ├── tailwind/           # Tailwind-styled components
│   └── themed/            # Pre-built themes (modern, minimal, colorful)
├── schema.prisma           # Prisma schema (if using Prisma)
├── schema.ts               # Drizzle schema (if using Drizzle)
├── config.ts               # AuthConfig — wire your db + providers
└── index.ts               # Barrel export
```

## Next steps

- [Configuration](./config) — `sedim.config.ts` reference
- [Features](./features) — detailed feature reference
- [Framework Adapters](./adapters) — wiring into Express, Hono, Next.js
- [Schema](./schema) — database schema for each ORM