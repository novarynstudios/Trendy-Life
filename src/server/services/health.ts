import "server-only"

import { access, constants, mkdir, statfs } from "node:fs/promises"
import path from "node:path"
import Redis from "ioredis"
import { prisma } from "@/src/server/db/prisma"
import { environmentReadiness } from "@/src/server/env"

async function checkDatabase() {
  const started = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: "operational" as const, latencyMs: Math.round(performance.now() - started) }
  } catch {
    return { status: "unavailable" as const, latencyMs: Math.round(performance.now() - started) }
  }
}

async function checkRedis() {
  const started = performance.now()
  if (!process.env.REDIS_URL) return { status: "unconfigured" as const, latencyMs: 0 }
  const client = new Redis(process.env.REDIS_URL, { lazyConnect: true, enableOfflineQueue: false, connectTimeout: 1200, maxRetriesPerRequest: 1 })
  client.on("error", () => undefined)
  try {
    await client.connect()
    await client.ping()
    await client.quit()
    return { status: "operational" as const, latencyMs: Math.round(performance.now() - started) }
  } catch {
    client.disconnect()
    return { status: "unavailable" as const, latencyMs: Math.round(performance.now() - started) }
  }
}

async function checkStorage() {
  const storagePath = path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_LOCAL_PATH ?? "./storage")
  try {
    await mkdir(storagePath, { recursive: true })
    await access(storagePath, constants.R_OK | constants.W_OK)
    const stats = await statfs(storagePath)
    return { status: "operational" as const, freeBytes: Number(stats.bavail) * Number(stats.bsize) }
  } catch {
    return { status: "unavailable" as const, freeBytes: 0 }
  }
}

export async function getSystemHealth() {
  const [database, redis, storage, jobs, lastEmail, lastWebhook] = await Promise.all([
    checkDatabase(), checkRedis(), checkStorage(),
    prisma.backgroundJob.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
    prisma.emailLog.findFirst({ orderBy: { queuedAt: "desc" }, select: { status: true, queuedAt: true } }).catch(() => null),
    prisma.paymentWebhookEvent.findFirst({ orderBy: { receivedAt: "desc" }, select: { status: true, receivedAt: true } }).catch(() => null),
  ])
  const environment = environmentReadiness()
  return {
    applicationVersion: process.env.npm_package_version ?? "1.0.0",
    environment: process.env.NODE_ENV ?? "development",
    database, redis, storage, jobs: Object.fromEntries(jobs.map((job) => [job.status, job._count._all])),
    lastEmail, lastWebhook, environmentReady: environment.ready,
    scheduler: { status: process.env.REDIS_URL ? "configured" : "unconfigured" },
    lastBackup: process.env.LAST_BACKUP_AT ?? null,
  }
}
