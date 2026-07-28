import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { timingSafeEqual } from "node:crypto"
import { applyVerifiedPayment, verifyUddoktaPayment } from "@/lib/uddoktapay"
import { rateLimit } from "@/src/server/security/rate-limit"

function safeSecretEqual(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function POST(request: NextRequest) {
  const providedKey = request.headers.get("rt-uddoktapay-api-key")
  const expectedKey = process.env.UDDOKTAPAY_API_KEY
  if (!safeSecretEqual(providedKey, expectedKey)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const limiter = await rateLimit(`webhook:uddoktapay-legacy:${ip}`, 300, 60)
  if (!limiter.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  try {
    const payload = await request.json() as { invoice_id?: string }
    if (!payload.invoice_id || !/^[A-Za-z0-9._-]{3,200}$/.test(payload.invoice_id)) return NextResponse.json({ error: "Missing invoice ID" }, { status: 400 })
    const verified = await verifyUddoktaPayment(payload.invoice_id)
    applyVerifiedPayment(verified)
    revalidatePath("/admin")
    revalidatePath("/admin/orders")
    revalidatePath("/admin/payments")
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 })
  }
}
