# Quick Start

Get from zero to running auth in under 5 minutes.

## Prerequisites

- Node.js 18+
- npm, pnpm, bun, or yarn

## 1. Install the CLI

```bash
npm install -g @sedim/cli
```

Verify it works:

```bash
sedim --version
```

## 2. Initialise your project

Run this inside your project directory. Sedim detects your framework, ORM, and database automatically.

```bash
cd my-project
sedim init
```

You'll see your detected stack:

```
  framework    express       high
  orm          prisma        high
  db           postgresql    high
  language     typescript   high
  modules      esm          high
  pkg manager  npm          high
```

If anything looks wrong, answer "No" and Sedim will ask you to correct it.

## 3. Add auth

```bash
sedim add auth
```

You'll be asked a few questions:

- **Providers** — email+password, magic link, OAuth (Google/GitHub/Discord), TOTP 2FA
- **UI style** — headless (unstyled), Tailwind, or themed
- **Session transport** — session cookies (recommended) or JWT

Sedim then shows you exactly what it will create:

```
  ┌─ CREATE ────────────────────────────────────────
  + src/sedim/auth/core/hash-password.ts
  + src/sedim/auth/core/session.ts
  + src/sedim/auth/core/totp.ts
  + src/sedim/auth/adapters/framework.ts
  + src/sedim/auth/config.ts
  + src/sedim/auth/index.ts
  + src/sedim/auth/routes.ts
  + src/sedim/auth/middleware.ts
  └───────────────────────────────────────────────────
```

Answer **Yes** to proceed. All files are created under `src/sedim/auth/` — they are fully owned by you.

## 4. Add environment variables

Sedim tells you which env vars to add. The critical ones are:

```bash
# Required
DATABASE_URL=postgresql://...
AUTH_SECRET=   # Run: openssl rand -base64 32

# Required for OAuth
APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# For magic link / password reset / email verification
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@yourdomain.com
```

## 5. Wire into your app

**Express:**

```ts
// src/app.ts
import { createExpressAuthRouter } from './sedim/auth/adapters/framework.js'
import { createSessionMiddleware } from './sedim/auth/adapters/framework.js'
import { createAuthRouter } from './sedim/auth/config.js'

app.use(createSessionMiddleware(createAuthRouter()))
app.use('/auth', createExpressAuthRouter(createAuthRouter()))
```

**Hono:**

```ts
// src/index.ts
import { createHonoAuthRouter } from './sedim/auth/adapters/framework.js'
import { createAuthRouter } from './sedim/auth/config.js'

app.route('/auth', createHonoAuthRouter(createAuthRouter()))
```

**Next.js:** No manual wiring needed. Sedim stamps a complete `src/app/api/auth/[...all]/route.ts`.

## 6. Run it

```bash
npm run dev
```

Visit:
- `/login` — login page
- `/signup` — signup page
- `/auth/session` — check session (returns JSON)

## Next Steps

- [First Auth Setup](./first-auth) — add OAuth credentials, test the full flow
- [CLI Reference](../cli/) — full command documentation
- [Auth Configuration](../auth/config) — all `sedim.config.ts` options