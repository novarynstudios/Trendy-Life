import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { applyVerifiedPayment, verifyUddoktaPayment } from "@/lib/uddoktapay"
import { rateLimit } from "@/src/server/security/rate-limit"

export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get("invoice_id")
  if (!invoiceId || !/^[A-Za-z0-9._-]{3,200}$/.test(invoiceId)) return NextResponse.redirect(new URL("/checkout?error=payment-reference", request.url))
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const limiter = await rateLimit(`payment-callback:uddoktapay:${ip}`, 60, 60)
  if (!limiter.allowed) return NextResponse.redirect(new URL("/checkout?error=rate-limit", request.url))
  try {
    const payment = await verifyUddoktaPayment(invoiceId)
    const result = applyVerifiedPayment(payment)
    revalidatePath("/admin")
    revalidatePath("/admin/orders")
    revalidatePath("/admin/payments")
    revalidatePath("/account")
    return NextResponse.redirect(new URL(`/order-success?order=${encodeURIComponent(result.orderNumber)}`, request.url))
  } catch {
    return NextResponse.redirect(new URL("/checkout?error=payment-verification", request.url))
  }
}
