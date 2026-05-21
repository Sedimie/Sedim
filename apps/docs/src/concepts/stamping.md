# The Stamping Model

Sedim is a **stamp-based codegen tool** — not a library you import at runtime, not a SaaS you configure, not a framework you're locked into.

## How it works

When you run `sedim add auth`, Sedim:

1. Detects your stack (framework, ORM, database, language)
2. Loads the auth module manifest from the registry
3. Calls the module's `plan-config.ts` — a function that decides exactly what to stamp based on your stack and selected features
4. Writes stamped files to `src/sedim/<module>/`
5. Injects wiring imports into your existing entry files

The stamped files are **yours**. Sedim never runs again — your project is a standard Node.js/Next.js/Hono app that happens to have been partially written by a machine.

## Ownership model

| File type | `overwriteStrategy` | What it means |
|-----------|--------------------|---------------|
| Core logic | `skip` | Sedim never touches this again. You own it. |
| Config | `ask` | Sedim asks before overwriting so you don't lose your credentials. |
| Pages | `skip` | You edit these freely — Sedim won't overwrite them. |
| Schema | `skip` | You own your database schema. |

This means `sedim add auth --update` in the future can safely update the `skip` files in a way that doesn't destroy your customizations — the plan-config knows which files are "safe to update" vs "user-owned".

## Why not a library?

A library imports into your project and adds a runtime dependency. You import `import { auth } from 'sedim'` and now every request goes through Sedim's internals.

Sedim's stamped code has **no runtime dependency** on `@sedim/cli` or `@sedim/auth`. The stamped files import from:

- `argon2` — a standard password hashing library
- `@oslojs/crypto` — standard crypto
- Your ORM (`drizzle-orm`, `prisma`)
- Your email provider (nodemailer, resend, etc.)

When you run `sedim add auth` and then `npm run dev`, `@sedim/cli` and `@sedim/auth` are **not in your dependency tree**. They're development tools that generated code.

## The module system

A module is a package in `packages/<module-name>/` that provides:

- `src/plan-config.ts` — the stamping rules (a function, not a file — written in TypeScript)
- `src/templates/` — generated content that needs substitution (e.g. `{{DB_TABLE_NAME}}`)
- `src/<file>.ts` — verbatim source files (stamped as-is, except `.js` extensions are stripped)
- `registry/<module-name>/latest.json` — the module manifest (metadata + feature list)

The CLI loads `@sedim/<module-name>/plan-config` at runtime using the workspace's tsx, which handles TypeScript correctly without a build step.

## Registry

The registry (`registry/<module-name>/latest.json`) is a versioned manifest. It lists:

- Module version
- Available features (providers, UI tiers, session strategies, authorization models)
- Dependencies to install
- Environment variables required

The CLI checks a local `registry/` directory first (for offline use and dev), then falls back to the GitHub raw URL for the published version.

## Why "stamp"?

Because every file is a **stamp in an album** — it marks that this feature is installed here, it's part of your project, and you can see it all together under `src/sedim/`. It's not buried in `node_modules` or hidden behind a framework abstraction.

It also implies deliberate, permanent placement — you choose where to put the stamp, and it stays there.