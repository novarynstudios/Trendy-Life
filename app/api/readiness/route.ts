import { NextResponse } from "next/server"
import { getSystemHealth } from "@/src/server/services/health"

export async function GET() {
  const health = await getSystemHealth()
  const ready = health.environmentReady && health.database.status === "operational" && health.redis.status === "operational" && health.storage.status === "operational"
  return NextResponse.json({ ready, checks: { database: health.database.status, redis: health.redis.status, storage: health.storage.status, environment: health.environmentReady } }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } })
}
