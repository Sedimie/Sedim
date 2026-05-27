# Sedim — Codebase Audit & Open Source Readiness Report

**Date:** 2026-05-23
**Status:** Pre-launch — critical issues block publishing

---
claude --resume e1152af1-b59f-4adb-9f58-f00181e5cd39
## Executive Summary

The codebase has solid foundations — auth logic is well-implemented (Argon2id, PKCE, TOTP replay protection, magic link non-enumeration), the CLI architecture (thinker/writer separation, session recovery, dry-run) is sound, and the stamp model is genuinely novel. But there are critical import path bugs that would cause runtime crashes on day one, the docs site is non-functional, and 12+ TypeScript errors exist in the auth package. None of this is structural — it's all fixable. The real differentiator is whether you launch with a broken docs site and crashing adapters or a clean experience.

---

## PART 1: AUDIT — ALL ISSUES

### A. FIX BEFORE LAUNCH (Critical — will break or crash on day one)

#### A1. Wrong import paths in ALL framework adapters — RUNTIME CRASH

**Severity:** CRITICAL — this will crash the moment any auth operation is called.

All framework adapters use `../core/` but the correct path from `packages/auth/src/adapters/framework/` to `packages/auth/src/core/` is `../../core/`.

| File | Lines | Wrong | Correct |
|------|-------|-------|----------|
| `packages/auth/src/adapters/framework/express.ts` | 3, 4, 6, 16 | `../core/...` | `../../core/...` |
| `packages/auth/src/adapters/framework/hono.ts` | 3, 6, 28 | `../core/...` | `../../core/...` |
| `packages/auth/src/adapters/framework/nextjs.ts` | 4, 5, 12, 34 | `../core/...` | `../../core/...` |
| `packages/auth/src/adapters/framework/operations.ts` | 1–10 | `../core/...` | `../../core/...` |
| `packages/auth/src/adapters/framework/framework-config.ts` | 2, 3 | `../core/...` | `../../core/...` |

#### A2. `generateBackupCodes` not imported in operations.ts — RUNTIME CRASH

**File:** `packages/auth/src/adapters/framework/operations.ts` line 475

The function `generateBackupCodes` is defined in `packages/auth/src/core/generate-token.ts:47` and exported from `packages/auth/src/core/index.ts:12`, but it is never imported in `operations.ts`. Calling `generateBackupCodes` at runtime will throw `ReferenceError: generateBackupCodes is not defined`.

**Fix:** Add to the imports from `'../../core/generate-token.js'`

#### A3. `require()` in ESM module — RUNTIME CRASH

**File:** `packages/auth/src/adapters/framework/framework-config.ts` line 150

```typescript
rateLimiter: config.rateLimiter ?? { store: new (require('../core/rate-limit-store.js').InMemoryRateLimitStore)() },
```

The entire package is `"type": "module"` — `require()` does not exist in ESM. This crashes at runtime when `resolveConfig` is called without a custom `rateLimiter`.

**Fix:** Use dynamic `import()` or restructure to avoid CommonJS require.

#### A4. Docs site is broken — `srcDir` not set in VitePress config

**File:** `apps/docs/.vitepress/config.ts`

Content lives in `apps/docs/src/` but VitePress defaults to looking in the `.vitepress/` parent directory. Without `srcDir: 'src'`, all pages get output under `/src/guide/`, `/src/auth/` — every nav link (`/guide/`, `/auth/`) 404s.

**Fix:** Add `srcDir: 'src'` to the `defineConfig` call.

#### A5. Docs `_redirects` is wrong — Cloudflare Pages deployment broken

**File:** `apps/docs/public/_redirects`

```
/* /src/:path.html 200
```

This rewrites `/guide/` to `/src/guide.html` (a file), not `/src/guide/index.html` (the actual VitePress output with `cleanUrls: true`). Every path 404s in production.

**Fix:** Replace with `/* /index.html 200` (standard SPA fallback — VitePress handles its own client-side routing).

#### A6. Docs missing favicon.svg and logo.svg

**File:** `apps/docs/public/` — neither asset exists

VitePress config references `/favicon.svg` and `/logo.svg` but neither file exists in `public/`. Browser tab icon and nav logo are broken in production.

