# Production Checklist

Before deploying your Sedim-powered app to production.

## Environment Variables

### Required

```env
AUTH_SECRET=               # 32+ byte random hex string — used for session tokens and TOTP encryption
DATABASE_URL=              # PostgreSQL or MySQL connection string
```

### OAuth Providers

```env
OAUTH_GOOGLE_ID=           # Google OAuth client ID
OAUTH_GOOGLE_SECRET=       # Google OAuth client secret

OAUTH_GITHUB_ID=           # GitHub OAuth client ID
OAUTH_GITHUB_SECRET=       # GitHub OAuth client secret

OAUTH_DISCORD_ID=          # Discord OAuth client ID
OAUTH_DISCORD_SECRET=      # Discord OAuth client secret
```

### Email (Optional)

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@yourdomain.com
```

### Rate Limiting

```env
RATE_LIMIT_MAX=100         # Max requests per window (default: 100)
RATE_LIMIT_WINDOW=900000  # Window in ms (default: 15 min)
```

## Database

- [ ] Run migrations: `drizzle migrate` or `prisma migrate deploy`
- [ ] Verify tables exist: `users`, `sessions`, and any feature-specific tables
- [ ] Indexes on `userId` and `expiresAt` columns

## OAuth Callbacks

For each OAuth provider, add your production callback URL:

| Provider | Callback URL |
|----------|-------------|
| Google | `https://yourdomain.com/auth/oauth/google/callback` |
| GitHub | `https://yourdomain.com/auth/oauth/github/callback` |
| Discord | `https://yourdomain.com/auth/oauth/discord/callback` |

## Security Checklist

- [ ] `AUTH_SECRET` is a strong random value, not a password or phrase
- [ ] `NODE_ENV=production`
- [ ] HTTPS enforced (or at minimum, `secure` flag on session cookies)
- [ ] Rate limiting enabled (default is on)
- [ ] CORS configured for your frontend domain
- [ ] `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` headers set

## Monitoring

Sedim's auth operations emit structured errors that integrate with standard logging:

- Failed login attempts (with IP and user agent)
- Session expirations
- OAuth flow failures
- Rate limit hits

Log level `info` captures auth events, `debug` adds session lifecycle details.

## Rollback

Since stamped files are regular code in your repo, rollback is standard git operations:

```bash
# Revert to previous auth stamp
git revert HEAD --no-edit
git push

# Or cherry-pick a specific stamped version
git cherry-pick <commit-hash>
```