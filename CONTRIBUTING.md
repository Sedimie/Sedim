# Contributing to Sedim

Thank you for wanting to contribute. This guide explains everything you need to know to work on the Sedim codebase.

---

To start off, you'll need an overview of what's happening in the library, so first going through the readme in full is recommended. Post that, let's try to understand the architecture of the whole library a bit. 

This is a monorepo, with packages as the `core`, `cli`, `auth`, and other modules to be added in the future. 
`core` contains the shared types between the `cli` and any `module`. The `cli` is built such that any module can seemlessly fit into it and give the same experience to the user. 



## What can you contribute?

There are lots of ways to help, no matter your experience level:

- **Bug reports and bug fixes** - something is broken, you know how to fix it
- **New features** - a framework adapter, an ORM adapter, a new module
- **Feature additions under an existing module** - more auth providers, more UI components, more email transports
- **UI/UX improvements** - accessibility fixes, better form states, new theme variants
- **Documentation** - fixing broken links, clarifying confusing sections, writing guides
- **Feature requests** - you want something that does not exist yet
- **Testing** - adding tests to existing modules, testing on different platforms
- **Design** - helping design better auth UI components, visual refinements

If you're unsure whether something is worth contributing, just open an issue. We'd rather you ask than guess.

---

## Getting Started

### What you need

- **Node.js 18+**
- **pnpm 9+**

### Set up the project

```bash
git clone https://github.com/Sedimie/Sedim.git
cd Sedim
pnpm install
pnpm build
```

### Run tests

```bash
pnpm test                    # all packages
pnpm --filter @sedim/auth test   # auth module only
pnpm --filter @sedim/cli test   # CLI only
```

---

## Project Structure

```
Sedim/
├── packages/
│   ├── auth/          — the auth module (v0.2.0)
│   ├── cli/           — the Sedim CLI engine
│   └── core/          — shared types used by CLI and modules
├── apps/
│   ├── playground/    — fixture apps for testing
│   └── docs/          — VitePress documentation site
└── registry/
    └── auth/latest.json  — module manifest
```

---

## Where things live

| Directory | What it is |
|----------|------------|
| `packages/auth/src/core/` | Auth logic: hashing, sessions, tokens, PKCE, TOTP, RBAC, ABAC, JWT, email |
| `packages/auth/src/adapters/framework/` | Framework adapters: Next.js, Express, Hono |
| `packages/auth/src/adapters/` | ORM adapters: Drizzle, Prisma |
| `packages/auth/src/ui/` | React components: forms, auth-client, use-auth hook |
| `packages/auth/src/ui/themed/` | CSS token files for themed UI (modern, minimal, colorful) |
| `packages/auth/src/templates/` | Templates with variable substitution for stamped files |
| `packages/auth/src/schema/` | Database schemas for Drizzle and Prisma |
| `packages/cli/src/` | CLI commands, detector, thinker, writer, showbaby, config |
| `registry/auth/latest.json` | Module manifest that describes what gets stamped |

---

## How Stamping Works

When a user runs `sedim add auth`, the CLI reads from `packages/auth/src/` and stamps the selected files into the user's project. The user owns those files forever - they are not a runtime dependency.

This means one rule you should never break: **do not add imports from `@sedim/auth` into stamped files**. Stamped files run in the user's project, which may not have `@sedim/auth` installed.

---

## How the CLI Works

When you run `sedim add auth`, the CLI moves through four stages:

```
detector  →  thinker  →  writer
```

**1. Detector** (`packages/cli/src/detector/`)
Reads the user's project files and produces a `DetectedContext`: framework, ORM, database, language, module system, and project structure. This is what drives every decision downstream.

**2. Thinker** (`packages/cli/src/thinker/`)
`load-plan-config.ts` tries to load the module's own `plan-config.ts` via dynamic import. If it exists, it calls `createAuthPlanConfig(ctx, selectedFeatures)` to get a rich, framework-aware plan. If not, it falls back to a generic manifest-based planner.

`build-plan.ts` takes the plan config and selected features and produces an `InstallPlan`: what files to create, what to inject where, what dependencies to install, what env vars to add.

**3. Writer** (`packages/cli/src/writer/`)
`apply-plan.ts` executes the approved plan. It writes files (`write-file.ts`), injects imports and code snippets (`inject-imports.ts`, `inject-code.ts`), and updates `.env` (`update-env.ts`).

The session (`packages/cli/src/session/`) saves progress after each stage. If the process is interrupted, `sedim continue auth` picks up from where it left off.

