# First Auth Setup

After running `sedim add auth`, here's how to wire everything up and test it.

## 1. Configure sedim.config.ts

Open `sedim.config.ts` in your project root. It looks like this:

```ts
import type { SedimConfig } from '@sedim/core'

export default {
  framework: 'express',
  orm: 'prisma',
  db: 'mongodb',
  preferences: {
    ui: 'headless',
    confirmBeforeWrite: true,
    dryRunByDefault: false,
  },
} satisfies SedimConfig
```

The `preferences.ui` should match what you chose during setup. If you chose **headless**, Sedim stamps API endpoints but no UI pages. You'll need to build your own login/signup forms. If you chose **tailwind** or **themed**, pages are auto-generated.

## 2. Set up environment variables

Create a `.env` file in your project root:

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
AUTH_SECRET=your-secret-at-least-32-chars

# For OAuth + magic link
APP_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

# Email (for magic link + password reset)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=your-resend-api-key
SMTP_PASS=
SMTP_FROM=noreply@yourdomain.com
```

## 3. Get OAuth credentials

### Google

1. Go to [console.cloud.google.com](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select existing)
3. **Credentials → Create Credentials → OAuth client ID**
4. Application type: **Web application**
5. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
6. Copy **Client ID** and **Client Secret**

### GitHub

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. **New OAuth App**
3. Application name: `My App`
4. Homepage URL: `http://localhost:3000`
5. Authorization callback URL: `http://localhost:3000/auth/github/callback`
6. Register and copy **Client ID** and **Client Secret**

### Discord

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application**
3. **OAuth2 → General**
4. Redirects: `http://localhost:3000/auth/discord/callback`
5. Copy **Client ID** and **Client Secret**

## 4. Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

Paste the result as `AUTH_SECRET` in your `.env`.

## 5. Run database migrations

```bash
# For Prisma
npx prisma migrate dev --name add_auth

# For Drizzle
npx drizzle-kit push
```

## 6. Test the auth flow

Start your dev server:

```bash
npm run dev
```

### Test signup

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt   # saves the session cookie
```

### Test session

```bash
curl http://localhost:3000/auth/session -b cookies.txt
```

## 7. OAuth callback URLs

When deploying to production, update your OAuth redirect URIs:

| Provider | Production redirect URI |
|----------|------------------------|
| Google | `https://yourdomain.com/auth/google/callback` |
| GitHub | `https://yourdomain.com/auth/github/callback` |
| Discord | `https://yourdomain.com/auth/discord/callback` |

Also update `APP_URL` in your `.env` to your production URL.

## Next Steps

- [Auth Configuration](../auth/config) — full `sedim.config.ts` reference
- [Auth Features](../auth/features) — what each auth feature does
- [Framework Adapters](../auth/adapters) — how to wire into Express, Hono, Next.js