import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/src/server/security/rate-limit"

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const limiter = await rateLimit(`payment-fail:sslcommerz:${ip}`, 60, 60)
  if (!limiter.allowed) return NextResponse.redirect(new URL("/payment-cancelled", request.url), 303)
  const body = await request.formData()
  const transactionId = String(body.get("tran_id") ?? "")
  const destination = /^[A-Za-z0-9._-]{3,100}$/.test(transactionId)
    ? `/payment-cancelled?order=${encodeURIComponent(transactionId)}`
    : "/payment-cancelled"
  return NextResponse.redirect(new URL(destination, request.url), 303)
}
