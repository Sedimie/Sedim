# Contributing to Sedim

Thank you for wanting to contribute. This guide explains everything you need to know to work on the Sedim codebase.

---

## Quick Links

- [CLAUDE.md](CLAUDE.md) — project context for AI agents (read this first)
- [packages/cli/DESIGN_DOC.txt](packages/cli/DESIGN_DOC.txt) — CLI engine architecture
- [packages/auth/AUTH_INTERNALS.md](packages/auth/AUTH_INTERNALS.md) — auth module design decisions
- [AUTH_HARDENING_REPORT.txt](AUTH_HARDENING_REPORT.txt) — full security audit trail

---

## Setting Up

### Requirements

- **Node.js 18+** — minimum version enforced by the CLI
- **pnpm 9+** — this is a pnpm monorepo

### Install dependencies

```bash
git clone https://github.com/sedim-dev/sedim.git
cd sedim
pnpm install
```

### Build all packages

```bash
pnpm build
```

This uses Turbo to build packages in dependency order.

### Run tests

```bash
# All packages
pnpm test

# Auth module only
pnpm --filter @sedim/auth test

# CLI only
pnpm --filter @sedim/cli test
```

---

## Project Structure

```
sedim/
├── packages/
│   ├── auth/          Auth module (stamped into user projects)
│   ├── cli/           The Sedim CLI engine
│   └── core/          Shared TypeScript types used by both
├── apps/
│   ├── playground/    Fixture apps for integration testing
│   └── docs/          Documentation site (VitePress)
├── registry/
│   └── auth/latest.json   Module manifest (loaded by CLI)
└── CLAUDE.md          This file's companion — AI-readable project context
```

---

## How Stamping Works

Sedim's core concept is **stamped code** — the CLI generates files that the user owns and edits. This has specific implications for how you develop:

### Never add runtime library imports to stamped files

Stamped files run in the user's project, which may or may not have `@sedim/auth` installed. If you add `import { something } from '@sedim/auth'` to a stamped file, it will break in the user's project.

### Core logic stays in `packages/auth/src/core/`

Files in `core/` (hash-password, session, generate-token, pkce, totp, etc.) are the units that get stamped. If you need to add a new auth operation, add it in `core/` or `adapters/framework/operations.ts`, then wire it into the plan-config.

### To add a new auth feature:

1. Add the core logic in `packages/auth/src/core/`
2. Add schema tables in `packages/auth/src/schema/`
3. Update the plan-config (`packages/auth/src/plan-config.ts`) to include the new files
4. Add tests in `packages/auth/src/__tests__/`
5. Update the manifest (`registry/auth/latest.json`) when the version bumps
6. Test in a playground fixture

### Plan-config rules

- `overwriteStrategy: 'skip'` — core files never overwrite user's edits
- `overwriteStrategy: 'ask'` — user-facing files (config, pages) ask first
- `overwriteStrategy: 'overwrite'` — templates, never used on user-owned files

---

## CLI Development

The CLI is in `packages/cli/`. Key directories:

| Directory | Purpose |
|-----------|---------|
| `src/commands/` | 6 commands: `init`, `add`, `continue`, `doctor`, `plan`, `diff` |
| `src/detector/` | Stack detection (framework, ORM, language) |
| `src/thinker/` | Planning engine — manifest → InstallPlan |
| `src/writer/` | Plan executor — writes files, patches, injects code |
| `src/showbaby/` | All UX prompts and spinners |
| `src/config/` | `sedim.config.ts` read/write/validate |

### Running the CLI in dev mode

```bash
pnpm --filter @sedim/cli dev -- add auth --dry-run
```

Use `--dry-run` while developing to avoid writing files.

### How to add a new CLI command

1. Create `src/commands/newcommand.ts` exporting `runNewcommand`
2. Import and register it in `src/index.ts`
3. Use the same patterns as existing commands (`add.ts` is the most complete reference)

---

## Auth Module Development

### Running auth tests

```bash
cd packages/auth
pnpm test
```

All 11 test files live in `src/__tests__/`. Vitest is configured in `vitest.config.ts`.

### TypeScript must pass

```bash
cd packages/auth
npx tsc --noEmit --skipLibCheck
```

All non-template source must compile without errors. Only `templates/config.ts` (a mustache template with `{{PLACEHOLDERS}}`) is allowed to have TS errors.

### Adding a new test file

1. Create `src/__tests__/new-feature.test.ts`
2. Use the `mock-db.ts` for any `DatabaseAdapter` needs
3. Import from the actual source files (not from stamped paths)

---

## Playground Fixtures

Fixtures live in `apps/playground/`. Each is a real application used for integration testing.

### Adding a new fixture

1. Create a new directory under `apps/playground/`
2. Include a `package.json` and a minimal real app
3. Add to the testing instructions in CLAUDE.md

### Testing stamping locally

From the monorepo root, run:

```bash
# Navigate to a fixture
cd apps/playground/nextjs-drizzle-ts

# Initialise sedim (writes sedim.config.ts)
node ../../packages/cli/src/index.ts init --force

# Stamp auth (dry run first)
node ../../packages/cli/src/index.ts add auth --dry-run

# If dry-run looks good, actually stamp
node ../../packages/cli/src/index.ts add auth

# Verify the stamped code compiles
cd src/sedim/auth && npx tsc --noEmit
```

The path `../../packages/cli/src/index.ts` assumes running from inside a playground fixture. Adjust accordingly.

---

## Registry

Module manifests are stored in `registry/<module>/latest.json`.

The CLI loads manifests from:
1. **Local first** — `registry/<module>/latest.json` (for offline dev)
2. **GitHub remote** — `https://raw.githubusercontent.com/sedim-dev/registry/main/modules/<module>/latest.json`

To update the auth manifest after a version bump, edit `registry/auth/latest.json` directly.

---

## Code Style

- **TypeScript** — strict mode, no `any`, use `unknown` and narrow properly
- **Vitest** for all tests
- **Biome** for linting and formatting (see `biome.json` at root)
  ```bash
  pnpm biome check .
  pnpm biome format --write .
  ```

---

## Commit Messages

Use conventional commits:

```
feat(auth): add OIDC id_token validation
fix(cli): correct dry-run flag propagation
docs: update auth module feature table
test(auth): add oidc.test.ts
```

---

## Questions?

Open an issue at https://github.com/sedim-dev/sedim — or open a discussion if you're unsure whether a change belongs in core or in a stamped file.

---

*Last updated: 2026-05-20*