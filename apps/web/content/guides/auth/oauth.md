---
title: OAuth 2.0, PKCE, and OpenID Connect
description: Understanding the OAuth 2.0 authorization code flow, why PKCE is mandatory for all clients, and how OIDC handles identity.
slug: auth/oauth
date: 2026-06-01
tags:
  - auth
  - oauth
  - oidc
  - pkce
  - groundwork
---

## OAuth 2.0 vs. OpenID Connect (OIDC)

A common point of confusion is treating OAuth 2.0 and OpenID Connect (OIDC) as interchangeable. They solve two different problems:

- **OAuth 2.0 is an Authorization Framework**: It allows an application to access resources on a user's behalf (e.g., "Allow app X to read files from Google Drive") without sharing passwords. OAuth 2.0 does not specify a standard format for user identity.
- **OpenID Connect (OIDC) is an Identity Layer**: Built on top of OAuth 2.0, it standardizes user authentication. It introduces the **ID Token** (a signed JWT) containing standard profile claims (`sub`, `email`, `email_verified`, `name`).

When implementing "Sign in with Google, GitHub, or Discord", you are performing an OIDC authentication flow over OAuth 2.0 transport.

---

## The Authorization Code Flow

The most secure pattern for web applications is the Authorization Code Flow:

```
User Browser                  Application Backend              Identity Provider (IdP)
     │                                │                                │
     │─── Click "Login with Google" ─>│                                │
     │<── Redirect to IdP URL ────────│ (Generates state & PKCE)        │
     │                                                                 │
     │─── User consents on IdP UI ────────────────────────────────────>│
     │<── Redirect to callback URL with Auth Code + State ─────────────│
     │                                                                 │
     │─── GET /api/auth/oauth/callback?code=...&state=... ────────────>│
     │                                │─── POST /token (Code + Verifier) >│
     │                                │<── ID Token + Access Token ──────│
     │                                │ (Creates session & user)       │
     │<── Sets Session Cookie ────────│                                │
```

---

## Why PKCE Is Mandatory (RFC 7636)

Originally designed for mobile and single-page apps without client secrets, **Proof Key for Code Exchange (PKCE)** is now recommended by OAuth 2.1 best practices for **all** clients, including server-side backends.

### The Attack Vector Without PKCE

When the authorization code returns in the browser redirect URL (`?code=XYZ`), it can be exposed via:
- Browser history or referrer headers.
- Open redirect vulnerabilities on the callback domain.
- Malicious extensions or proxy logging.

If an attacker intercepts the authorization code, they can exchange it for access and ID tokens.

### How PKCE Prevents Theft

1. **Before Redirect**: The client generates a high-entropy cryptographically random string called the `code_verifier`.
2. It computes the SHA-256 hash of the verifier, known as the `code_challenge`:
   $$\text{code\_challenge} = \text{BASE64URL}(\text{SHA-256}(\text{code\_verifier}))$$
3. The client passes the `code_challenge` in the authorization request to the IdP. The IdP records it.
4. **During Exchange**: When exchanging the authorization code, the client backend submits the original plaintext `code_verifier`.
5. The IdP hashes the submitted verifier and checks if it matches the challenge recorded in step 3.

An attacker who intercepts the authorization code cannot exchange it because they do not have the plaintext `code_verifier` stored in the user's isolated session or cookie.

---

## CSRF Protection: The State Parameter

To prevent **Cross-Site Request Forgery (CSRF)** in OAuth flows:
- The backend generates a random `state` token before redirecting the user to the IdP.
- The `state` is stored in an encrypted or signed, short-lived HTTP-only cookie.
- The IdP echoes back the exact `state` value in the callback query parameters.
- The backend verifies that the received `state` matches the cookie.

If an attacker attempts to trick a user into completing an authorization code exchange using the attacker's authorization code, the `state` check will fail and block the attack.

---

## Validating OIDC ID Tokens

When interacting with an OIDC provider, never trust the raw claims inside an `id_token` without verifying its cryptographic signature:

1. **Discovery**: Fetch the provider's discovery document at `/.well-known/openid-configuration` to retrieve the `jwks_uri`.
2. **Key Set (JWKS)**: Fetch the provider's public JSON Web Key Set.
3. **Signature Verification**: Verify the ID token signature using the key matching the token's `kid` header.
4. **Claim Checks**:
   - `iss`: Must exactly match the provider's discovery URL.
   - `aud`: Must match your application's `client_id`.
   - `exp`: Current time must be strictly before expiration.
   - `nonce`: If provided during authorization, must match the session nonce.

---

Now use it: `sedim add auth`
