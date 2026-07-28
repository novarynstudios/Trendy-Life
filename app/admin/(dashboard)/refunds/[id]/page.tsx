import { notFound, redirect } from "next/navigation"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("payments.view")
  const { id } = await params
  const refund = await prisma.refund.findUnique({ where: { id }, select: { orderId: true } })
  if (!refund) notFound()
  redirect(`/admin/orders/${refund.orderId}?tab=payment`)
}
