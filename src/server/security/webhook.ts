import { createHmac, timingSafeEqual } from "node:crypto"

export function createWebhookSignature(secret: string, timestamp: number, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
}

export function verifyWebhookSignature(input: {
  secret: string
  timestamp: number
  rawBody: string
  signature: string
  now?: number
  toleranceSeconds?: number
}) {
  const now = input.now ?? Date.now()
  const tolerance = (input.toleranceSeconds ?? 300) * 1_000
  if (!Number.isSafeInteger(input.timestamp) || Math.abs(now - input.timestamp * 1_000) > tolerance) return false
  if (!/^[a-f0-9]{64}$/i.test(input.signature)) return false
  const expected = Buffer.from(createWebhookSignature(input.secret, input.timestamp, input.rawBody), "hex")
  const supplied = Buffer.from(input.signature, "hex")
  return expected.length === supplied.length && timingSafeEqual(expected, supplied)
}
