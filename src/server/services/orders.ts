import "server-only"

import { Prisma, type FulfillmentStatus, type OrderStatus, type PaymentStatus } from "@prisma/client"
import { prisma } from "@/src/server/db/prisma"
import { parseDateFilter, parsePageQuery, type PageQuery } from "@/src/server/services/listing"

const orderStatuses = new Set<OrderStatus>(["DRAFT", "PENDING_PAYMENT", "PAYMENT_FAILED", "PAID", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED", "ON_HOLD", "FRAUD_REVIEW"])
const paymentStatuses = new Set<PaymentStatus>(["PENDING", "PROCESSING", "SUCCESSFUL", "FAILED", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED", "CHARGEBACK"])
const fulfillmentStatuses = new Set<FulfillmentStatus>(["UNFULFILLED", "PARTIAL", "FULFILLED", "RETURNED"])

export type OrderListQuery = PageQuery & {
  status?: string
  payment?: string
  fulfillment?: string
  channel?: string
  staff?: string
  dateFrom?: string
  dateTo?: string
  amountMin?: string
  amountMax?: string
}

export async function listOrders(query: OrderListQuery) {
  const pagination = parsePageQuery(query, ["orderNumber", "createdAt", "total", "status", "paymentStatus"], "createdAt")
  const where: Prisma.OrderWhereInput = {}
  if (pagination.q) {
    where.OR = [
      { orderNumber: { contains: pagination.q, mode: "insensitive" } },
      { user: { email: { contains: pagination.q, mode: "insensitive" } } },
      { user: { profile: { phone: { contains: pagination.q, mode: "insensitive" } } } },
      { items: { some: { sku: { contains: pagination.q, mode: "insensitive" } } } },
      { payments: { some: { gatewayReference: { contains: pagination.q, mode: "insensitive" } } } },
    ]
  }
  if (orderStatuses.has(query.status as OrderStatus)) where.status = query.status as OrderStatus
  if (paymentStatuses.has(query.payment as PaymentStatus)) where.paymentStatus = query.payment as PaymentStatus
  if (fulfillmentStatuses.has(query.fulfillment as FulfillmentStatus)) where.fulfillmentStatus = query.fulfillment as FulfillmentStatus
  if (query.channel) where.salesChannel = query.channel.slice(0, 50)
  if (query.staff) where.assignedStaffId = query.staff
  const orderDateFrom = parseDateFilter(query.dateFrom)
  const orderDateTo = parseDateFilter(query.dateTo, true)
  if (orderDateFrom || orderDateTo) where.createdAt = { ...(orderDateFrom ? { gte: orderDateFrom } : {}), ...(orderDateTo ? { lte: orderDateTo } : {}) }
  if (query.amountMin || query.amountMax) {
    where.total = {
      ...(query.amountMin && Number.isFinite(Number(query.amountMin)) ? { gte: new Prisma.Decimal(query.amountMin) } : {}),
      ...(query.amountMax && Number.isFinite(Number(query.amountMax)) ? { lte: new Prisma.Decimal(query.amountMax) } : {}),
    }
  }

  const orderBy = {
    [pagination.sort]: pagination.direction,
  } as Prisma.OrderOrderByWithRelationInput

  const [orders, total, staff] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: pagination.skip,
      take: pagination.pageSize,
      orderBy,
      include: {
        user: { include: { profile: true } },
        assignedStaff: { select: { name: true } },
        payments: { take: 1, orderBy: { createdAt: "desc" }, select: { method: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.staff.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])

  return {
    ...pagination,
    total,
    staff,
    rows: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.user?.profile ? `${order.user.profile.firstName} ${order.user.profile.lastName}` : order.user?.email ?? "Guest",
      createdAt: order.createdAt.toISOString(),
      paymentMethod: order.payments[0]?.method ?? "—",
      total: Number(order.total),
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      status: order.status,
      assignedStaff: order.assignedStaff?.name ?? "Unassigned",
      salesChannel: order.salesChannel,
    })),
  }
}

export async function getOrderDetail(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      user: { include: { profile: { include: { addresses: true } }, sessions: { take: 5, orderBy: { lastActiveAt: "desc" } } } },
      assignedStaff: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { slug: true } }, variant: { select: { name: true } } } },
      addresses: true,
      statusHistory: { orderBy: { createdAt: "desc" }, include: { staff: { select: { name: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { staff: { select: { name: true } } } },
      shipments: { orderBy: { createdAt: "desc" }, include: { items: true } },
      payments: { orderBy: { createdAt: "desc" }, include: { transactions: { orderBy: { createdAt: "desc" } } } },
      invoices: { orderBy: { createdAt: "desc" }, include: { items: true } },
      refunds: { orderBy: { createdAt: "desc" }, include: { items: true } },
      returns: { orderBy: { requestedAt: "desc" }, include: { items: true } },
      tickets: { orderBy: { updatedAt: "desc" } },
    },
  })
}
