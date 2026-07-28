import { NextRequest, NextResponse } from "next/server"
import { getCampaignByCode } from "@/lib/db"
import { rateLimit } from "@/src/server/security/rate-limit"

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const limiter = await rateLimit(`public:coupon:${ip}`, 60, 60)
  if (!limiter.allowed) return NextResponse.json({ valid: false, message: "Too many requests." }, { status: 429 })
  const code = String(request.nextUrl.searchParams.get("code") || "").trim().slice(0, 40)
  const rawSubtotal = Number(request.nextUrl.searchParams.get("subtotal") || 0)
  const subtotal = Number.isFinite(rawSubtotal) ? Math.min(Math.max(0, rawSubtotal), 100_000_000) : 0
  const campaign = getCampaignByCode(code, subtotal)
  if (!campaign) return NextResponse.json({ valid: false, message: "This code is invalid, expired or below its minimum order." })
  const discount = campaign.discountType === "percentage"
    ? Math.round(subtotal * campaign.discountValue / 100)
    : Math.min(subtotal, campaign.discountValue)
  return NextResponse.json({
    valid: true,
    code: campaign.code,
    discount,
    message: `${campaign.title} applied.`,
  })
}
