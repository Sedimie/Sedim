---
title: JWT Architecture and Refresh Token Rotation
description: How short-lived JWT access tokens pair with rotating refresh tokens to balance stateless verification and immediate revocation.
slug: auth/tokens
date: 2026-06-01
tags:
  - auth
  - jwt
  - tokens
  - security
  - groundwork
---

## Why Pure JWTs Fail at Scale

JSON Web Tokens (JWTs) are popular because microservices and edge workers can verify user identities without a database roundtrip. However, using long-lived JWTs directly in clients creates severe security vulnerabilities:

- **Unstoppable Compromise**: If an access token with a 30-day lifetime is intercepted (via XSS, network sniffing, or proxy logs), there is no standard way to revoke it before it expires.
- **Payload Bloat**: Encoding permissions, user metadata, and roles into every request header increases bandwidth overhead across high-frequency API calls.
- **Revocation Lists Defeat Statelessness**: Maintaining a blacklist of revoked JWTs requires distributed state, reintroducing the exact database lookup JWTs sought to eliminate.

---

## The Dual-Token Architecture

To capture the benefits of stateless edge verification while maintaining strict security controls, production architectures use a **dual-token model**:

```
Client                      Edge / API Gateway               Database / Auth Server
  │                                │                                │
  │─── Request + Access Token ────>│ (Verifies signature locally)   │
  │<── API Response ───────────────│                                │
  │                                                                 │
  │ (Access token expires after 15m)                                │
  │                                                                 │
  │─── POST /api/auth/refresh ─────────────────────────────────────>│
  │    (Sends single-use Refresh Token)                             │ (Validates & Rotates)
  │<── New Access Token + New Refresh Token ────────────────────────│
```

### 1. Access Token (Short-Lived)
- **Lifetime**: 5 to 15 minutes.
- **Format**: Signed JWT (HS256 with shared secret or RS256/ES256 with asymmetric key pairs).
- **Storage**: In-memory JavaScript state or short-lived cookie.
- **Role**: Carries claims (`sub`, `exp`, `role`) for rapid, stateless signature verification at edge proxies or internal microservices.

### 2. Refresh Token (Long-Lived & Stateful)
- **Lifetime**: 7 to 30 days.
- **Format**: Opaque, high-entropy cryptographic token.
- **Storage**: `HttpOnly`, `Secure`, `SameSite=Strict` cookie or encrypted client vault.
- **Role**: Only sent to the dedicated `/refresh` endpoint to mint a new access token.

---

## Refresh Token Rotation and Reuse Detection

Static refresh tokens can be stolen and used repeatedly. The RFC 6819 standard enforces **Automatic Refresh Token Rotation (RTR)**:

1. **One-Time Use**: Whenever a client presents a refresh token to mint a new access token, the auth server **invalidates** that refresh token and returns a newly generated refresh token alongside the new access token.
2. **Family Tracking**: Every refresh token belongs to a session family.

### The Attack Scenario and Reuse Detection

Consider what happens when an attacker intercepts a refresh token:

```
Step 1: Attacker intercepts Token A.
Step 2: Legitimate client uses Token A to refresh -> Server replaces Token A with Token B.
Step 3: Attacker later attempts to use stolen Token A.
```

When the server detects that Token A (already invalidated) is being used again:
- This is a definitive signal that **token theft has occurred**.
- The server does not just reject the request: it **immediately revokes Token B and terminates the entire session family**.
- Both the attacker and the legitimate user are logged out, protecting the account from further unauthorized actions.

---

## Cryptographic Considerations

- **Signature Validation**: Always verify the `alg` header matches expected configurations to prevent algorithm-confusion attacks (e.g., `none` algorithm exploit).
- **Audience and Issuer**: Strict validation of `iss` (issuer) and `aud` (audience) claims prevents cross-application token reuse.
- **Asymmetric Signing**: For polyglot microservice environments, prefer asymmetric signing (Ed25519 or ES256) so worker services only require the public key and can never forge tokens.

---

Now use it: `sedim add auth`
