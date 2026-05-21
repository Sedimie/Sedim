# Auth Configuration

The `sedim.config.ts` in your project root configures the auth module.

## Full reference

```ts
import type { SedimConfig } from '@sedim/core'

export default {
  // Framework
  framework: 'express',      // 'nextjs' | 'express' | 'hono'

  // ORM
  orm: 'prisma',             // 'drizzle' | 'prisma'

  // Database (only for Drizzle — Prisma uses DATABASE_URL directly)
  db: 'postgresql',          // 'postgresql' | 'mysql' | 'sqlite' | 'mongodb'

  preferences: {
    ui: 'headless',          // 'headless' | 'tailwind' | 'themed'
    confirmBeforeWrite: true, // ask before stamping overwrite-able files
    dryRunByDefault: false,  // --dry-run by default
  },
} satisfies SedimConfig
```

## Framework

| Value | What gets stamped |
|-------|-------------------|
| `nextjs` | Next.js App Router handler at `src/app/api/auth/[...all]/route.ts` + UI pages |
| `express` | Express router at `/auth/*` + Express middleware |
| `hono` | Hono routes at `/auth/*` |

## ORM

| Value | Adapter stamped |
|-------|----------------|
| `drizzle` | `src/sedim/auth/adapters/drizzle.ts` |
| `prisma` | `src/sedim/auth/adapters/prisma.ts` |

## Database

Only needed for Drizzle. Used to generate the correct schema and db client.

| Value | What gets stamped |
|-------|-------------------|
| `postgresql` | `src/sedim/auth/schema.ts` with `pg` dialect types |
| `mysql` | `src/sedim/auth/schema.ts` with MySQL types (`int`, not `integer`) |
| `sqlite` | `src/sedim/auth/schema.ts` with SQLite types |
| `mongodb` | Schema uses MongoDB ObjectId types |

## UI Tiers

| Value | What you get |
|-------|-------------|
| `headless` | Unstyled API endpoints. LoginForm/SignupForm are styled with Tailwind-like classes but no CSS shipped — you control the UI entirely. |
| `tailwind` | Pre-styled components using Tailwind CSS classes. Works if your project already has Tailwind. |
| `themed` | Pre-built CSS themes — no Tailwind required. Theme variants: **modern** (glassmorphism + gradients), **minimal** (neumorphism), **colorful** (neubrutalism). |

## preferences.confirmBeforeWrite

When `true` (default), Sedim asks before stamping files that have `overwriteStrategy: 'ask'`. This is the `config.ts` file — your database connection and provider credentials. Always `true` in interactive mode.

## preferences.dryRunByDefault

When `true`, `sedim add auth` shows the plan but doesn't write any files. Most useful in CI or when exploring.

## Environment variables

These are not in `sedim.config.ts` — they're read at runtime from your `.env` file:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Database connection string |
| `AUTH_SECRET` | Yes | Random secret for session token signing. Generate with `openssl rand -base64 32` |
| `APP_URL` | For OAuth/magic link | Your app's public URL (e.g. `http://localhost:3000` in dev) |
| `GOOGLE_CLIENT_ID` | For Google OAuth | From console.cloud.google.com |
| `GOOGLE_CLIENT_SECRET` | For Google OAuth | From console.cloud.google.com |
| `GITHUB_CLIENT_ID` | For GitHub OAuth | From github.com/settings/developers |
| `GITHUB_CLIENT_SECRET` | For GitHub OAuth | From github.com/settings/developers |
| `DISCORD_CLIENT_ID` | For Discord OAuth | From discord.com/developers |
| `DISCORD_CLIENT_SECRET` | For Discord OAuth | From discord.com/developers |
| `SMTP_HOST` | For magic link / email verification | SMTP server hostname |
| `SMTP_PORT` | For magic link | 587 (TLS) or 465 (SSL) |
| `SMTP_USER` | For magic link | SMTP username |
| `SMTP_PASS` | For magic link | SMTP password or API key |
| `SMTP_FROM` | For magic link | From address (e.g. `noreply@yourdomain.com`) |