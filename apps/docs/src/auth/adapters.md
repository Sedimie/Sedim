# Framework Adapters

Sedim's auth module ships with first-class adapters for Express, Hono, and Next.js App Router.

## Express

```typescript
import { createAuthRouter } from '@sedim/auth/adapters';

const authRouter = createAuthRouter({
  prefix: '/auth',
  config: { secret: process.env.AUTH_SECRET! },
});

// Register in your app
app.use(authRouter);
```

All auth endpoints are mounted under the prefix. The default prefix is `/auth`.

## Hono

```typescript
import { createHonoAuthRouter } from '@sedim/auth/adapters';
import { Hono } from 'hono';

const app = new Hono();
const authRouter = createHonoAuthRouter({ prefix: '/auth' });

app.route('/api', authRouter);
```

## Next.js App Router

```typescript
import { createNextAuthHandler } from '@sedim/auth/adapters';

export const POST = createNextAuthHandler({
  secret: process.env.AUTH_SECRET!,
});
```

Put the handler in `app/api/auth/[...catchall]/route.ts` to handle all auth routes under `/api/auth`.

## Operations

Each adapter exposes these endpoint groups:

| Group | Endpoints |
|-------|-----------|
| Session | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Password | `POST /auth/signup`, `POST /auth/verify-email` |
| Magic Link | `POST /auth/magic-link`, `GET /auth/magic-link/verify` |
| OAuth | `GET /auth/oauth/:provider`, `GET /auth/oauth/:provider/callback` |
| TOTP | `POST /auth/totp/setup`, `POST /auth/totp/verify`, `POST /auth/totp/disable` |
| JWT | `POST /auth/refresh`, `POST /auth/revoke` |

## Middleware

RBAC and ABAC middleware factories are exported from `@sedim/auth/adapters`:

```typescript
import { requireRole, hasPermission } from '@sedim/auth/adapters';

// Protect routes by role
router.post('/admin', requireRole('admin'), adminHandler);

// Check permissions programmatically
if (hasPermission(user, 'resource', 'write')) { ... }
```