**Fix:** Either create both SVG files in `apps/docs/public/`, or remove the references from `.vitepress/config.ts`.

---

### B. FIX BEFORE LAUNCH — TypeScript Errors in Auth Package

These are all in `packages/auth`. Run `tsc --noEmit --skipLibCheck` in that package to verify.

| File | Line(s) | Issue |
|------|---------|-------|
| `packages/auth/src/core/jwt.ts` | 23 | `decodeBase32LowerCaseNoPadding` does not exist in `@oslojs/encoding` — should be `encodeBase32LowerCaseNoPadding` |
| `packages/auth/src/core/jwt.ts` | 24 | `@oslojs/crypto` not installed as a dependency |
| `packages/auth/src/core/jwt.ts` | 91 | `sig` is `string \| undefined` but `hmacSign` requires `string` |
| `packages/auth/src/core/jwt.ts` | 95 | `body` is possibly `undefined` after `.split()` |
| `packages/auth/src/core/oidc.ts` | 23 | `JwtPayload` not exported from `jose` — should be `JWTPayload` |
| `packages/auth/src/core/abac.ts` | 183 | `buildPolicy` type error with `exactOptionalPropertyTypes` |
| `packages/auth/src/core/totp-crypto.ts` | 79–81 | `parts[n]` is `string \| undefined` after `.split()` |
| `packages/auth/src/core/generate-token.ts` | 9 | `Uint8Array<ArrayBufferLike>` type incompatibility with Web Crypto API |
| `packages/auth/src/core/email-transport.ts` | 121 | `nodemailer` not listed as a dependency |
| `packages/auth/src/core/email.ts` | 6 | `nodemailer` not listed as a dependency (separate duplicate file, dead code) |
| `packages/auth/src/adapters/framework/operations.ts` | 476, 599 | Implicit `any` in lambda callback parameters |
| `packages/auth/src/adapters/prisma.ts` | 124 | `findMany` not in `PrismaModel` interface |
| `packages/auth/src/adapters/prisma.ts` | 209 | `createdAt` missing in `createRefreshToken` call |
| `packages/auth/src/adapters/prisma.ts` | 221 | `expiresAt` not in `RefreshTokenWhereInput` |

---

### C. GOOD FOR CONTRIBUTIONS (Non-blocking — invite help)

These issues are real but won't prevent a launch if fixed. Open them as labeled GitHub Issues to build contributor pipeline.

#### CLI Issues

| Issue | File | Line | Description | Label |
|-------|------|------|-------------|-------|
| `continue.ts` — `session.status === 'failed'` not handled | `packages/cli/src/commands/continue.ts` | 31–35 | Failed sessions fall through silently instead of being cleared or warned | `bug` |
| `add.ts` — `clearSession` can fail silently | `packages/cli/src/commands/add.ts` | 45–47 | Dynamic import of `clearSession` throws and is not caught — old session left on disk | `bug` |
| `apply-plan.ts` — no rollback on partial failure | `packages/cli/src/writer/apply-plan.ts` | 45–58 | If write fails mid-plan, no rollback attempted — user must `sedim continue` to recover | `enhancement` |
| `load-plan-config.ts` — silent error swallowing | `packages/cli/src/thinker/load-plan-config.ts` | 28–31 | Module plan-config runtime errors silently fall through to generic fallback | `bug` |
| `continue.ts` — drift detection runs but result never used | `packages/cli/src/commands/continue.ts` | 43–56 | Code comments say "drift detection" but re-detected context is compared to nothing | `bug` |
| `init.ts` — `uiLevel` selected but never written to config | `packages/cli/src/commands/init.ts` | 92–96 | User picks UI style (headless/tailwind/themed) but the value is discarded | `bug` |
| `init.ts` — `ui.confirm` result not checked for cancel symbol | `packages/cli/src/commands/init.ts` | 27 | `clack.prompts` returns `symbol` on cancel — not handled, execution continues | `bug` |
| `add.ts` — session written without validating plan completeness | `packages/cli/src/commands/add.ts` | 296–305 | Session can be written with `undefined` content in `filesToCreate` — later `applyPlan` throws | `bug` |
| `update-env.ts` — existing keys silently skip user-provided values | `packages/cli/src/writer/update-env.ts` | 31 | Design: interactive values never overwrite existing `.env` keys — "never overwrite" comment | `enhancement` |
| `resolve-template.ts` — broken error message path | `packages/cli/src/thinker/resolve-template.ts` | 90 | `.` before `[` in template literal produces invalid path in error message | `bug` |
| `bootstrap.ts` — hardcoded relative CLI entry path | `packages/cli/src/frontend/bootstrap.ts` | 86–87 | `../index.ts` relative path may not resolve correctly in production builds | `bug` |
| `diff.ts` — failed injection still adds file to diffTargets | `packages/cli/src/commands/diff.ts` | 76–80 | If `applyInjection` fails, file shows no diff rather than an error | `bug` |
| `plan-serializer.ts` — minimal deserialization validation | `packages/cli/src/planning/plan-serializer.ts` | 10–17 | Only checks `moduleName` and `filesToCreate` — malformed plans deserialize silently | `enhancement` |
| Missing `--quiet` flag for CI environments | `packages/cli/src/` | — | Suppress spinners in automated/CI contexts | `good first issue` |
| Add Node.js version check to `sedim doctor` | `packages/cli/src/commands/doctor.ts` | — | Warn if Node < 18 before running other checks | `good first issue` |

