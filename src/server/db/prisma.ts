import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const globalDatabase = globalThis as typeof globalThis & { trendyLifePrisma?: PrismaClient }

function createClient() {
  const connectionString = process.env.DATABASE_URL ?? "postgresql://invalid:invalid@127.0.0.1:5432/invalid"
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })
}

export const prisma = globalDatabase.trendyLifePrisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalDatabase.trendyLifePrisma = prisma

export async function disconnectDatabase() {
  await prisma.$disconnect()
}
