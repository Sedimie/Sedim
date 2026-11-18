---
title: Password Hashing with Argon2id
description: How modern memory-hard password hashing works, why Argon2id is the industry standard, and parameter tuning tradeoffs.
slug: auth/password-hashing
date: 2026-06-01
tags:
  - auth
  - security
  - cryptography
  - groundwork
---

## Why Passwords Cannot Be Hashed With Fast Algorithms

Cryptographic hash functions such as SHA-256, SHA-3, or BLAKE2 are engineered to be computationally fast and highly parallelizable. While this makes them ideal for message integrity and digital signatures, it makes them dangerous for password storage.

Modern consumer GPUs can calculate tens of billions of SHA-256 hashes per second. If an attacker gains read access to a database containing SHA-256 password hashes, offline dictionary or brute-force attacks can reverse typical user passwords in minutes, even when unique salts are used.

To resist offline hardware acceleration (GPUs, FPGAs, and custom ASICs), password hashing algorithms must be **intentionally slow** and **memory-hard**.

---

## The Evolution: From PBKDF2 and bcrypt to Argon2

1. **PBKDF2**: CPU-hard only. Requires virtually no RAM, making it trivially parallelizable on ASICs and GPUs.
2. **bcrypt**: Introduced modest memory requirements (4 KB state buffer), but modern GPUs easily pack thousands of bcrypt cores per chip.
3. **scrypt**: The first memory-hard function, requiring configurable RAM to compute. However, it is vulnerable to side-channel cache-timing attacks.
4. **Argon2**: Winner of the 2015 Password Hashing Competition (PHC). Specifically designed to defeat custom hardware cracking while resisting timing side-channels.

---

## How Argon2id Works

Argon2 comes in three variants:
- **Argon2d**: Fast memory access depending on secret data. Maximally resistant to GPU/ASIC attacks, but potentially susceptible to cache-timing side-channels if an attacker shares physical hardware.
- **Argon2i**: Data-independent memory addressing. Safe against cache-timing attacks, but requires more passes to reach the same ASIC resistance.
- **Argon2id** (Standard): A hybrid approach. The first half of the first memory pass uses data-independent addressing to protect against side-channel leaks; subsequent passes switch to data-dependent addressing to maximize ASIC resistance.

### Core Parameters

An Argon2id hash string embeds the cost parameters alongside a cryptographically secure random salt:

```
$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$...$aGFzaGRhdGE...
```

- **Memory Cost (`m`)**: Amount of RAM allocated (e.g., 64 MB = `65536` KiB). An ASIC with limited embedded SRAM cannot parallelize attacks without incurring massive external memory bandwidth penalties.
- **Time Cost (`t`)**: Number of iterations over the memory buffer (e.g., `3` passes).
- **Parallelism (`p`)**: Number of independent threads operating in parallel (e.g., `4` lanes).
- **Salt**: 16 bytes of cryptographically random entropy generated via a secure PRNG. Prevents precomputed rainbow table attacks.

---

## Security Tradeoffs: Calibration vs. DoS

Selecting password hashing parameters is a balance between authentication latency and server throughput:

| Parameter Profile | Memory (`m`) | Time (`t`) | Latency (Server) | Security Posture |
| :--- | :--- | :--- | :--- | :--- |
| **Interactive Web (Sedim default)** | 64 MB (`65536`) | 3 passes | ~150–250 ms | High defense, safe for multi-tenant web servers |
| **High Security / Low Concurrency** | 256 MB (`262144`) | 4 passes | ~600–900 ms | Financial / cold-vault auth |
| **Constrained Environments** | 19 MB (`19456`) | 2 passes | ~50–80 ms | MicroVMs / serverless functions with memory limits |

### Rate Limiting and Denial of Service

Because password hashing deliberately consumes server CPU and memory, an attacker could attempt a Denial-of-Service (DoS) attack by flooding the login endpoint with requests.

Mitigation requires:
1. **Sliding-window rate limiting**: Throttling attempts by IP and targeted user identifier.
2. **Account lockout**: Enforcing progressive delays or temporary lockouts after consecutive failed attempts.
3. **Offloading**: Running password verification in a worker pool or bounded concurrency queue to preserve HTTP event loop availability.

---

## Parameter Upgrades and Re-Hashing

Over time, hardware advances necessitate increasing `m` or `t`. The standard migration path does not require users to reset their passwords:
1. When a user enters their password during login, verify it against the stored hash.
2. If verification succeeds, inspect the hash's encoded version and cost parameters using `needsRehash(storedHash)`.
3. If parameters are outdated, immediately re-hash the plaintext password with the new parameters and save the updated hash to the database before returning the session.

---

Now use it: `sedim add auth`
