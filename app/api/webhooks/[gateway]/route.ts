import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/src/server/db/prisma"
import { sha256 } from "@/src/server/security/crypto"
import { rateLimit } from "@/src/server/security/rate-limit"
import { verifyWebhookSignature } from "@/src/server/security/webhook"

const supportedGateways = ["sslcommerz", "uddoktapay"] as const
const eventSchema = z.record(z.string(), z.unknown())

function secretFor(gateway: (typeof supportedGateways)[number]) {
  const key = `${gateway.toUpperCase()}_WEBHOOK_SECRET`
  return process.env[key]
}

export async function POST(request: NextRequest, context: { params: Promise<{ gateway: string }> }) {
  const { gateway: rawGateway } = await context.params
  const parsedGateway = z.enum(supportedGateways).safeParse(rawGateway.toLocaleLowerCase())
  if (!parsedGateway.success) return NextResponse.json({ error: "Unsupported payment gateway." }, { status: 404 })
  const gateway = parsedGateway.data
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const limiter = await rateLimit(`webhook:${gateway}:${ip}`, 300, 60)
  if (!limiter.allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 })

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody) > 1_000_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 })
  const timestamp = Number(request.headers.get("x-webhook-timestamp"))
  const signature = request.headers.get("x-webhook-signature") ?? ""
  const secret = secretFor(gateway)
  if (!secret || !verifyWebhookSignature({ secret, timestamp, rawBody, signature })) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 })
  }

  let unknownPayload: unknown
  try {
    unknownPayload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }
  const payload = eventSchema.safeParse(unknownPayload)
  if (!payload.success) return NextResponse.json({ error: "Webhook payload must be an object." }, { status: 400 })
  const externalEventId = String(
    request.headers.get("x-event-id") ?? payload.data.eventId ?? payload.data.id ?? "",
  ).slice(0, 200)
  if (!externalEventId) return NextResponse.json({ error: "Missing event ID." }, { status: 400 })
  const idempotencyKey = `${gateway}:${externalEventId}`

  try {
    const event = await prisma.paymentWebhookEvent.create({
      data: {
        gateway,
        externalEventId,
        idempotencyKey,
        signatureHash: sha256(signature),
        payload: payload.data as PrismaJsonObject,
        headers: {
          contentType: request.headers.get("content-type"),
          userAgent: request.headers.get("user-agent"),
          timestamp,
        },
      },
    })
    await prisma.backgroundJob.create({
      data: {
        queue: "webhook",
        name: `process-${gateway}-webhook`,
        payload: { webhookEventId: event.id, gateway },
      },
    })
    return NextResponse.json({ accepted: true, eventId: event.id }, { status: 202 })
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ accepted: true, duplicate: true }, { status: 200 })
    }
    return NextResponse.json({ error: "Unable to accept webhook." }, { status: 500 })
  }
}

type PrismaJsonObject = {
  [key: string]: string | number | boolean | null | PrismaJsonObject | PrismaJsonObject[]
}
