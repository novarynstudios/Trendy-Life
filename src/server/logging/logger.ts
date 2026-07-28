import pino from "pino"

const redactedPaths = [
  "password",
  "*.password",
  "token",
  "*.token",
  "otp",
  "*.otp",
  "authorization",
  "headers.authorization",
  "cookie",
  "headers.cookie",
  "*.secret",
  "*.apiKey",
]

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: redactedPaths, censor: "[REDACTED]" },
  base: { service: "trendy-life-admin", environment: process.env.NODE_ENV ?? "development" },
})

export function safeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: process.env.NODE_ENV === "production" ? undefined : error.stack }
  return { message: "Unknown error" }
}
