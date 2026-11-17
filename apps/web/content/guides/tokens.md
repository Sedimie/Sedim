---
title: Understanding Tokens & Refresh Token Rotation
description: Architectural concept guide explaining JWTs, stateless verification, and refresh token rotation mechanics according to RFC 7519 and RFC 6749.
slug: guides/tokens
date: 2026-06-01
tags:
  - security
  - tokens
  - jwt
  - rfc7519
---

# Understanding Tokens & Refresh Token Rotation

Every client-server application faces an inherent architectural tension between **performance** and **revocability**:

- If every incoming request requires a database lookup to verify the session, database latency becomes the floor for all throughput.
- If requests are validated statelessly using cryptographic signatures, tokens cannot be revoked immediately if a device is compromised.

Modern identity architecture solves this trade-off using a dual-token model grounded in **RFC 7519 (JSON Web Tokens)** and **RFC 6749 (OAuth 2.0)**: short-lived **access tokens** combined with strictly rotated **refresh tokens**.

---

## The Dual-Token Model

Instead of relying on a single long-lived credential, authentication is divided into two distinct responsibilities:

```
┌────────────────────────────────────────────────────────┐
│                      Client                            │
└────────────┬─────────────────────────────▲─────────────┘
             │ 1. Request with Access Token│
             │    (Authorization: Bearer)  │ 2. Data Response
             ▼                             │
┌─────────────────────────────┐            │
│       Resource Server       ├────────────┘
│  (Stateless Signature Check)│
└────────────┬────────────────┘
             │
             │ Access Token Expired (15 min)
             ▼
┌─────────────────────────────┐
│     Authorization Server    │
│ (Rotates Single-Use Refresh)├────────────┐
└─────────────────────────────┘            │ 3. New Access Token
             ▲                             │    + New Refresh Token
             └─────────────────────────────┘
```

### 1. Access Tokens (Stateless Verification)
- **Lifespan**: Short (typically 5 to 15 minutes).
- **Format**: Signed compact JSON object (RFC 7519) containing identity claims (`sub`, `iss`, `exp`, `iat`).
- **Verification**: Resource servers verify the token using public key cryptography (RS256/EdDSA) or shared secrets (HS256) **without querying any database**.
- **Security Boundary**: Because access tokens expire in minutes, the window of vulnerability if a token is intercepted is strictly bounded.

### 2. Refresh Tokens (Stateful Revocation)
- **Lifespan**: Long (days to weeks).
- **Format**: High-entropy opaque random string or signed state identifier stored securely (e.g. in an `httpOnly`, `secure`, `sameSite=lax` cookie).
- **Verification**: Evaluated by the auth server against persistence when the access token expires.
- **Security Boundary**: Provides the authority to issue new access tokens. If a user logs out, changes passwords, or is flagged as compromised, the refresh token is revoked in the database.

---

## Refresh Token Rotation (RTR)

The primary threat to long-lived refresh tokens is **theft via compromised storage or network eavesdropping**. Once an attacker acquires a refresh token, they can perpetually generate new access tokens.

**Refresh Token Rotation (RTR)** eliminates this attack vector by enforcing a fundamental invariant:

> **Every refresh token can be used exactly once.**

When a client exchanges a refresh token for a new access token, the auth server invalidates the supplied refresh token and issues a completely new refresh token.

```
Request 1:   Token A  ──►  Server validates Token A  ──►  Returns [Access Token 1, Token B]
                                                          (Token A marked as consumed)

Request 2:   Token B  ──►  Server validates Token B  ──►  Returns [Access Token 2, Token C]
                                                          (Token B marked as consumed)
```

---

## Automatic Replay Detection

What happens if an attacker intercepts `Token A` before the legitimate client uses it?

1. **Attacker uses Token A**: The server issues `Token B1` to the attacker. `Token A` is marked as consumed.
2. **Legitimate client attempts to use Token A**: The client presents `Token A` to renew its session.
3. **Replay Triggered**: The server detects that `Token A` has **already been used**.

```
                           ┌───────────────────────────────┐
Token A presented again ──►│ Replay Attack Alarm Triggered!│
                           └───────────────┬───────────────┘
                                           │
                                           ▼
             Invalidate the ENTIRE Token Family (A, B1, and all descendants)
             Force complete re-authentication on all devices.
```

Because `Token A` was already spent, the server knows an illegitimate party has cloned the token stream. Instead of trying to guess which party is genuine, the server immediately **revokes the entire token family**, locking out both the attacker and protecting user data.

---

## Storage Best Practices

| Storage Mechanism | Vulnerability | Recommendation |
| :--- | :--- | :--- |
| `localStorage` | Vulnerable to Cross-Site Scripting (XSS) | **Never** store tokens in web `localStorage` or `sessionStorage`. |
| `httpOnly Cookie` | Immune to XSS; vulnerable to CSRF | **Recommended**: Store refresh tokens in `httpOnly`, `secure`, `sameSite: 'lax'` cookies with CSRF token guards. |
| In-Memory Variable | Immune to persistent theft; lost on reload | **Recommended**: Keep short-lived access tokens in application memory only. |

---

## Now use it

Instead of assembling token rotation, crypto key pairs, and family tracking from scratch, stamp the production-ready implementation directly into your project:

```bash
sedim add auth
```
