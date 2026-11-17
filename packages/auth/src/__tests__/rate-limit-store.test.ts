import { describe, expect, it, vi } from 'vitest'
import {
  InMemoryRateLimitStore,
  type RedisClientLike,
  RedisRateLimitStore,
} from '../core/rate-limit-store'
import { createRateLimiter } from '../core/rate-limit'

describe('RateLimitStore', () => {
  describe('InMemoryRateLimitStore', () => {
    it('sets, gets, and deletes entries in memory', () => {
      const store = new InMemoryRateLimitStore()
      expect(store.get('user-1')).toBeUndefined()

      store.set('user-1', { count: 1, oldest: 1000, blockedUntil: null })
      expect(store.get('user-1')).toEqual({ count: 1, oldest: 1000, blockedUntil: null })

      store.delete('user-1')
      expect(store.get('user-1')).toBeUndefined()
    })

    it('clears all entries', () => {
      const store = new InMemoryRateLimitStore()
      store.set('a', { count: 1, oldest: 100, blockedUntil: null })
      store.set('b', { count: 2, oldest: 200, blockedUntil: null })
      store.clear()
      expect(store.get('a')).toBeUndefined()
      expect(store.get('b')).toBeUndefined()
    })
  })

  describe('RedisRateLimitStore (hash commands)', () => {
    it('interacts with Redis using hgetall, hset, expire, and del', async () => {
      const redisData = new Map<string, Record<string, string>>()

      const mockRedis: RedisClientLike = {
        hgetall: vi.fn(async (key: string) => redisData.get(key) ?? null),
        hset: vi.fn(async (key: string, ...args: (string | number)[]) => {
          const obj = redisData.get(key) ?? {}
          for (let i = 0; i < args.length; i += 2) {
            obj[String(args[i])] = String(args[i + 1])
          }
          redisData.set(key, obj)
        }),
        expire: vi.fn(async () => 1),
        del: vi.fn(async (key: string) => {
          redisData.delete(key)
        }),
      }

      const store = new RedisRateLimitStore(mockRedis, { prefix: 'test:rl:' })

      // Initial state
      const initial = await store.get('ip:1.2.3.4')
      expect(initial).toBeUndefined()
      expect(mockRedis.hgetall).toHaveBeenCalledWith('test:rl:ip:1.2.3.4')

      // Set entry
      await store.set('ip:1.2.3.4', { count: 3, oldest: 5000, blockedUntil: 15000 }, 300)
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'test:rl:ip:1.2.3.4',
        'count',
        3,
        'oldest',
        5000,
        'blockedUntil',
        15000,
      )
      expect(mockRedis.expire).toHaveBeenCalledWith('test:rl:ip:1.2.3.4', 300)

      // Get entry
      const retrieved = await store.get('ip:1.2.3.4')
      expect(retrieved).toEqual({
        count: 3,
        oldest: 5000,
        blockedUntil: 15000,
      })

      // Delete entry
      await store.delete('ip:1.2.3.4')
      expect(mockRedis.del).toHaveBeenCalledWith('test:rl:ip:1.2.3.4')
      const afterDel = await store.get('ip:1.2.3.4')
      expect(afterDel).toBeUndefined()
    })

    it('handles redis errors gracefully without throwing', async () => {
      const failingRedis: RedisClientLike = {
        hgetall: vi.fn().mockRejectedValue(new Error('Connection timeout')),
        hset: vi.fn().mockRejectedValue(new Error('Connection timeout')),
        del: vi.fn().mockRejectedValue(new Error('Connection timeout')),
      }

      const store = new RedisRateLimitStore(failingRedis)
      const res = await store.get('broken-key')
      expect(res).toBeUndefined()

      await expect(
        store.set('broken-key', { count: 1, oldest: 100, blockedUntil: null }),
      ).resolves.not.toThrow()

      await expect(store.delete('broken-key')).resolves.not.toThrow()
    })
  })

  describe('RedisRateLimitStore (JSON get/set commands)', () => {
    it('supports string-based Redis clients like Upstash or simple set/get', async () => {
      const redisStorage = new Map<string, string>()

      const mockRedis: RedisClientLike = {
        get: vi.fn(async (key: string) => redisStorage.get(key) ?? null),
        set: vi.fn(async (key: string, value: string) => {
          redisStorage.set(key, value)
        }),
        del: vi.fn(async (key: string) => {
          redisStorage.delete(key)
        }),
      }

      const store = new RedisRateLimitStore(mockRedis)
      await store.set('key-json', { count: 2, oldest: 1000, blockedUntil: null })
      expect(mockRedis.set).toHaveBeenCalled()

      const retrieved = await store.get('key-json')
      expect(retrieved).toEqual({ count: 2, oldest: 1000, blockedUntil: null })

      await store.delete('key-json')
      expect(await store.get('key-json')).toBeUndefined()
    })
  })

  describe('createRateLimiter with RedisRateLimitStore', () => {
    it('operates asynchronously and enforces rate limits across attempts', async () => {
      const memory = new Map<string, Record<string, string>>()
      const mockRedis: RedisClientLike = {
        hgetall: vi.fn(async (key: string) => memory.get(key) ?? null),
        hset: vi.fn(async (key: string, ...args: (string | number)[]) => {
          const obj = memory.get(key) ?? {}
          for (let i = 0; i < args.length; i += 2) {
            obj[String(args[i])] = String(args[i + 1])
          }
          memory.set(key, obj)
        }),
        expire: vi.fn(async () => 1),
        del: vi.fn(async (key: string) => {
          memory.delete(key)
        }),
      }

      const store = new RedisRateLimitStore(mockRedis)
      const limiter = createRateLimiter({
        maxAttempts: 2,
        windowMs: 10000,
        blockMs: 20000,
        store,
      })

      // 1st attempt: allowed
      const check1 = await limiter.check('test-action')
      expect(check1.allowed).toBe(true)
      await limiter.hit('test-action')

      // 2nd attempt: allowed
      const check2 = await limiter.check('test-action')
      expect(check2.allowed).toBe(true)
      await limiter.hit('test-action')

      // 3rd attempt: blocked (maxAttempts reached)
      const check3 = await limiter.check('test-action')
      expect(check3.allowed).toBe(false)
      expect(check3.retryAfterMs).toBeDefined()

      // Clear allows actions again
      await limiter.clear('test-action')
      const check4 = await limiter.check('test-action')
      expect(check4.allowed).toBe(true)
    })
  })
})