**The plan-config is the module interface**
Each module's `plan-config.ts` is the contract between the module and the CLI. It exports a function that takes `DetectedContext` and `selectedFeatures[]` and returns a `PlanConfig` that describes exactly what to stamp. The CLI never needs to know anything specific about a module - it just reads the plan config and executes it.

---

## Ways to Contribute

### Fix a bug

If you found a bug, open an issue with the label `bug`. If you want to fix it yourself:

1. Check the issue to make sure it is confirmed
2. Fork the repo and create a branch from `main`
3. Fix it
4. Run `pnpm biome check .` to check formatting
5. Open a PR against `main`

### Add a framework adapter

The auth module currently supports Next.js, Express, and Hono. Adding a new framework adapter (e.g., Fastify, SvelteKit) is a great way to expand Sedim's reach.

Steps:

1. Create `packages/auth/src/adapters/framework/<framework>.ts` - look at `express.ts` or `hono.ts` as your reference
2. Implement the `DatabaseAdapter` interface and wire in all auth operations from `operations.ts`
3. Add the new framework to the detector in `packages/cli/src/detector/detect-framework.ts`
4. Add route and middleware templates in `packages/auth/src/templates/`
5. Test it with a new playground fixture or extend an existing one
6. Update the manifest in `registry/auth/latest.json`

### Add an ORM adapter

Drizzle and Prisma are currently supported. To add a new ORM (e.g., Prisma but for a different database, or a different ORM library):

1. Create `packages/auth/src/adapters/<orm>.ts`
2. Implement the `DatabaseAdapter` interface - look at `drizzle.ts` and `prisma.ts` for the shape
3. Add the new ORM detection in `packages/cli/src/detector/detect-orm.ts`
4. Add the schema template for the new ORM in `packages/auth/src/schema/`
5. Test it with the playground fixtures
6. Update the manifest

### Add a new module

Sedim is designed to support any feature module, not just auth. A module lives in `packages/<module-name>/` with its own `plan-config.ts` that tells the CLI what to stamp.

Steps:

1. Create `packages/<module-name>/src/` with your module source
2. Create `packages/<module-name>/src/plan-config.ts` exporting `create<ModuleName>PlanConfig`
3. Create `registry/<module-name>/latest.json` with the module manifest
4. The CLI will automatically pick it up via `load-plan-config.ts`

See the auth module's `plan-config.ts` as a reference - it maps feature selections to template keys and output paths.

### Add more features to the auth module

You can add to the auth module without building a whole new adapter:

- **New auth provider** (e.g., Apple OAuth, Microsoft OAuth) - add the provider to `framework-config.ts`, add PKCE flow to `operations.ts`, add UI button
- **New email transport** (e.g., Mailgun, AWS SES beyond the current setup) - extend `email-transport.ts`
- **New UI component** - add to `packages/auth/src/ui/` and wire it into `plan-config.ts`
- **New theme variant** - create a new CSS token file in `packages/auth/src/ui/themed/`
- **New database feature** - add to the schema files in `packages/auth/src/schema/`

Steps:

1. Add the feature code in the appropriate directory
2. Update `plan-config.ts` to include the new files when the feature is selected
3. Update `registry/auth/latest.json` if adding new features that change what gets stamped
4. Add tests
5. Test with `sedim add auth` in a playground fixture

### Improve the CLI

The CLI is in `packages/cli/src/`. You can work on:

- New commands (`src/commands/`)
- New detector strategies for frameworks, ORMs, or databases (`src/detector/`)
- Improving the thinker / planning engine (`src/thinker/`)
- Improving the writer / file operations (`src/writer/`)
- Improving the UX, prompts, spinners, and summaries (`src/showbaby/`)

### Improve documentation

The docs live in `apps/docs/`. If you find a broken link, an unclear explanation, or a missing guide, fix it. The docs are just Markdown files - you can edit them directly.

### Improve UI / accessibility

The auth module's UI components are in `packages/auth/src/ui/`. If you want to improve them:

- Accessibility: ARIA labels, keyboard navigation, focus management, screen reader support
- UX: better error states, loading states, form validation messages
- Design: visual refinements to the themed components, new theme variants

### Suggest a feature

Open an issue with the label `enhancement` or `feature-request`. Describe what you want to build, why it would be useful, and if possible, how you would approach it. For big features, it's good to discuss before implementing.

---

## Playground Fixtures

Fixtures are real apps in `apps/playground/` that the CLI is tested against. Each fixture is a minimal project with a specific stack.

Current fixtures:

