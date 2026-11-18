---
title: Database-Backed Sessions and Sliding Expiry
description: How database-backed sessions work, why raw session tokens must never be stored in plain text, and sliding-window validation.
slug: auth/sessions
date: 2026-06-01
tags:
  - auth
  - sessions
  - security
  - architecture
  - groundwork
---

## The Fundamental Dilemma: Stateless vs. Stateful Auth

Web authentication requires identifying a user across stateless HTTP requests. Two primary paradigms exist:

1. **Stateless Tokens (Pure JWTs in cookies or headers)**:
   - The token contains claims signed with a private secret.
   - The server validates the signature without querying a database.
   - **Critical weakness**: Cannot be immediately revoked without introducing external state. If a user changes their password, is banned, or logs out from another device, the old token remains fully valid until its expiration timestamp.

2. **Stateful Sessions (Database-backed)**:
   - The client holds an opaque cryptographic token.
   - The server checks the database on request to confirm the session is active and unrevoked.
   - **Tradeoff**: Immediate revocation and session visibility at the cost of a lightweight database or cache lookup.

For modern applications requiring reliable security controls (instant logout, fraud detection, remote session termination), stateful sessions are the industry standard.

---

## Token Security: Never Store Raw Session Tokens

A common architectural vulnerability is storing the session token plaintext in the database table:

```sql
-- DANGEROUS: If the database is read or dumped via SQLi, all sessions are hijacked immediately.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL
);
```

### The Two-Tier Hash Pattern

To protect active sessions against database read exposure or leaked backups:
1. **Generation**: The server generates a high-entropy cryptographically secure random string (e.g., 256 bits encoded via base32 or hex).
2. **Delivery**: The raw token is sent to the client inside a secure, `HttpOnly`, `SameSite=Lax` cookie. The server **never** writes this raw token to disk.
3. **Storage**: The server computes a fast cryptographic hash (e.g., SHA-256) of the raw token and stores only the `token_hash` as the primary key.
4. **Validation**: When the client presents the cookie, the server hashes the incoming token and queries the database for `token_hash`.

Even if an attacker dumps the entire database, the stored hashes cannot be reversed to forge valid session cookies.

---

## Sliding Window Expiration

Static session expiration creates poor user experiences (abrupt logouts mid-work) or insecure defaults (infinite session lifetimes). Sliding-window validation resolves this:

```
[ Session Created ] ──────────────────> (30 days)
       │
       ▼ (User active at Day 15)
[ Session Extended ] ──────────────────────────────────> (New +30 days)
```

### The Algorithm

1. Each session row stores an `expires_at` timestamp (e.g., `now + 30 days`).
2. When a request arrives, check:
   - If `Date.now() >= session.expiresAt`: Session is expired. Delete it immediately and return unauthorized.
   - If `Date.now() < session.expiresAt`: The session is valid.
3. **Extension Threshold**: To avoid write-amplification on every single HTTP GET request, only extend the session when it has elapsed past a threshold (e.g., halfway through its lifetime, or when `expiresAt - Date.now() < 15 days`).
4. When past the threshold, update `expires_at = Date.now() + 30 days` in the database.

This guarantees active users stay logged in indefinitely without disruption, while abandoned devices expire naturally after 30 days of inactivity.

---

## Multi-Device Management and Revocation

Database-backed sessions enable essential user-facing security capabilities:

- **List Active Sessions**: Users can view all active devices with creation date, last active timestamp, and approximate client metadata.
- **Revoke Other Devices**: When a user suspects account compromise, they can terminate all sessions except the current one.
- **Global Invalidation**: Password changes or email updates immediately delete all session rows for that `user_id`, instantly revoking access across all browsers and devices.

---

Now use it: `sedim add auth`
