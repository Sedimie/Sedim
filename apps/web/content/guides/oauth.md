---
title: Understanding OAuth 2.0, PKCE, and OpenID Connect
description: Architectural concept guide explaining delegated authorization, PKCE cryptographic security, and the OIDC identity layer according to RFC 6749 and RFC 7636.
slug: guides/oauth
date: 2026-06-01
tags:
  - security
  - oauth
  - pkce
  - oidc
  - rfc7636
---

# Understanding OAuth 2.0, PKCE, and OpenID Connect

Every web application that offers "Sign in with Google" or "Connect with GitHub" relies on three overlapping security specifications:

1. **OAuth 2.0 (RFC 6749)**: A delegated **authorization** framework that lets a third-party application access user resources without ever seeing their password.
2. **OpenID Connect (OIDC Core 1.0)**: An **authentication** layer built on top of OAuth 2.0 that provides verifiable proof of who the user actually is.
3. **PKCE (RFC 7636)**: Proof Key for Code Exchange, a cryptographic protocol that prevents attackers from intercepting authorization codes.

Understanding how these standards interact is essential for building secure web applications.

---

## Authorization vs Authentication: The Core Distinction

A common pitfall is conflating *authorization* with *authentication*:

- **OAuth 2.0 alone does not know who you are**: It is designed to issue **Access Tokens** that grant permission to act (e.g., "this application can read emails from user account #123"). It does not standardize identity formats or user profiles.
- **OpenID Connect adds Identity (The ID Token)**: OIDC introduces an **ID Token**—a cryptographically signed JSON Web Token (RFC 7519) issued by the identity provider containing verified user claims (`sub`, `email`, `email_verified`, `name`).

| Protocol | Primary Artifact | Intended Recipient | Purpose |
| :--- | :--- | :--- | :--- |
| **OAuth 2.0** | `access_token` | API / Resource Server | Grants scoped permission to access resources. |
| **OpenID Connect** | `id_token` | Your Client Application | Proves identity and provides verified user profile attributes. |

---

## The Authorization Code Flow with PKCE

In modern web applications (single-page applications, mobile apps, and distributed web services), storing a static `client_secret` securely is impossible because the client-side code is publicly inspectable.

If an application cannot keep a secret, an attacker could intercept the temporary `authorization_code` returned by the identity provider and exchange it for tokens.

**PKCE (RFC 7636)** neutralizes this threat dynamically using a temporary, per-request cryptographic secret:

```
┌──────────────┐                               ┌──────────────────────┐
│ User Browser │                               │  Identity Provider   │
│  & Host App  │                               │  (Google / GitHub)   │
└──────┬───────┘                               └──────────┬───────────┘
       │                                                  │
       │ 1. Generate code_verifier (high-entropy random)  │
       │ 2. Compute code_challenge = SHA256(verifier)     │
       │                                                  │
       │ 3. Redirect with code_challenge & state          │
       ├─────────────────────────────────────────────────►│
       │                                                  │ 4. User logs in &
       │                                                  │    authorizes app
       │ 5. Redirect back with authorization_code & state │
       │◄─────────────────────────────────────────────────┤
       │                                                  │
       │ 6. Exchange code + ORIGINAL code_verifier        │
       ├─────────────────────────────────────────────────►│
       │                                                  │ 7. Verify SHA256(verifier)
       │                                                  │    matches original challenge
       │ 8. Return access_token & id_token                │
       │◄─────────────────────────────────────────────────┤
```

### The Three Steps of PKCE

1. **Challenge Creation**:
   The client creates a random cryptographically secure string called the `code_verifier`. It hashes this value using SHA-256 to create the `code_challenge`:
   $$\text{code\_challenge} = \text{BASE64URL}(\text{SHA-256}(\text{code\_verifier}))$$
2. **Initial Redirection**:
   The client sends only the `code_challenge` to the authorization server along with a random `state` parameter to prevent CSRF.
3. **Verification & Exchange**:
   When the authorization code arrives at the client's callback URL, the client sends both the `authorization_code` and the unhashed `code_verifier` directly over a secure channel. The authorization server hashes the verifier; if it matches the original challenge, it issues the tokens.

If an attacker intercepts the authorization code in flight, they cannot use it because they do not possess the underlying `code_verifier`.

---

## Defending Against CSRF with the `state` Parameter

Another primary attack vector against OAuth flows is **Cross-Site Request Forgery (CSRF)**, where an attacker tricks a user into completing an authorization handshake that links the attacker's account to the victim's session.

To prevent this:
1. Before redirecting to the provider, the application generates a random, cryptographically unpredictable `state` token and stores it in a secure, `httpOnly` cookie.
2. The provider echoes this `state` parameter back in the callback query parameters.
3. The server validates that the returned state matches the stored cookie. If they do not match, the entire request is rejected immediately.

---

## Now use it

Instead of assembling PKCE hashing, state validation cookies, and OIDC profile parsing by hand, stamp the production-ready implementation directly into your project:

```bash
sedim add auth
```