#### Auth Module Issues

| Issue | File | Line | Description | Label |
|-------|------|------|-------------|-------|
| `AbacResult` type not imported in operations.ts | `packages/auth/src/adapters/framework/operations.ts` | 730 | Return type annotation uses `AbacResult` but it's not in the import list | `bug` |
| ABAC `condition` field never evaluated | `packages/auth/src/core/abac.ts` | 62 | `condition` string is stored but there's no evaluation engine — only structural matching | `enhancement` |
| ABAC `{{ subject.id }}` template in default policies never interpolated | `packages/auth/src/core/abac.ts` | 136–161 | Default policies use template syntax but `matchAttributes` does literal equality only | `enhancement` |
| Redis rate limit store — only a comment, no implementation | `packages/auth/src/core/rate-limit-store.ts` | 34–53 | `RedisRateLimitStore` interface defined but only as a commented-out example | `good first issue` |
| Role hierarchy hardcoded, not configurable | `packages/auth/src/core/rbac.ts` | 120 | `hasMinimumRole` hardcodes `['user', 'moderator', 'admin']` — no way to customize | `enhancement` |
| OIDC `extractEmailFromClaims` fallback to userinfo not implemented | `packages/auth/src/core/oidc.ts` | 118 | Comment describes fallback but code only reads from `id_token` claims | `enhancement` |
| `setupTotp`/`getTotpUri` not route-handler accessible | `packages/auth/src/adapters/framework/operations.ts` | 455–480 | Defined but not exported from module, no route handler wires them up | `enhancement` |
| `email.ts` is dead code — duplicate of email-transport.ts | `packages/auth/src/core/email.ts` | all | Separate file importing nodemailer directly — unused, imports broken | `good first issue` |
| Framework adapters not re-exported from `adapters/index.ts` | `packages/auth/src/adapters/index.ts` | all | Barrel file doesn't re-export framework adapters — users importing from `@sedim/auth/adapters` can't access them | `enhancement` |
| Rate limiters exported but never connected to framework adapters | `packages/auth/src/core/rate-limit.ts` | all | `loginLimiter`, `signupLimiter`, etc. exported but adapters use internal stores | `enhancement` |
| Add SvelteKit stack detection | `packages/cli/src/detector/` | — | Detector doesn't handle SvelteKit — current `src/routes` detection is ambiguous | `enhancement` |
| Add Hono playground fixture | `apps/playground/` | — | No Hono fixture exists for integration testing | `good first issue` |

#### Docs Issues

