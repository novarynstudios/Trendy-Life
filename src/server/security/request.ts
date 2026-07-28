import "server-only"

import { headers } from "next/headers"
import { getServerEnvironment } from "@/src/server/env"

export async function requestMetadata() {
  const values = await headers()
  return {
    requestId: values.get("x-request-id") ?? crypto.randomUUID(),
    ipAddress: values.get("x-forwarded-for")?.split(",")[0]?.trim() ?? values.get("x-real-ip") ?? null,
    userAgent: values.get("user-agent")?.slice(0, 512) ?? null,
    origin: values.get("origin"),
  }
}

export async function assertTrustedOrigin() {
  const { origin } = await requestMetadata()
  if (!origin && process.env.NODE_ENV !== "production") return
  const expected = new URL(getServerEnvironment().APP_URL).origin
  if (!origin || origin !== expected) throw new Error("Request origin validation failed")
}
