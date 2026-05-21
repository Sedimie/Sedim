// src/core/rate-limit-store.ts
// ── Rate limiter store abstraction ─────────────────────────────────────
// Allows swapping between in-memory (default) and Redis-backed stores.
// To use Redis: pass a RedisStore instance to AuthConfig.
//
// Usage in AuthConfig:
//   rateLimiter: { store: new InMemoryRateLimitStore() }              // default
//   rateLimiter: { store: new RedisRateLimitStore(redisClient) }      // production
//
// The store interface is intentionally minimal — swap implementations without
// touching any auth logic.

export interface RateLimitEntry {
  count: number
  oldest: number
  blockedUntil: number | null
}

export interface RateLimitStore {
  get(key: string): RateLimitEntry | undefined
  set(key: string, entry: RateLimitEntry): void
  delete(key: string): void
}

/** In-memory store using a Map. Single-process only — use Redis in multi-instance prod. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private map = new Map<string, RateLimitEntry>()

  get(key: string) { return this.map.get(key) }
  set(key: string, entry: RateLimitEntry) { this.map.set(key, entry) }
  delete(key: string) { this.map.delete(key) }
}

// Redis store — use ioredis or @redis/client in your project.
// Example with ioredis:
//
//   import Redis from 'ioredis'
//   const redis = new Redis(process.env.REDIS_URL!)
//
//   export class RedisRateLimitStore implements RateLimitStore {
//     private prefix: string
//     constructor(private client: Redis, prefix = 'rl:') { this.prefix = prefix }
//     private k(key: string) { return this.prefix + key }
//     async get(key: string) {
//       const raw = await this.client.hgetall(this.k(key))
//       if (!raw.count) return undefined
//       return { count: parseInt(raw.count), oldest: parseInt(raw.oldest), blockedUntil: raw.blockedUntil ? parseInt(raw.blockedUntil) : null }
//     }
//     async set(key: string, entry: RateLimitEntry) {
//       await this.client.hset(this.k(key), 'count', String(entry.count), 'oldest', String(entry.oldest), ...(entry.blockedUntil ? ['blockedUntil', String(entry.blockedUntil)] : []))
//       await this.client.expire(this.k(key), 3600)
//     }
//     async delete(key: string) { await this.client.del(this.k(key)) }
//   }