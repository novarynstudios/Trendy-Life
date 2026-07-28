import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import {
  applyVerifiedSSLCommerzPayment,
  verifySSLCommerzPayment,
} from "@/lib/sslcommerz"
import { rateLimit } from "@/src/server/security/rate-limit"

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const limiter = await rateLimit(`payment-ipn:sslcommerz:${ip}`, 300, 60)
  if (!limiter.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  try {
    const body = await request.formData()
    const validationId = String(body.get("val_id") ?? "")
    if (!/^[A-Za-z0-9._-]{3,200}$/.test(validationId)) {
      return NextResponse.json({ error: "Missing validation ID" }, { status: 400 })
    }
    const verified = await verifySSLCommerzPayment(validationId)
    const result = applyVerifiedSSLCommerzPayment(verified)
    revalidatePath("/admin")
    revalidatePath("/admin/orders")
    revalidatePath("/admin/payments")
    return NextResponse.json({ received: true, order: result.orderNumber })
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 })
  }
}
