import "server-only"

import Redis from "ioredis"
import { logger } from "@/src/server/logging/logger"

type Bucket = { count: number; resetAt: number }
const fallbackBuckets = new Map<string, Bucket>()
let redisClient: Redis | null | undefined
let redisFailureLogged = false

function getRedis() {
  if (redisClient !== undefined) return redisClient
  const url = process.env.REDIS_URL
  if (!url) {
    redisClient = null
    return null
  }
  redisClient = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
  })
  redisClient.on("error", (error) => {
    if (!redisFailureLogged) {
      redisFailureLogged = true
      logger.warn({ error: error.message || "connection failed" }, "Redis rate-limit unavailable; using in-memory fallback")
    }
  })
  return redisClient
}

export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const redis = getRedis()
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect()
      const value = await redis.incr(key)
      if (value === 1) await redis.expire(key, windowSeconds)
      const ttl = await redis.ttl(key)
      return { allowed: value <= limit, remaining: Math.max(0, limit - value), retryAfter: Math.max(ttl, 1) }
    } catch {
      // The in-memory limiter keeps development and degraded deployments safe.
      redis.disconnect()
      redisClient = null
    }
  }

  const now = Date.now()
  const current = fallbackBuckets.get(key)
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowSeconds * 1000 } : current
  bucket.count += 1
  fallbackBuckets.set(key, bucket)
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

export async function closeRateLimitRedis() {
  if (redisClient) await redisClient.quit()
}
