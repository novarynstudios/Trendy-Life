import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { writeAuditLog } from "@/src/server/audit/service"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"
import type { PermissionKey } from "@/src/server/permissions"
import { rateLimit } from "@/src/server/security/rate-limit"
import { requestMetadata } from "@/src/server/security/request"

const exportPermissions: Record<string, PermissionKey> = {
  orders: "orders.export", customers: "customers.export", products: "products.export", inventory: "inventory.export",
  payments: "reports.export", tickets: "reports.export", coupons: "reports.export", audit: "audit.view", "report-summary": "reports.export",
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "No records\n"
  const columns = Object.keys(rows[0])
  return [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")
}

export async function GET(_request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params
  const permission = exportPermissions[resource]
  if (!permission) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Export not found" } }, { status: 404 })
  const staff = await requireStaff(permission)
  const metadata = await requestMetadata()
  const limiter = await rateLimit(`admin:export:${staff.id}:${metadata.ipAddress ?? "unknown"}`, 10, 60 * 60)
  if (!limiter.allowed) return NextResponse.json({ error: { code: "RATE_LIMITED", message: `Retry in ${limiter.retryAfter} seconds.` } }, { status: 429 })
  let rows: Record<string, unknown>[] = []
  if (resource === "orders") rows = (await prisma.order.findMany({ take: 10_000, orderBy: { createdAt: "desc" }, include: { user: { include: { profile: true } } } })).map((order) => ({ orderNumber: order.orderNumber, customer: order.user?.profile ? `${order.user.profile.firstName} ${order.user.profile.lastName}` : order.user?.email, email: order.user?.email, status: order.status, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus, subtotal: order.subtotal, discount: order.discountTotal, tax: order.taxTotal, shipping: order.shippingTotal, total: order.total, paid: order.paidTotal, refunded: order.refundedTotal, channel: order.salesChannel, createdAt: order.createdAt }))
  if (resource === "customers") rows = (await prisma.user.findMany({ take: 10_000, orderBy: { createdAt: "desc" }, include: { profile: true, _count: { select: { orders: true } } } })).map((user) => ({ customerNumber: user.profile?.customerNumber, name: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : "", email: user.email, phone: user.profile?.phone, company: user.profile?.company, group: user.profile?.customerGroup, status: user.status, orders: user._count.orders, marketingConsent: user.profile?.marketingConsent, createdAt: user.createdAt }))
  if (resource === "products") rows = (await prisma.product.findMany({ take: 10_000, orderBy: { createdAt: "desc" }, include: { category: true, brand: true } })).map((product) => ({ name: product.name, slug: product.slug, sku: product.sku, barcode: product.barcode, type: product.type, regularPrice: product.regularPrice, salePrice: product.salePrice, costPrice: product.costPrice, category: product.category?.name, brand: product.brand?.name, status: product.status, visibility: product.visibility, createdAt: product.createdAt }))
  if (resource === "inventory") rows = (await prisma.inventoryItem.findMany({ take: 10_000, include: { product: true, variant: true, warehouse: true } })).map((item) => ({ product: item.product.name, variant: item.variant?.name, sku: item.variant?.sku ?? item.product.sku, warehouse: item.warehouse.name, onHand: item.onHand, reserved: item.reserved, available: item.onHand - item.reserved - item.damaged, incoming: item.incoming, damaged: item.damaged, returned: item.returned, updatedAt: item.updatedAt }))
  if (resource === "payments") rows = (await prisma.paymentTransaction.findMany({ take: 10_000, orderBy: { createdAt: "desc" }, include: { payment: { include: { order: true } } } })).map((transaction) => ({ transactionId: transaction.transactionId, order: transaction.payment.order.orderNumber, gateway: transaction.payment.gateway, method: transaction.payment.method, type: transaction.type, amount: transaction.amount, fee: transaction.fee, currency: transaction.currency, status: transaction.status, createdAt: transaction.createdAt }))
  if (resource === "tickets") rows = (await prisma.supportTicket.findMany({ take: 10_000, orderBy: { createdAt: "desc" }, include: { user: true, department: true, assignedStaff: true } })).map((ticket) => ({ ticketNumber: ticket.ticketNumber, customerEmail: ticket.user?.email, department: ticket.department.name, subject: ticket.subject, priority: ticket.priority, status: ticket.status, assignedStaff: ticket.assignedStaff?.name, createdAt: ticket.createdAt, lastResponseAt: ticket.lastResponseAt }))
  if (resource === "coupons") rows = (await prisma.coupon.findMany({ take: 10_000, orderBy: { createdAt: "desc" }, include: { usages: { include: { order: true } } } })).map((coupon) => ({ code: coupon.code, type: coupon.type, value: coupon.amount, active: coupon.active, uses: coupon.usages.length, discountTotal: coupon.usages.reduce((sum, usage) => sum.plus(usage.discountAmount), new Prisma.Decimal(0)), influencedRevenue: coupon.usages.reduce((sum, usage) => sum.plus(usage.order.total), new Prisma.Decimal(0)), startsAt: coupon.startsAt, endsAt: coupon.endsAt }))
  if (resource === "audit") rows = (await prisma.auditLog.findMany({ take: 10_000, orderBy: { createdAt: "desc" }, include: { staff: true } })).map((entry) => ({ timestamp: entry.createdAt, staff: entry.staff?.email, action: entry.action, resourceType: entry.resourceType, resourceId: entry.resourceId, outcome: entry.outcome, ipAddress: entry.ipAddress, requestId: entry.requestId, failureReason: entry.failureReason }))
  if (resource === "report-summary") rows = (await prisma.order.groupBy({ by: ["status"], _count: { _all: true }, _sum: { total: true, paidTotal: true, refundedTotal: true } })).map((entry) => ({ status: entry.status, orders: entry._count._all, total: entry._sum.total, paid: entry._sum.paidTotal, refunded: entry._sum.refundedTotal }))
  await writeAuditLog({ staffId: staff.id, action: "data.export", resourceType: resource, newValues: { rowCount: rows.length } })
  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trendy-life-${resource}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
