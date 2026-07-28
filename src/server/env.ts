import { z } from "zod"

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  REDIS_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  APP_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, "must be exactly 64 hexadecimal characters"),
  APP_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().default("no-reply@trendylife.com.bd"),
  SMTP_FROM_NAME: z.string().default("Trendy Life"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage"),
  MONITORING_DSN: z.string().optional(),
})

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

let cachedEnvironment: ServerEnvironment | undefined

export function getServerEnvironment(): ServerEnvironment {
  if (cachedEnvironment) return cachedEnvironment
  const result = serverEnvironmentSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
    throw new Error(`Invalid server environment: ${issues}`)
  }
  cachedEnvironment = result.data
  return cachedEnvironment
}

export function environmentReadiness() {
  const result = serverEnvironmentSchema.safeParse(process.env)
  return result.success
    ? { ready: true as const, environment: result.data.NODE_ENV }
    : { ready: false as const, errors: result.error.issues.map((issue) => ({ key: issue.path.join("."), message: issue.message })) }
}
