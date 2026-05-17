import argon2 from 'argon2'

// argon2id — OWASP recommended parameters (2023)
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
}

/** Hashes a plaintext password. The output includes salt and params — store it directly. */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS)
}

/** Verifies a plaintext password against a stored hash. Constant-time safe. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

/**
 * Returns true if a hash should be upgraded.
 * Call after a successful login and silently rehash if true.
 *
 *   if (valid && needsRehash(user.passwordHash)) {
 *     await db.updateUser(user.id, { passwordHash: await hashPassword(input) })
 *   }
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS)
}
