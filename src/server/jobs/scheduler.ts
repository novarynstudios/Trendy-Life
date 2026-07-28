import "dotenv/config"

import { Queue } from "bullmq"
import { prisma, disconnectDatabase } from "@/src/server/db/prisma"
import { createRedisConnection } from "@/src/server/jobs/connection"
import { logger } from "@/src/server/logging/logger"

const connection = createRedisConnection()
const queue = new Queue("trendy-life", { connection })
let stopping = false

async function dispatchWaitingJobs() {
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - 10 * 60_000)
  await prisma.backgroundJob.updateMany({
    where: { status: "ACTIVE", startedAt: { lt: staleCutoff } },
    data: { status: "DELAYED", runAt: now, lastError: "Recovered stale active job after worker interruption." },
  })
  const jobs = await prisma.backgroundJob.findMany({
    where: {
      status: { in: ["WAITING", "DELAYED"] },
      OR: [{ runAt: null }, { runAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  })
  for (const job of jobs) {
    await queue.add(job.queue, { databaseJobId: job.id }, {
      jobId: job.id,
      attempts: Math.max(job.maxAttempts - job.attempts, 1),
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    })
    if (!job.externalId) {
      await prisma.backgroundJob.update({ where: { id: job.id }, data: { externalId: job.id } })
    }
  }
  if (jobs.length) logger.info({ dispatched: jobs.length }, "queued database jobs")
}

async function createScheduledMaintenance() {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1_000)
  const recent = await prisma.backgroundJob.findFirst({
    where: { name: "session-cleanup", createdAt: { gte: hourAgo } },
  })
  if (!recent) {
    await prisma.backgroundJob.createMany({
      data: [
        { queue: "maintenance", name: "session-cleanup", payload: { createdBy: "scheduler" } },
        { queue: "inventory", name: "low-stock-check", payload: { createdBy: "scheduler" } },
      ],
    })
  }
}

async function tick() {
  if (stopping) return
  try {
    await createScheduledMaintenance()
    await dispatchWaitingJobs()
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : "Unknown scheduler error" }, "scheduler tick failed")
  }
}

async function shutdown(signal: string) {
  stopping = true
  logger.info({ signal }, "scheduler shutting down")
  await queue.close()
  await connection.quit()
  await disconnectDatabase()
  process.exit(0)
}

process.once("SIGTERM", () => void shutdown("SIGTERM"))
process.once("SIGINT", () => void shutdown("SIGINT"))
await tick()
setInterval(() => void tick(), Number(process.env.SCHEDULER_INTERVAL_MS ?? 15_000)).unref()
logger.info("Trendy Life scheduler started")