| Issue | File | Description | Label |
|-------|------|-------------|-------|
| `schema.md` out of sync with actual Prisma schema | `apps/docs/src/auth/schema.md` vs `packages/auth/src/schema/*.prisma` | Docs show `updatedAt` (doesn't exist), miss `failedLoginAttempts`/`lockedAt`, conflate all feature schemas into one | `docs` |
| `adapters.md` shows wrong export names | `apps/docs/src/auth/adapters.md` | Docs show `createAuthRouter` / `requireRole` / `hasPermission` — actual exports are `createExpressAuthRouter`, `requirePermission` only | `docs` |
| `contributing/index.md` just links elsewhere | `apps/docs/src/contributing/index.md` | Only contains links to CONTRIBUTING.md and CODE_OF_CONDUCT.md on GitHub | `docs` |
| `ignoreDeadLinks: true` hides real broken links | `apps/docs/.vitepress/config.ts` | 86 | Should be `false` to catch broken links during build | `bug` |
| Orphaned cache directory | `apps/docs/.vitepress/cache/` | Temp dir not cleaned up after build | `low` |
| Write "Production Deployment" guide | `apps/docs/src/guides/production.md` | Exists but needs actual content — currently just a stub | `good first issue` |

#### Build / Config Issues

| Issue | File | Description | Label |
|-------|------|-------------|-------|
| turbo.json schema URL typo: `tubro.build` | `turbo.json` line 2 | Should be `turbo.build` — no schema validation in editors | `bug` |
| Root vitest.config.ts has auth tests commented out | `vitest.config.ts` lines 22–29 | Comment says "when auth package is added" — it's been added, auth tests never run from root | `bug` |
| CONTRIBUTING.md references 3 non-existent files | `CONTRIBUTING.md` line 10–12 | `DESIGN_DOC.txt`, `AUTH_INTERNALS.md`, `AUTH_HARDENING_REPORT.txt` don't exist | `docs` |
| `apps/src/cli` exists but empty | `apps/src/cli/` | Leftover scaffolding noise | `low` |
| `apps/src/web` missing | `apps/src/` | CONTRIBUTING.md references it but parent directory only has empty `cli` | `low` |
| `@oslojs/crypto` not installed | `packages/auth/package.json` | Referenced in `jwt.ts` line 24 but not in dependencies | `bug` |
| `nodemailer` not listed as dependency | `packages/auth/package.json` | Both `email.ts` and `email-transport.ts` import it but it's not a listed dependency | `bug` |

---

### D. What's Actually Solid

These parts of the codebase are well-built and don't need immediate work:

- **Auth core logic** — Argon2id params (64MB, 3 iterations, OWASP-recommended), PKCE RFC 7636 S256-only, TOTP replay protection via `lastUsedCounter`, session sliding window validation, magic link non-enumeration (always returns success), CSRF guard on POST routes
- **DatabaseAdapter interface** — clean separation, ORM adapters properly isolated
- **CLI architecture** — thinker/writer separation, session recovery, dry-run mode, clean command structure
- **Package exports** — `@sedim/core` and `@sedim/cli` pass `tsc --noEmit` cleanly
- **Stamping philosophy** — `overwriteStrategy: 'skip'` for core files, `ask` for user-facing files, correct model

---

## PART 2: OPEN SOURCE STRATEGY

### Org vs Personal Repo

**Use an org. Create `sedim-dev` on GitHub today.**

Personal repos signal side projects. An org (`sedim-dev`) signals a real project with real momentum. It enables:
- Org-level GitHub Actions secrets and runners
- `@sedim/cli`, `@sedim/auth`, `@sedim/core` npm packages under one org scope
- Team membership, @mention ability, contributor management at scale
- Easy transfer of repo if you later want a separate maintainer team

GitHub makes transferring trivially easy. Create the org, transfer the repo, update the README URL. Done.

### Positioning

**Don't position as "another auth library." Position as the feature stamp CLI.**

The one-liner: *"Run one command, get production-ready auth stamped into your project. No runtime dependency, no black box — every file is yours."*

The differentiation:
- vs NextAuth/Auth.js: they force their runtime, magic, opinions
- vs Lucia: still a runtime dependency you import
- vs Clerk/Auth0: pure SaaS lock-in
- Sedim: the `rails generate` for your feature stack. Auth is first. Chat, payments, notifications come next. All using the same stamp model.

For contributors: *"We're building the stamp engine. Auth is the reference module. Help us build the tool that stamps any feature."*

### Roadmap

Pin a `ROADMAP.md` at the repo root. Structure:

```
v0.3.0 (stabilization) — fix all TS errors, fix docs deploy, Redis store
v1.0.0 (launch) — CLI stable, full integration, --update flag
v1.1.0 — Chat module (second feature module)
v2.0.0 — Third-party module registry
```

Keep it honest and dated. Real roadmaps build trust.

### Issues to Open on Day One

Open 10–12 max. Label each precisely. Leave the rest for contributors to find.

**Bugs (high priority — show you're fixing things):**
- `[bug] Wrong import paths in all framework adapters` — `good first issue` label (easy fix, obvious)
- `[bug] Docs site broken: VitePress srcDir missing` — `good first issue`
- `[bug] Cloudflare Pages _redirects rule wrong` — `good first issue`

**Features (invite help on the roadmap):**
- `[enhancement] RedisRateLimitStore implementation` — interface already defined, easy entry point
- `[enhancement] ABAC condition evaluation engine` — interesting algorithmic problem
- `[enhancement] Add SvelteKit stack detection` — clear scope, well-bounded
- `[enhancement] SetupTotp route handler needs wiring` — small, well-defined

**Good first issues (zero context needed):**
- `[good first issue] Add --quiet flag for CI environments`
- `[good first issue] Test sedim on macOS`
- `[good first issue] Write the Production Deployment guide`
- `[good first issue] Add node --version check to sedim doctor`

### CI / Testing

**For now — keep it minimal.** Heavy CI kills contributor momentum.

Add this as `.github/workflows/ci.yml`:

```yaml
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm tsc --noEmit --skipLibCheck
      - run: pnpm biome check --no-errors-on-unmatched
```

**What NOT to do yet:**
- Do NOT gate on test coverage percentage
- Do NOT add playground fixture compilation to CI (slow, flaky)
- Do NOT require "write tests for new features" as a rule — document where tests live and let people discover patterns naturally
- Do NOT add a CLA

**When to add test gating:** When you have 10+ active contributors and a clear, stable test pattern. That's 3–6 months from now minimum.

### CLA — No

MIT license is sufficient. Add one line to CONTRIBUTING.md: *"By contributing, you agree your contributions will be licensed under MIT."* That's standard and not scary. CLAs signal corporate overhead and kill casual contributor enthusiasm.

### What Drives Organic Growth

The single highest-leverage thing you can do: **a live demo terminal GIF on the docs homepage** showing `sedim add auth` running end-to-end. Record it with `vhs` or `asciinema`. Embed it in both the README and the homepage. Nothing converts skeptical developers faster than seeing actual output of the tool they're evaluating.

---

## PART 3: CLASSIFICATION MATRIX

### Fix Before Launch (must address before announcing)

| # | Issue | Why it must be fixed |
|---|-------|---------------------|
| 1 | Wrong `../core/` → `../../core/` paths in all 5 adapter files | Runtime crash on any auth operation |
| 2 | `generateBackupCodes` not imported in operations.ts | Runtime `ReferenceError` when setting up TOTP backup codes |
| 3 | `require()` in ESM in framework-config.ts | Runtime crash when resolving config without custom rateLimiter |
| 4 | VitePress `srcDir` missing | Every docs page 404s — site is fully broken |
| 5 | `_redirects` rule wrong | Cloudflare Pages serves broken URLs |
| 6 | Missing favicon.svg and logo.svg | Broken icon in browser tab and nav |
| 7 | 14 TypeScript errors in auth package | `tsc --noEmit` fails — publishing to npm would fail |
| 8 | turbo.json schema URL typo (`tubro`) | Editors can't validate turbo.json schema |
| 9 | Root vitest.config.ts auth tests commented out | `pnpm test` from root skips all auth tests |
| 10 | `@oslojs/crypto` not installed | jwt.ts line 24 will fail at runtime |

### Good for Contributions (open as GitHub Issues)

| # | Issue | Good for contributions because |
|---|-------|-------------------------------|
| 1 | Fix `showError` export in showbaby (first audit was wrong — it exists) | N/A — not actually a bug |
| 2 | RedisRateLimitStore implementation | Interface already defined, well-bounded scope |
| 3 | Add Hono playground fixture | Well-defined, self-contained |
| 4 | Add `--quiet` flag for CI | Small, isolated, clear |
| 5 | Add Node.js version check to doctor | Small, clear |
| 6 | Fix `init.ts` uiLevel selection discarded | Simple bug fix |
| 7 | Fix `continue.ts` failed session handling | Medium scope, clear flow |
| 8 | Implement rollback on partial `apply-plan` failure | Enhancement, well-scoped |
| 9 | Add SvelteKit detection | Feature gap, clear scope |
| 10 | ABAC condition evaluation engine | Algorithmic, interesting problem |
| 11 | Wire `setupTotp` to route handler | Small, well-defined |
| 12 | Write Production Deployment guide | Docs-only, no code knowledge needed |
| 13 | Test sedim on macOS | No code changes, just verification |
| 14 | Sync schema.md with actual Prisma schemas | Docs-only, easy |
| 15 | Fix adapters.md export names | Docs-only, easy |
| 16 | Delete dead `email.ts` file | Simple cleanup |
| 17 | Re-export framework adapters from `adapters/index.ts` | Small, clear API improvement |
| 18 | Add srcDir to VitePress config (docs) | Good first issue, easy |
| 19 | Add Dependabot | No code changes, just config |
| 20 | Add CODEOWNERS file | One file, no code |

---

## PART 4: IMMEDIATE ACTION CHECKLIST

### Before announcing / open-sourcing:

- [ ] Fix import paths in all 5 framework adapter files (`../core/` → `../../core/`)
- [ ] Add missing `generateBackupCodes` import to operations.ts
- [ ] Replace `require()` with `import()` in framework-config.ts
- [ ] Add `srcDir: 'src'` to `apps/docs/.vitepress/config.ts`
- [ ] Fix `apps/docs/public/_redirects` to `/* /index.html 200`
- [ ] Create or remove references to `favicon.svg` and `logo.svg`
- [ ] Fix all 14 TypeScript errors in auth package
- [ ] Fix turbo.json schema URL (`tubro` → `turbo`)
- [ ] Uncomment auth project in root `vitest.config.ts`
- [ ] Install `@oslojs/crypto` dependency in auth package
- [ ] Add `ci.yml` workflow for typecheck + build + lint
- [ ] Create `sedim-dev` GitHub org, transfer repo
- [ ] Open 10–12 labeled GitHub Issues (bugs + features + good first issues)
- [ ] Enable GitHub Discussions
- [ ] Add CODEOWNERS file
- [ ] Set up Dependabot on all package.json files

### Not yet:
- [ ] CLA
- [ ] Test coverage gating
- [ ] Complex CI with e2e tests
- [ ] More than 12 issues at once

---

## PART 5: SEPARATION OF CONCERNS — LEAKY ABSTRACTIONS

**Date:** 2026-05-24
**Severity:** Architecture — Auth-specific concerns embedded in generic CLI layer

### The Problem

The CLI engine (`packages/cli/`) is designed to be **module-agnostic** — it should be able to stamp any feature module (auth, chat, payments, etc.) without knowing anything about the module's domain. The auth module (`packages/auth/`) should own all auth-specific knowledge: UI components, OAuth provider setup flows, env var schemas, page templates.

Currently, several auth-specific concerns have leaked into the CLI layer, making it harder to:
1. Add new modules without carrying auth knowledge forward
2. Reuse the CLI for non-auth modules (chat, billing, etc.)
3. Maintain auth-specific prompts/guides independently of the CLI release cycle

### Where the Leaks Are

#### 1. `packages/cli/src/showbaby/prompts.ts` — Auth env vars and OAuth guide text

**Lines 69–374** contain auth-specific content:
- `OAUTH_SETUP_LINKS` / `OAUTH_SETUP_LINKS_BY_PROVIDER` — hardcoded Google/GitHub/Discord URLs and names
- `collectEnvValues()` — groups env vars by `SMTP_`, `GOOGLE_`, `GITHUB_`, `DISCORD_` prefixes (auth-specific categories)
- `showDetailedGoogleGuide()` / `showDetailedGithubGuide()` / `showDetailedDiscordGuide()` — full OAuth step-by-step instructions embedded in generic prompt helpers
- `promptEnvVarWithSkip()` — hardcoded 10-char length validation specific to OAuth client secrets

**Should be:** Generic prompt helpers (`confirm`, `select`, `text`, `multiselect`, `handleCancel`) with auth-specific prompts moved to the auth module's own UX layer or `plan-config.ts`.

#### 2. `packages/cli/src/showbaby/oauth-guide.ts` — Entire file is auth-specific

This entire file is OAuth setup knowledge for Google, GitHub, and Discord:
- `showOAuthSetupGuide()` — entry point called when user declines the plan
- `showGoogleGuide()` / `showGithubGuide()` / `showDiscordGuide()` — step-by-step credential setup instructions
- `showQuickEnvSummary()` — env var quick reference with hardcoded examples (`GOOGLE_CLIENT_ID`, `SMTP_HOST`, etc.)
- `getExample()` — maps auth env var names to example values

**Should be:** Lives in `packages/auth/src/` — either as a dedicated `showbaby/` subdirectory within the auth module, or inlined in `plan-config.ts` as part of the interactive setup flow.

#### 3. `packages/cli/src/thinker/resolve-template.ts` — Auth page builders in generic resolver

**Lines 60–71** (`generatedKeys`) and **lines 150–183** (`applySubstitutions`) hardcode auth-specific generated content:

```typescript
const generatedKeys: Record<string, ...> = {
  'ui/pages/login-page': f => buildLoginPage(f),
  'ui/pages/signup-page': f => buildSignupPage(f),
  'ui/pages/forgot-password-page': f => buildForgotPage(f),
  'ui/pages/reset-password-page': f => buildResetPage(f),
  'db/client': (_f, c) => buildDbClientFile(c),
}
```

And auth-specific vars:
- `PROVIDERS_CONFIG` — builds OAuth provider array
- `UI_EXPORTS` — conditional exports for Login/Signup/MagicLink/OAuth/TOTP forms
- `LOGIN_PAGE`, `SIGNUP_PAGE`, `FORGOT_PAGE`, `RESET_PAGE` — generated page content
- `API_BASE_PATH` — derived from framework but used auth-specifically

**Should be:** The auth module's `plan-config.ts` should provide template generation functions. The CLI's `resolve-template.ts` should only handle **path resolution** (finding the right file) and **substitution injection** (replacing `{{VAR}}` tokens with context-derived values). Content generation belongs in the module.

### What Stays Where

| Layer | What it owns |
|-------|-------------|
| `packages/cli/src/showbaby/` | Generic UX primitives: `confirm`, `select`, `text`, `multiselect`, `handleCancel`, spinners, banners, log helpers |
| `packages/auth/src/` | Auth-specific: OAuth guides, env var grouping/validation, auth page builders, provider setup links |
| `packages/cli/src/thinker/resolve-template.ts` | Path resolution + `{{VAR}}` substitution engine — no content generation |
| `packages/auth/src/plan-config.ts` | Auth-specific content generation, env var schemas, feature selection prompts |

### Refactoring Direction

1. **`showbaby/prompts.ts`** — extract `collectEnvValues` into two layers: a generic `collectEnvValues` that takes typed `EnvVarPromptConfig[]`, and auth-specific `AuthEnvVarPromptConfig` that provides the groupings and OAuth guide display. OAuth guide functions move to `packages/auth/src/showbaby/oauth-guide.ts`.

2. **`showbaby/oauth-guide.ts`** — move entire file to `packages/auth/src/showbaby/oauth-guide.ts` and export `showOAuthSetupGuide`, `showQuickEnvSummary` from `packages/auth/src/plan-config.ts` or a new auth UX entry point.

3. **`resolve-template.ts`** — remove `generatedKeys` and page builder functions (`buildLoginPage`, etc.). Replace with a module-provided `TemplateGenerator` callback registered via `loadPlanConfig`. The CLI provides the resolution engine; modules provide content generators.

### Impact

This is not blocking for launch — it's architectural debt. The CLI works for auth today. But if you want to ship a second module (e.g., `sedim add chat`) without carrying Google/GitHub/Discord knowledge into the CLI core, these leaks need to be sealed first.

### Commit Classification

The work above is already tracked across commit history. The recommended clean commit breakdown for future work:

| Commit | Files |
|--------|-------|
| **CLI(core): Generic engine** | `packages/cli/src/detector/detect-*.ts`, `packages/cli/src/planning/types.ts`, `packages/cli/src/session/*.ts`, `packages/cli/src/index.ts`, `packages/cli/src/shared/ensure-project.ts` |
| **CLI(ux): Generic UX primitives** | `packages/cli/src/showbaby/intro.ts`, `packages/cli/src/showbaby/steps.ts`, `packages/cli/src/showbaby/summary.ts`, `packages/cli/src/showbaby/errors.ts` |
| **CLI(thinker): Plan building and resolution** | `packages/cli/src/thinker/build-plan.ts`, `packages/cli/src/thinker/manifest-to-plan-config.ts`, `packages/cli/src/thinker/classify-conflicts.ts`, `packages/cli/src/thinker/load-module-manifest.ts`, `packages/cli/src/thinker/index.ts` |
| **CLI(writer): File operations** | `packages/cli/src/writer/*.ts`, `packages/cli/src/commands/*.ts` (except add.ts which has auth wiring) |
| **CLI(frontend): Bootstrap companion app** | `packages/cli/src/frontend/bootstrap.ts`, `packages/cli/src/detector/detect-frontend.ts` |
| **Auth(core): Pure auth logic** | `packages/auth/src/core/*.ts` (except email.ts), `packages/auth/src/contracts/index.ts` |
| **Auth(adapters): Framework adapters** | `packages/auth/src/adapters/framework/*.ts`, `packages/auth/src/adapters/drizzle.ts`, `packages/auth/src/adapters/prisma.ts`, `packages/auth/src/adapters/types.ts`, `packages/auth/src/adapters/index.ts` |
| **Auth(ui): Auth UI components** | `packages/auth/src/ui/**/*.tsx`, `packages/auth/src/ui/**/*.css`, `packages/auth/src/ui/auth-client.ts`, `packages/auth/src/ui/use-auth.ts` |
| **Auth(templates): Page templates for stamping** | `packages/auth/src/templates/**/*.ts` |
| **Auth(plan-config): Auth module stamping rules** | `packages/auth/src/plan-config.ts`, `packages/auth/src/schema/*.ts` |
| **Auth(tests): Auth test suite** | `packages/auth/src/__tests__/*.ts` |
| **Registry: Module manifest** | `registry/auth/latest.json` |
| **Playground: Updated fixture** | `apps/playground/nextjs-drizzle-ts/sedim.config.ts`, `apps/playground/nextjs-drizzle-ts/src/app/layout.tsx` |





//////////////////////////////////////////////////////////////
what I was thinking was having a web/docs part is a must for this, but those will be like usage and feature docs, what I'm also thinking of doing is having a blog series around how I'm makign this, 
  what it'll solve, what are the capaibilites, examples, etc etc, also having a few youtube videos, and then finally also another crazy thing I was thinking of doing was creating like a resource by compiling 
  these RFCs and best practices and all of that for these commonly used full stack features into a standard implementation for each, think RFCs but for full features, currently only spread out blogs or videos or
  forums exist that help with these, not proper code that standardizes this neither are there compilations except courses, but even courses miss this stuff out, let me explain a bit more, if I as a beginner 
  developer were to implement auth, I would use some blogs, forums or those youtube videos, which btw give a little incomplete info too, like nobody tells about RFCs or about PKCE or TOTP, magic links, OIDC,etc,
  so devs easily miss this out too, then even if they don't post the discovery part, they don't understand what to study for implementing auth particularly coz it's far spread, also security considerations are 
  easily missed out, now professionals would either use ai or would use a library for auth, both of which have their cons as you might understand, speed, tokens, accuracy, and then black box, customization, 
  runtime deps, respectively, so now having a whole standard implementation and concepts compilation for these, like for auth, for chat, notifs,etc etc, would be an insane way to, one give back to the community 
  in form of an educational resource, two, drive traffic to sedim because the standard implementation code we're going to promote is the code present in the core of the sedim modules, what exactly do you 
  understand from this, give me the good and bad sides of this, the challenges and the returns, how good is it, then going on to the execution, I'm thinking of creating a repository under the sedimie org for 
  this, that'll host a website like rfc but for features, docs website kinda thing, so suggest a few names for that and if thats the rigth approach. 