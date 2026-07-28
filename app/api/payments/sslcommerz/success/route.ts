import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import {
  applyVerifiedSSLCommerzPayment,
  verifySSLCommerzPayment,
} from "@/lib/sslcommerz"
import { rateLimit } from "@/src/server/security/rate-limit"

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function POST(request: NextRequest) {
  const limiter = await rateLimit(`payment-callback:sslcommerz:${clientIp(request)}`, 60, 60)
  if (!limiter.allowed) {
    return NextResponse.redirect(new URL("/checkout?error=rate-limit", request.url), 303)
  }
  try {
    const body = await request.formData()
    const validationId = String(body.get("val_id") ?? "")
    if (!/^[A-Za-z0-9._-]{3,200}$/.test(validationId)) throw new Error("Invalid validation ID")
    const verified = await verifySSLCommerzPayment(validationId)
    const result = applyVerifiedSSLCommerzPayment(verified)
    revalidatePath("/admin")
    revalidatePath("/admin/orders")
    revalidatePath("/admin/payments")
    revalidatePath("/account")
    return NextResponse.redirect(
      new URL(`/order-success?order=${encodeURIComponent(result.orderNumber)}`, request.url),
      303,
    )
  } catch {
    return NextResponse.redirect(new URL("/checkout?error=payment-verification", request.url), 303)
  }
}
