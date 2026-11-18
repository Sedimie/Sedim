---
title: RFC 6238 TOTP Two-Factor Authentication
description: How Time-Based One-Time Passwords work under the hood, HMAC truncation, clock drift tolerances, and replay prevention.
slug: auth/totp
date: 2026-06-01
tags:
  - auth
  - totp
  - 2fa
  - security
  - groundwork
---

## What Is TOTP?

**Time-Based One-Time Password (TOTP)**, specified in **RFC 6238**, is the universal standard powering authenticator applications like Google Authenticator, 1Password, and Apple Keychain.

Unlike SMS or email verification codes, TOTP operates entirely offline. The server and the client generate matching 6-digit codes independently, requiring no network connection between the user's phone and the server.

---

## The Mathematical Foundation

TOTP is derived directly from **HOTP** (HMAC-based One-Time Password, **RFC 4226**). While HOTP increments an integer counter with each button press, TOTP replaces the physical counter with Unix time divided into fixed time steps.

### 1. The Time Counter ($T$)

Given the current Unix timestamp in seconds, the counter $T$ is:

$$T = \left\lfloor \frac{\text{current\_unix\_time} - T_0}{T_X} \right\rfloor$$

- $T_0$ is the Unix epoch (0).
- $T_X$ is the time step window, standardized to **30 seconds**.

Every 30 seconds, $T$ increments by 1. Both client and server calculate the identical integer $T$.

### 2. Computing the HMAC

The counter $T$ is packed into an 8-byte big-endian integer buffer. The algorithm calculates the HMAC of this buffer using the shared base32 secret key:

$$\text{HS} = \text{HMAC-SHA1}(\text{Secret}, T)$$

### 3. Dynamic Truncation

The resulting 20-byte HMAC digest ($\text{HS}$) is converted into a 6-digit number through dynamic truncation:
1. Extract the last 4 bits of the 20-byte digest as an offset index (between 0 and 15).
2. Read 4 consecutive bytes starting at the offset index.
3. Mask the most significant bit to avoid signed integer ambiguity.
4. Take the modulo $10^6$ ($1,000,000$) to yield a 6-digit decimal string, zero-padded on the left.

---

## Critical Production Considerations

### 1. Clock Drift and Window Tolerances

Client clocks (smartphones) and server clocks can diverge by several seconds. If a user submits their code right as their phone clock rolls over to the next 30-second window, network transit latency can cause the code to arrive late.

Standard validation allows a **skew of $\pm 1$ step**:
- The server checks $T$ (current window).
- It also checks $T - 1$ (previous 30 seconds) and $T + 1$ (next 30 seconds).

Accepting windows larger than $\pm 1$ significantly widens the window for credential interception.

### 2. Replay Prevention

Because a code remains valid for the duration of its 30-second window (plus the drift allowance), an eavesdropper could capture and resubmit the code before the window expires.

To eliminate replay attacks:
- The database stores a `last_used_counter` column on the user's TOTP credential record.
- When a code verifies successfully against window $T_{\text{valid}}$, ensure $T_{\text{valid}} > \text{last\_used\_counter}$.
- Immediately update `last_used_counter = T_{\text{valid}}`.
- Any subsequent attempt to present a code for the same or an earlier window is rejected, even within the 30-second window.

### 3. Encryption at Rest

The TOTP shared secret is symmetric: anyone who knows the secret can generate valid codes forever.

The shared secret must **never** be stored in plaintext in the database. Production systems encrypt the base32 secret using an authenticated encryption cipher (such as AES-256-GCM) with an application secret key before persisting to the database.

### 4. Backup and Recovery Codes

Because users can lose, damage, or replace their phones, 2FA setup must always provide a set of recovery backup codes:
- 8 to 10 cryptographically random alphanumeric strings.
- Stored as one-way hashes (e.g., SHA-256) in the database.
- Marked as used immediately upon redemption, granting single-use emergency access.

---

Now use it: `sedim add auth`