| Fixture | Stack |
|---------|-------|
| `nextjs-drizzle-ts` | Next.js + Drizzle + TypeScript |
| `express-prisma-ts` | Express + Prisma + TypeScript |
| `hono-no-orm-js` | Hono + plain JS, no ORM |
| `nextjs-existing-auth` | Next.js with existing next-auth (tests conflict detection) |

To add a new fixture:

1. Create the project structure in `apps/playground/<fixture-name>/`
2. Add a minimal `sedim.config.ts` and the minimum files needed for the framework
3. Run through the full `sedim add auth` flow to verify it works
4. Test with `sedim diff auth` and `sedim add auth --dry-run` before running for real

To run a fixture test:

```bash
# Initialize
pnpm --filter @sedim/cli exec tsx src/index.ts init --force --cwd apps/playground/nextjs-drizzle-ts

# Preview what would be stamped
pnpm --filter @sedim/cli exec tsx src/index.ts diff auth --cwd apps/playground/nextjs-drizzle-ts

# Actually stamp
pnpm --filter @sedim/cli exec tsx src/index.ts add auth --cwd apps/playground/nextjs-drizzle-ts
```

To reset a fixture:

```bash
rm apps/playground/<fixture-name>/sedim.config.ts
rm -rf apps/playground/<fixture-name>/src/sedim/
```

Do not push any code changes that you do in the playground except setting up a new fixture. It's only for proof of work and testing integration locally instead of having to do npm link each time changes are made.

---

## Testing

### Auth module tests

Tests are in `packages/auth/src/__tests__/`. Run them with:

```bash
cd packages/auth
pnpm test
```

To add a new test:

1. Create `packages/auth/src/__tests__/your-feature.test.ts`
2. Use `mock-db.ts` for the `DatabaseAdapter`
3. Import from the actual source files, not from stamped paths

### CLI tests

CLI tests are in `packages/cli/src/__tests__/` or similar. Run them with:

```bash
cd packages/cli
pnpm test
```

### TypeScript must pass

Before submitting any PR:

```bash
cd packages/auth
npx tsc --noEmit --skipLibCheck
```

All non-template source must compile without errors. Only files with `{{PLACEHOLDERS}}` (template files) are allowed to have deliberate TS errors.

---

## Code Style

- **TypeScript** - strict mode, no `any`, narrow properly
- **Vitest** for all tests
- **Biome** for linting and formatting

Run Biome before committing:

```bash
pnpm biome check .
pnpm biome format --write .
```

Biome runs in CI. PRs that fail Biome checks will be blocked.

---

## Commit Messages

Use the `[type](scope)` format:

```
[CLI](commands) : add interactive confirm prompt before stamping
[AUTH](core) : add Apple OAuth provider support
[CLI](detector) : add SvelteKit framework detection
[AUTH](ui) : fix keyboard navigation on LoginForm
[DOCS] : add guide for setting up OAuth providers
[PLAYGROUND] : add Fastify fixture
```

Valid scope options:

| Scope | Where |
|-------|-------|
| `core` | packages/auth/src/core/ |
| `adapters` | packages/auth/src/adapters/ |
| `ui` | packages/auth/src/ui/ |
| `templates` | packages/auth/src/templates/ |
| `schema` | packages/auth/src/schema/ |
| `plan-config` | packages/auth/src/plan-config.ts |
| `thinker` | packages/cli/src/thinker/ |
| `writer` | packages/cli/src/writer/ |
| `detector` | packages/cli/src/detector/ |
| `showbaby` | packages/cli/src/showbaby/ |
| `commands` | packages/cli/src/commands/ |
| `docs` | apps/docs/ |
| `registry` | registry/ |

---

## Opening an Issue

If you find a bug or want to suggest a feature:

1. Search first to check if it already exists
2. For bugs: include what you expected, what happened, and steps to reproduce
3. For features: describe what you want to build and why it would help

Use the issue templates if they are available. Good issues get faster responses.

---

## Opening a Pull Request

1. Fork the repo and create a branch from `main`
2. Run `pnpm biome check .` and fix any issues
3. Make your changes
4. Test them - run the relevant fixture or tests
5. Push and open a PR against `main`
6. Describe what changed and why in the PR body

For big changes (a new framework adapter, a new module, a significant feature), open an issue first to discuss before doing the work. This saves you from building something that might need a different approach.

PRs are reviewed within a few days.

---

## Questions?

Open an issue at https://github.com/Sedimie/Sedim or drop a message on Discord.

---

*Last updated: 2026-05-24*