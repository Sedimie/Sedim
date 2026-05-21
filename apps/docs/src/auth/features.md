# Auth Features

Complete reference of all auth features available in the auth module.

## Feature Matrix

| Feature | Description | Tables Added |
|---------|-------------|--------------|
| `email-password` | Classic email + password auth with Argon2id hashing | `users`, `sessions` |
| `magic-link` | Passwordless email login with one-time tokens | `otp_tokens` |
| `google-oauth` | Google OAuth2 with PKCE | `oauth_accounts` |
| `github-oauth` | GitHub OAuth2 with PKCE | `oauth_accounts` |
| `discord-oauth` | Discord OAuth2 with PKCE | `oauth_accounts` |
| `totp` | TOTP 2FA (Google Authenticator compatible) | `totp_credentials`, `backup_codes` |
| `jwt` | JWT session strategy (alternative to session cookies) | `refresh_tokens` |
| `rbac` | Role-based access control middleware | None |
| `abac` | Attribute-based access control policy engine | None |
| `rate-limit` | Sliding-window rate limiting on auth endpoints | None |

## Always-Included Features

Every auth stamp includes:
- Password hashing with Argon2id (64MB, 3 iterations)
- Secure session management with sliding-window validation
- HTTP-only session cookies
- Account lockout after failed attempts
- CSRF protection via SameSite cookies
- PKCE on all OAuth flows (RFC 7636 S256)

## Session Strategy

Sessions are database-backed by default. The session token is a 40-character random string, SHA-256 hashed, stored as the session ID. The raw token lives in an `httpOnly` cookie.

This gives full revocation capability — any session can be invalidated server-side without touching the cookie.

## JWT Alternative

If you select `jwt` in your `sedim.config.ts`, sessions use signed JWTs instead. The access token is short-lived (15 min), stored in memory. A refresh token in an httpOnly cookie enables sliding renewal without re-authentication.