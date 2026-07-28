import "dotenv/config"

import { Job, Worker } from "bullmq"
import nodemailer from "nodemailer"
import sanitizeHtml from "sanitize-html"
import { prisma, disconnectDatabase } from "@/src/server/db/prisma"
import { createRedisConnection } from "@/src/server/jobs/connection"
import { getServerEnvironment } from "@/src/server/env"
import { logger } from "@/src/server/logging/logger"
import { decryptSecret } from "@/src/server/security/crypto"
import { applyVerifiedSSLCommerzPayment, verifySSLCommerzPayment } from "@/lib/sslcommerz"
import { applyVerifiedPayment, verifyUddoktaPayment } from "@/lib/uddoktapay"

type QueuePayload = { databaseJobId: string }

async function deliverEmail(payload: Record<string, unknown>) {
  const environment = getServerEnvironment()
  if (!environment.SMTP_HOST) throw new Error("SMTP transport is not configured.")
  const recipient = String(payload.recipient ?? "")
  if (!recipient.includes("@")) throw new Error("Email job has no valid recipient.")
  const transporter = nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_PORT === 465,
    auth: environment.SMTP_USERNAME
      ? { user: environment.SMTP_USERNAME, pass: environment.SMTP_PASSWORD }
      : undefined,
  })
  const subject = String(payload.subject ?? "Trendy Life notification").slice(0, 200)
  const sourceBody = payload.encryptedBody
    ? decryptSecret(String(payload.encryptedBody))
    : String(payload.body ?? "Your requested Trendy Life update is ready.")
  const body = sanitizeHtml(sourceBody, {
    allowedTags: ["p", "br", "strong", "em", "a", "ul", "ol", "li"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["https"],
  })
  const result = await transporter.sendMail({
    from: { name: environment.SMTP_FROM_NAME, address: environment.SMTP_FROM_EMAIL },
    to: recipient,
    subject,
    html: body,
    text: body.replace(/<[^>]+>/g, " "),
  })
  return { providerId: result.messageId }
}

async function processWebhook(payload: Record<string, unknown>) {
  const eventId = String(payload.webhookEventId ?? "")
  const gateway = String(payload.gateway ?? "")
  if (!eventId || (gateway !== "sslcommerz" && gateway !== "uddoktapay")) throw new Error("Invalid webhook job payload")
  const event = await prisma.paymentWebhookEvent.findUnique({ where: { id: eventId } })
  if (!event) throw new Error("Webhook event was not found")
  if (event.status === "PROCESSED") return { skipped: true }
  await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "PROCESSING", attempts: { increment: 1 } } })
  const body = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : {}
  try {
    if (gateway === "uddoktapay") {
      const invoiceId = String(body.invoice_id ?? body.invoiceId ?? "")
      if (!invoiceId) throw new Error("UddoktaPay webhook has no invoice ID")
      applyVerifiedPayment(await verifyUddoktaPayment(invoiceId))
    } else {
      const validationId = String(body.val_id ?? body.validation_id ?? "")
      if (!validationId) throw new Error("SSLCommerz webhook has no validation ID")
      applyVerifiedSSLCommerzPayment(await verifySSLCommerzPayment(validationId))
    }
    await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", processedAt: new Date(), lastError: null } })
    return { processed: true, eventId }
  } catch (error) {
    await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 1_000) : "Webhook processing failed" } })
    throw error
  }
}

async function processDatabaseJob(job: Job<QueuePayload>) {
  const record = await prisma.backgroundJob.findUnique({ where: { id: job.data.databaseJobId } })
  if (!record || record.status === "COMPLETED") return { skipped: true }
  await prisma.backgroundJob.update({
    where: { id: record.id },
    data: { status: "ACTIVE", startedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  })
  try {
    const payload = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? record.payload as Record<string, unknown>
      : {}
    const result = record.queue === "email"
      ? await deliverEmail(payload)
      : record.queue === "webhook"
        ? await processWebhook(payload)
        : record.queue === "maintenance" || record.queue === "inventory"
          ? { processed: true, processor: record.queue, completedAt: new Date().toISOString() }
          : (() => { throw new Error(`No worker processor registered for queue: ${record.queue}`) })()
    await prisma.backgroundJob.update({
      where: { id: record.id },
      data: { status: "COMPLETED", result, completedAt: new Date() },
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "Background job failed"
    const nextStatus = record.attempts + 1 >= record.maxAttempts ? "FAILED" : "DELAYED"
    await prisma.backgroundJob.update({
      where: { id: record.id },
      data: { status: nextStatus, lastError: message, failedAt: nextStatus === "FAILED" ? new Date() : null },
    })
    throw error
  }
}

const connection = createRedisConnection()
const worker = new Worker<QueuePayload>("trendy-life", processDatabaseJob, {
  connection,
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  lockDuration: 60_000,
})

worker.on("completed", (job) => logger.info({ jobId: job.id }, "background job completed"))
worker.on("failed", (job, error) => logger.error({ jobId: job?.id, error: error.message }, "background job failed"))
worker.on("error", (error) => logger.error({ error: error.message }, "worker error"))

async function shutdown(signal: string) {
  logger.info({ signal }, "worker shutting down")
  await worker.close()
  await connection.quit()
  await disconnectDatabase()
  process.exit(0)
}

process.once("SIGTERM", () => void shutdown("SIGTERM"))
process.once("SIGINT", () => void shutdown("SIGINT"))
logger.info({ concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5) }, "Trendy Life worker started")
