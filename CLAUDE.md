# Sedim — CLAUDE.md

This file is the canonical source of project context for Claude Code and any AI agent working in this repository. Read it before doing anything.

---

## What is Sedim?

Sedim is a **premium codegen library** — a CLI tool that stamps production-ready feature modules into your project. Unlike a dependency you `npm install`, Sedim's stamped code is **owned by you**: transparent, minimal, and fully editable after stamping.

**The goal:** Install a complete feature (like auth) in one command, own the generated code forever, and never be locked into a library's internals.

```
npm install -g @sedim/cli
sedim add auth   # → stamps auth into your project
```

---

## Project Structure

```
Sedim/
├── packages/
│   ├── auth/          @sedim/auth   — the auth module (v0.2.0)
│   ├── cli/           @sedim/cli    — the Sedim CLI engine (v1.0.0)
│   └── core/          @sedim/core   — shared types used by both
├── apps/
│   └── playground/    — fixture apps for testing stamping
│       ├── nextjs-drizzle-ts/       Next.js + Drizzle + TypeScript
│       ├── express-prisma-ts/        Express + Prisma + TypeScript
│       ├── hono-no-orm-js/           Hono + plain JS, no ORM
│       └── nextjs-existing-auth/     Next.js with existing next-auth
├── registry/
│   └── auth/latest.json             Module manifest (loaded by CLI thinker)
└── packages/cli/src/
    ├── commands/       6 commands: init, add, continue, doctor, plan, diff
    ├── detector/       Stack detection (framework, ORM, language, DB)
    ├── thinker/        Planning engine (manifest → plan → file ops)
    ├── writer/         Plan executor (writes files, patches, injects)
    ├── config/         sedim.config.ts read/write/validate
    └── showbaby/       All UX: prompts, spinners, progress UI
```

---

## Stamping Philosophy

**Core rule: stamped files are owned by the user. They are not a black box.**

- Core logic files use `overwriteStrategy: 'skip'` — sedim never overwrites your customizations of stamped code
- User-facing files (config, pages) use `overwriteStrategy: 'ask'` — sedim asks before overwriting
- All stamped files land under `src/sedim/<module>/` — you can audit everything in one place
- The CLI is a **stamp generator**, not a runtime dependency. Once stamped, your project doesn't need `@sedim/cli` to run.

**Adding new features to an existing module:**
1. Edit the module's `plan-config.ts` (e.g., `packages/auth/src/plan-config.ts`)
2. Add a new file to `templates/` if needed
3. Add a new template to the plan config builder
4. Run `sedim add auth` in a playground fixture to test

---

## Auth Module Architecture

### Design Decisions

- **Session-based auth, NOT pure JWT.** The session token is a 40-char random string, SHA-256 hashed, stored as the session ID in the DB. httpOnly cookie holds the raw token. This gives full revocation capability.
- **PKCE required on all OAuth flows.** RFC 7636 S256 only. No "plain" method.
- **Rate limiting is inline** (not a separate stamped file) — lives in `operations.ts` and is called per-request.
- **RBAC/ABAC are middleware factories** exported from `operations.ts`. Users apply them in their own route files.
- **TOTP secrets encrypted at rest** using AES-256-GCM with a key derived from `AUTH_SECRET`.
- **Magic link is non-leaking** — always returns success to prevent email enumeration.

### Key Files

