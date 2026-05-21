# Sedim

![Sedim Banner](/assets/banner.jpeg)

**Install complete features. Own every line.**

Sedim is a premium codegen CLI that stamps production-ready feature modules into your project. No runtime dependencies, no black boxes — every stamped file is readable, editable, and owned by you.

```bash
npm install -g @sedim/cli

sedim init         # detect your stack
sedim add auth     # stamp auth into your project
```

Auth ships with everything: password hashing, sessions, OAuth (Google/GitHub/Discord), TOTP, backup codes, RBAC/ABAC, magic links, and JWT refresh tokens.

---

## Features

| | |
|---|---|
| **Password auth** | Argon2id (OWASP params), account lockout after 10 failed attempts |
| **Session management** | SHA-256 hashed tokens, httpOnly cookies, full revocation |
| **OAuth** | Google, GitHub, Discord — PKCE (RFC 7636) on all flows |
| **TOTP** | RFC 6238, AES-256-GCM encrypted at rest, backup codes |
| **Magic links** | Non-leaking (no email enumeration), SMTP or Resend/Postmark/SES |
| **JWT** | Hybrid: short-lived signed JWTs + DB-backed refresh tokens |
| **RBAC/ABAC** | Role and attribute-based access control middleware |
| **Rate limiting** | Sliding window, configurable store (in-memory or Redis) |
| **Multi-framework** | Next.js, Express, Hono |
| **Multi-ORM** | Drizzle (PostgreSQL, MySQL, SQLite) and Prisma |
| **Multi-email** | nodemailer, Resend, Postmark, AWS SES |
| **Multi-UI tier** | Headless (no CSS), Tailwind, or themed with CSS tokens |

---

## Quick Start

### 1. Install the CLI

```bash
npm install -g @sedim/cli
```

### 2. Initialise your project

```bash
cd my-project
sedim init
```

Sedim detects your framework (Next.js, Express, Hono), ORM (Drizzle, Prisma, or none), and language. It writes a `sedim.config.ts`.

### 3. Add auth

```bash
sedim add auth
```

Choose your features — email+password, OAuth, TOTP, magic links. Sedim stamps the complete auth module into `src/sedim/auth/`.

### 4. Configure

All auth settings live in `sedim.config.ts` — features, UI tier, session strategy, and OAuth providers. Environment variables handle secrets: `AUTH_SECRET`, database URLs, and per-provider credentials.

```typescript
// sedim.config.ts
export default {
  framework: 'express',
  orm: 'prisma',
  auth: {
    providers: ['email-password', 'google-oauth'],
    ui: 'headless',
    session: 'session',  // or 'jwt'
  },
}
```

### 5. Wire and run

```bash
# Add to your app
npx prisma migrate dev --name add_auth
npm run dev
```

---

## Documentation

**[Getting Started →](https://github.com/sedim-dev/sedim/tree/main/apps/docs/src/guide/)** — Install, init, add your first module

**[Auth Module →](https://github.com/sedim-dev/sedim/tree/main/apps/docs/src/auth/)** — Full feature reference for the auth module

**[CLI Reference →](https://github.com/sedim-dev/sedim/tree/main/apps/docs/src/cli/)** — All sedim commands, options, and flags

**[Concepts →](https://github.com/sedim-dev/sedim/tree/main/apps/docs/src/concepts/)** — How stamping works, the module system

**[Guides →](https://github.com/sedim-dev/sedim/tree/main/apps/docs/src/guides/)** — OAuth setup, TOTP enrollment, production deployment

**[Roadmap →](https://github.com/sedim-dev/sedim/tree/main/apps/docs/src/roadmap/)** — What's coming next

---

## Architecture

Sedim uses a **stamp model**, not a runtime SDK model:

```
sedim add auth  →  generates files under src/sedim/auth/
                   (you own these files forever)
```

After stamping, your project is standalone. No `@sedim/auth` runtime, no magic — just readable, debuggable TypeScript.

The stamping plan is driven by a **module manifest** (`registry/<module>/latest.json`) — a declarative description of every file the module stamps, what features gate each file, and what environment variables are required.

---

## Registry

Module manifests live in the [`registry/`](https://github.com/sedim-dev/sedim/tree/main/registry) directory of this repo — the same repo you're reading now. The local registry is used by default during development; the CLI falls back to the GitHub raw URL for published releases.

Browse available modules at the [Sedim Registry](https://github.com/sedim-dev/registry).

---

## Status

**Auth module: v0.2.0** — feature-complete, tested, production-ready.

The registry and CLI are ready. More modules coming.

---

*Premium codegen — because the best code is code you own.*