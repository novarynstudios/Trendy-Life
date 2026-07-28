import { redirect } from "next/navigation"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function InventoryAdjustPage() {
  await requireStaff("inventory.adjust")
  const first = await prisma.inventoryItem.findFirst({ orderBy: { updatedAt: "desc" }, select: { id: true } })
  if (first) redirect(`/admin/inventory/${first.id}`)
  redirect("/admin/inventory")
}
