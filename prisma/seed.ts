import "dotenv/config"

import argon2 from "argon2"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const databaseUrl = process.env.DATABASE_URL
const adminName = process.env.ADMIN_NAME?.trim()
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD

if (!databaseUrl) throw new Error("DATABASE_URL is required to bootstrap the database.")
if (process.env.NODE_ENV === "production") throw new Error("The development bootstrap cannot run in production.")
if (!adminName || !adminEmail || !adminPassword) {
  throw new Error("ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required. No demo account is created automatically.")
}
if (adminPassword.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.")

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })

const permissions = [
  "customers.view", "customers.create", "customers.edit", "customers.delete", "customers.impersonate", "customers.export",
  "orders.view", "orders.create", "orders.edit", "orders.cancel", "orders.refund", "orders.export",
  "payments.view", "payments.capture", "payments.refund", "payments.reconcile",
  "products.view", "products.manage", "products.import", "products.export",
  "inventory.view", "inventory.adjust", "inventory.transfer", "inventory.export",
  "marketing.view", "marketing.manage", "support.view", "support.reply", "support.manage",
  "content.view", "content.manage", "reports.view", "reports.export", "staff.view", "staff.manage",
  "settings.view", "settings.manage", "audit.view", "jobs.manage", "system.health", "api.manage",
] as const

const roleDefinitions: Record<string, readonly string[]> = {
  "Super Administrator": permissions,
  Administrator: permissions.filter((key) => key !== "customers.delete"),
  "Store Manager": permissions.filter((key) => !key.startsWith("staff.") && !key.startsWith("api.")),
  "Order Manager": ["orders.view", "orders.create", "orders.edit", "orders.cancel", "customers.view", "payments.view", "support.view"],
  "Product Manager": ["products.view", "products.manage", "products.import", "products.export", "inventory.view"],
  "Inventory Manager": ["products.view", "inventory.view", "inventory.adjust", "inventory.transfer", "inventory.export"],
  "Support Agent": ["customers.view", "orders.view", "support.view", "support.reply"],
  "Finance Manager": ["orders.view", "orders.refund", "payments.view", "payments.capture", "payments.refund", "payments.reconcile", "reports.view", "reports.export"],
  "Marketing Manager": ["products.view", "marketing.view", "marketing.manage", "reports.view"],
  "Content Editor": ["products.view", "content.view", "content.manage"],
  Analyst: ["customers.view", "orders.view", "payments.view", "products.view", "inventory.view", "reports.view", "reports.export"],
  "Read-only Auditor": ["customers.view", "orders.view", "payments.view", "products.view", "inventory.view", "reports.view", "audit.view", "system.health"],
}

async function bootstrapSecurity() {
  const permissionRecords = new Map<string, string>()
  for (const key of permissions) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { group: key.split(".")[0], description: `Allows ${key.replace(".", " ")}` },
      create: { key, group: key.split(".")[0], description: `Allows ${key.replace(".", " ")}` },
    })
    permissionRecords.set(key, permission.id)
  }

  const roleRecords = new Map<string, string>()
  for (const [name, keys] of Object.entries(roleDefinitions)) {
    const role = await prisma.staffRole.upsert({
      where: { name },
      update: { description: `${name} role for Trendy Life administration`, isSystem: true },
      create: { name, description: `${name} role for Trendy Life administration`, isSystem: true },
    })
    roleRecords.set(name, role.id)
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    await prisma.rolePermission.createMany({
      data: keys.map((key) => ({ roleId: role.id, permissionId: permissionRecords.get(key)! })),
      skipDuplicates: true,
    })
  }

  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  })
  await prisma.staff.upsert({
    where: { email: adminEmail },
    update: { name: adminName, passwordHash, roleId: roleRecords.get("Super Administrator")!, status: "ACTIVE", forcePasswordReset: true },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      roleId: roleRecords.get("Super Administrator")!,
      status: "ACTIVE",
      forcePasswordReset: true,
      requireTwoFactor: true,
    },
  })
}

bootstrapSecurity()
  .then(() => console.log("Database bootstrap complete. No demo customers, products, orders, payments, or content were created."))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Database bootstrap failed")
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
