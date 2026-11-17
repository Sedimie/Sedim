---
title: Understanding Time-Based One-Time Passwords (TOTP)
description: Architectural concept guide explaining RFC 6238 TOTP algorithms, dynamic truncation, clock drift windows, and secret encryption at rest.
slug: guides/totp
date: 2026-06-01
tags:
  - security
  - totp
  - 2fa
  - mfa
  - rfc6238
---

# Understanding Time-Based One-Time Passwords (TOTP)

Passwords alone are inherently vulnerable to credential stuffing, phishing, and breach leaks. Multi-factor authentication (MFA) introduces a second, possession-based factor to verify identity.

While SMS-based verification is vulnerable to SIM-swapping and network interception, **Time-Based One-Time Passwords (RFC 6238)** provide an offline, cryptographically sound verification mechanism supported by standard authenticator apps (Google Authenticator, Apple Keychain, 1Password).

---

## How TOTP Works: The Core Mathematics

TOTP is built directly upon the foundation of **HMAC-Based One-Time Passwords (HOTP, RFC 4226)**.

In HOTP, the server and client share a secret key $K$ and an incrementing counter $C$. Every time a code is generated, the counter increments:
$$\text{HOTP}(K, C) = \text{Truncate}(\text{HMAC-SHA-1}(K, C))$$

TOTP replaces the manual counter $C$ with a **deterministic time counter $T$** derived from the current Unix timestamp:
$$T = \left\lfloor \frac{\text{CurrentTime} - T_0}{X} \right\rfloor$$

- **$T_0$**: The Unix epoch start time (`0`, corresponding to 1970-01-01T00:00:00Z).
- **$X$**: The time-step interval, standardized at **30 seconds**.

Every 30 seconds, $T$ increments by 1. Because both the user's authenticator app and the server synchronize their clocks via NTP (Network Time Protocol), both parties compute the exact same number at the same moment without ever communicating over the network.

---

## Dynamic Truncation: From Hash to 6 Digits

HMAC-SHA1 produces a 20-byte (160-bit) binary hash. Humans cannot easily type a 20-byte string into a mobile keypad within 30 seconds.

**Dynamic Truncation** extracts a clean 6-digit decimal code from the 20-byte hash:

1. **Extract Offset**: The last nibble (the lowest 4 bits of the 20th byte) is read as an integer offset between `0` and `15`.
2. **Extract 4-Byte Chunk**: Starting at that offset, 4 bytes are sliced from the hash:
   $$\text{P} = \text{Hash}[\text{offset} : \text{offset} + 4]$$
3. **Mask Sign Bit**: The most significant bit is masked to prevent signed arithmetic issues:
   $$\text{BinaryCode} = \text{P} \ \& \ \text{0x7FFFFFFF}$$
4. **Modulo $10^6$**: The binary number is divided modulo $1,000,000$ to produce a 6-digit integer:
   $$\text{OTP} = \text{BinaryCode} \pmod{10^6}$$

```
20-byte HMAC Hash:  [byte 0] ... [byte 15] ... [byte 19]
                                                  ▲
                                         Low 4 bits = Offset (e.g. 8)
                                                  │
Extract bytes 8 to 11: ──► Mask MSB ──► Modulo 1,000,000 ──► Code: "482910"
```

---

## Production Security Considerations

### 1. Clock Drift Tolerance Window
Real-world devices may suffer from slight clock drift (up to a few seconds). To prevent false rejections when a user enters a code just as the 30-second window expires:
- The server checks the current time step ($T$), the immediate previous step ($T - 1$), and the immediate next step ($T + 1$).
- This provides an effective $\pm 30$ second tolerance window while strictly rejecting stale codes outside that boundary.

### 2. Encryption at Rest
The shared secret $K$ is generated during setup as a high-entropy 20-byte random seed and presented as an `otpauth://` QR code.
- **Never store the plaintext secret in your database**: If your database is leaked, an attacker could reconstruct every user's OTP algorithm offline.
- Always encrypt the secret at rest using authenticated symmetric encryption (e.g. **AES-256-GCM**) with an application-level key (`AUTH_SECRET`).

### 3. Emergency Backup Codes
If a user loses or replaces their phone, they lose their TOTP generator.
- Production systems issue 8 to 10 single-use **backup codes** during initial setup.
- Backup codes must be hashed (using cryptographic hashes like Argon2id or SHA-256 with salts) before storage in the database, and invalidated immediately upon first use.

---

## Now use it

Instead of writing custom binary truncation, base32 decoders, and drift validation by hand, stamp the production-ready implementation directly into your project:

```bash
sedim add auth
```