| File | Purpose |
|------|---------|
| `src/core/hash-password.ts` | Argon2id (64MB, 3 iterations, OWASP params) |
| `src/core/session.ts` | Session building + sliding-window validation |
| `src/core/generate-token.ts` | Session tokens, OTP tokens, backup codes, PKCE verifiers |
| `src/core/pkce.ts` | RFC 7636 PKCE — S256 code challenge |
| `src/core/totp.ts` | RFC 6238 TOTP (Google Authenticator compatible) |
| `src/core/totp-crypto.ts` | AES-256-GCM encryption for TOTP secrets |
| `src/core/rate-limit.ts` | Sliding-window rate limiter (in-memory Map) |
| `src/core/rbac.ts` | Role definitions + hasPermission/requireRole helpers |
| `src/core/abac.ts` | Policy engine for attribute-based access control |
| `src/core/jwt.ts` | Hybrid JWT: short-lived signed JWT + DB-backed refresh tokens |
| `src/core/oidc.ts` | OIDC discovery + id_token validation via jose |
| `src/core/email-transport.ts` | Multi-transport: nodemailer/resend/postmark/ses |
| `src/adapters/framework/operations.ts` | All auth operations: login, signup, OAuth, TOTP, etc. |
| `src/adapters/framework/nextjs.ts` | Next.js App Router handler factory |
| `src/adapters/framework/express.ts` | Express router |
| `src/adapters/framework/hono.ts` | Hono route registration |
| `src/plan-config.ts` | Stamping rules for the auth module |

### Schema (auto-selected per feature)

| Feature | Tables |
|---------|--------|
| Base (always) | `users`, `sessions` |
| magic-link / password-reset | `otp_tokens` |
| oauth-* | `oauth_accounts` |
| totp | `totp_credentials`, `backup_codes` |
| jwt | `refresh_tokens` |

---

## CLI Engine

**Entry point:** `packages/cli/src/index.ts`

**Command flow for `sedim add <module>`:**
1. `commands/add.ts` → checks `sedim.config.ts` exists
2. `detector/index.ts` → detects stack (framework, ORM, language, DB)
3. `load-module-manifest.ts` → loads manifest from registry (local first, then GitHub)
4. `thinker/index.ts` → builds `InstallPlan` from manifest + detected context
5. `writer/apply-plan.ts` → executes file operations

**Local registry:** `registry/<module>/latest.json` — used for dev and offline.
**Remote registry:** `https://raw.githubusercontent.com/sedim-dev/registry/main/modules/<module>/latest.json`

---

## Testing

### Running tests

```bash
# All packages
pnpm test

# Auth module only
cd packages/auth && pnpm test

# CLI only
cd packages/cli && pnpm test
```

### Playground fixtures

Test stamping against real projects:

```bash
# 1. Next.js + Drizzle + TypeScript
cd apps/playground/nextjs-drizzle-ts
sedim init --force
sedim add auth
# Verify: tsc --noEmit in src/sedim/auth/
# Start: npm run dev

# 2. Express + Prisma + TypeScript
cd ../express-prisma-ts
sedim init --force
sedim add auth

# 3. Hono + plain JS
cd ../hono-no-orm-js
sedim init --force
sedim add auth

# 4. Next.js with existing next-auth
cd ../nextjs-existing-auth
sedim init --force
# Should detect conflict and warn
```

> **Note:** Run `sedim add auth --dry-run` first to preview without writing.

---

## Package Manager

This is a **pnpm monorepo**. All commands use `pnpm`.

```bash
pnpm install          # install all deps
pnpm build            # build all packages (via turbo)
pnpm test             # run all tests
pnpm --filter @sedim/cli dev   # run CLI in dev mode
```

---

## Key Conventions

- **No `any`** — use `unknown` and narrow properly
- **`--dry-run` first** — always preview before writing
- **Stamped files are user-owned** — don't add runtime library calls into stamped files
- **Vitest for all tests** — tests live in `src/__tests__/` per package
- **TypeScript strict** — `tsc --noEmit` must pass on all non-template source

---

## Known Loose Ends (v1)

These are known and acceptable for v1:

1. **`email.ts` parallel path** — `core/email.ts` and `core/email-transport.ts` both exist. The former is env-var driven nodemailer-only; the latter is the config-driven multi-transport. Both work. The old file is left in place for backwards compat with stamped projects that imported from it.

2. **`RedisRateLimitStore`** — only in comments. The `RateLimitStore` interface allows any implementation. Implement it when multi-instance production deployment is needed.

3. **`sedim.config.ts` schema** — `preferences` and `overrides` are stored but `validate-sedim-config.ts` only validates `framework`, `orm`, `db`, `language`, `moduleSystem`. Preferences and overrides are not yet validated or used by the thinker.

---

*Last updated: 2026-05-20*