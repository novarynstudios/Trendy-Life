import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ status: "ok", service: "trendy-life-admin", timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } })
}
