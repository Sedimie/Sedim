// src/core/rate-limit-store.ts
// ── Rate limiter store abstraction ─────────────────────────────────────
// Allows swapping between in-memory (default) and Redis-backed stores.
// To use Redis: pass a RedisRateLimitStore instance to AuthConfig.
//
// Usage:
//   const limiter = createRateLimiter({
//     maxAttempts: 5,
//     store: new InMemoryRateLimitStore(), // default
//   })
//
//   const prodLimiter = createRateLimiter({
//     maxAttempts: 5,
//     store: new RedisRateLimitStore(redisClient), // multi-instance production
//   })
//
// The store interface is intentionally minimal — swap implementations without
// touching any auth logic.

export interface RateLimitEntry {
  count: number
  oldest: number
  blockedUntil: number | null
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | undefined> | RateLimitEntry | undefined
  set(key: string, entry: RateLimitEntry, ttlSeconds?: number): Promise<void> | void
  delete(key: string): Promise<void> | void
}

/** In-memory store using a Map. Single-process only — use Redis in multi-instance prod. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private map = new Map<string, RateLimitEntry>()

  get(key: string): RateLimitEntry | undefined {
    return this.map.get(key)
  }

  set(key: string, entry: RateLimitEntry): void {
    this.map.set(key, entry)
  }

  delete(key: string): void {
    this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }
}

/**
 * Minimal duck-typed interface matching ioredis, @redis/client, and @upstash/redis.
 */
export interface RedisClientLike {
  hgetall?(key: string): Promise<Record<string, string> | null | undefined>
  hset?(key: string, ...args: (string | number)[]): Promise<unknown>
  expire?(key: string, seconds: number): Promise<unknown>
  del(key: string): Promise<unknown>
  get?(key: string): Promise<string | null | undefined>
  set?(key: string, value: string, ...args: unknown[]): Promise<unknown>
}

export interface RedisStoreOptions {
  /** Key prefix in Redis. Default: 'sedim:rl:' */
  prefix?: string
  /** Default TTL in seconds if not specified. Default: 3600 (1 hour). */
  defaultTtlSeconds?: number
}

/**
 * Redis-backed store for multi-instance deployments.
 * Works with ioredis, @redis/client, @upstash/redis, or any compatible client.
 */
export class RedisRateLimitStore implements RateLimitStore {
  private prefix: string
  private defaultTtl: number

  constructor(
    private client: RedisClientLike,
    options: RedisStoreOptions = {},
  ) {
    this.prefix = options.prefix ?? 'sedim:rl:'
    this.defaultTtl = options.defaultTtlSeconds ?? 3600
  }

  private k(key: string): string {
    return this.prefix + key
  }

  async get(key: string): Promise<RateLimitEntry | undefined> {
    const fullKey = this.k(key)
    try {
      if (typeof this.client.hgetall === 'function') {
        const raw = await this.client.hgetall(fullKey)
        if (!raw || !raw.count) return undefined
        return {
          count: parseInt(raw.count, 10),
          oldest: parseInt(raw.oldest, 10),
          blockedUntil: raw.blockedUntil ? parseInt(raw.blockedUntil, 10) : null,
        }
      }

      if (typeof this.client.get === 'function') {
        const rawStr = await this.client.get(fullKey)
        if (!rawStr) return undefined
        return JSON.parse(rawStr) as RateLimitEntry
      }

      return undefined
    } catch {
      return undefined
    }
  }

  async set(key: string, entry: RateLimitEntry, ttlSeconds?: number): Promise<void> {
    const fullKey = this.k(key)
    const ttl = ttlSeconds ?? this.defaultTtl

    try {
      if (typeof this.client.hset === 'function') {
        const fields: (string | number)[] = [
          'count',
          entry.count,
          'oldest',
          entry.oldest,
        ]
        if (entry.blockedUntil !== null) {
          fields.push('blockedUntil', entry.blockedUntil)
        }
        await this.client.hset(fullKey, ...fields)
        if (typeof this.client.expire === 'function') {
          await this.client.expire(fullKey, ttl)
        }
        return
      }

      if (typeof this.client.set === 'function') {
        await this.client.set(fullKey, JSON.stringify(entry), 'EX', ttl)
      }
    } catch {
      // Safe fallback on redis transport error
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.k(key)
    try {
      await this.client.del(fullKey)
    } catch {
      // Safe fallback
    }
  }
}
