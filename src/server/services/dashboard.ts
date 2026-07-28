import "server-only"

import { prisma } from "@/src/server/db/prisma"

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export async function getDashboardData(staffId: string) {
  const now = new Date()
  const today = startOfDay(now)
  const yesterday = new Date(today.getTime() - 86_400_000)
  const month = startOfMonth(now)
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1)
  const chartStart = new Date(today.getTime() - 364 * 86_400_000)

  const [
    todayRevenue,
    yesterdayRevenue,
    monthRevenue,
    previousMonthRevenue,
    orderCounts,
    previousOrderCount,
    customerCount,
    previousCustomerCount,
    lowStockCount,
    openTicketCount,
    recentOrders,
    lowStock,
    refunds,
    failedPayments,
    recentCustomers,
    recentTickets,
    activity,
    jobs,
    transactions,
    widgetPreferences,
    topProducts,
  ] = await Promise.all([
    prisma.paymentTransaction.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: today } }, _sum: { amount: true } }),
    prisma.paymentTransaction.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: yesterday, lt: today } }, _sum: { amount: true } }),
    prisma.paymentTransaction.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: month } }, _sum: { amount: true } }),
    prisma.paymentTransaction.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: previousMonth, lt: month } }, _sum: { amount: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.count({ where: { createdAt: { lt: month } } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "ACTIVE", createdAt: { lt: month } } }),
    prisma.inventoryItem.count({ where: { onHand: { lte: 5 } } }),
    prisma.supportTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        user: { include: { profile: true } },
        assignedStaff: { select: { name: true } },
        payments: { take: 1, orderBy: { createdAt: "desc" }, select: { method: true } },
      },
    }),
    prisma.inventoryItem.findMany({
      where: { onHand: { lte: 5 } },
      take: 6,
      orderBy: { onHand: "asc" },
      include: { product: { select: { id: true, name: true, sku: true, lowStockThreshold: true } }, variant: { select: { name: true, sku: true } }, warehouse: { select: { name: true } } },
    }),
    prisma.refund.findMany({ where: { status: { in: ["PENDING", "PROCESSING"] } }, take: 6, orderBy: { createdAt: "desc" }, include: { order: { select: { orderNumber: true } } } }),
    prisma.payment.findMany({ where: { status: "FAILED" }, take: 6, orderBy: { updatedAt: "desc" }, include: { order: { select: { orderNumber: true } } } }),
    prisma.user.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { profile: true } }),
    prisma.supportTicket.findMany({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, take: 6, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], include: { user: { include: { profile: true } }, assignedStaff: { select: { name: true } } } }),
    prisma.auditLog.findMany({ take: 7, orderBy: { createdAt: "desc" }, include: { staff: { select: { name: true } } } }),
    prisma.backgroundJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.paymentTransaction.findMany({
      where: { createdAt: { gte: chartStart }, status: { in: ["SUCCESSFUL", "REFUNDED", "PARTIALLY_REFUNDED"] } },
      select: { createdAt: true, amount: true, fee: true, type: true, payment: { select: { order: { select: { discountTotal: true, taxTotal: true, shippingTotal: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dashboardWidgetPreference.findMany({ where: { staffId }, orderBy: { position: "asc" } }),
    prisma.orderItem.groupBy({ by: ["name", "sku"], where: { order: { status: { notIn: ["DRAFT", "CANCELLED"] } } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { quantity: "desc" } }, take: 6 }),
  ])

  const orderCountByStatus = new Map(orderCounts.map((entry) => [entry.status, entry._count._all]))
  const totalOrders = orderCounts.reduce((total, entry) => total + entry._count._all, 0)
  const dayMap = new Map<string, { date: string; gross: number; net: number; refunds: number; discounts: number; taxes: number; shipping: number }>()
  for (let offset = 364; offset >= 0; offset -= 1) {
    const day = new Date(today.getTime() - offset * 86_400_000)
    const key = day.toISOString().slice(0, 10)
    dayMap.set(key, { date: key, gross: 0, net: 0, refunds: 0, discounts: 0, taxes: 0, shipping: 0 })
  }
  for (const transaction of transactions) {
    const entry = dayMap.get(transaction.createdAt.toISOString().slice(0, 10))
    if (!entry) continue
    const amount = Number(transaction.amount)
    if (transaction.type === "REFUND") entry.refunds += amount
    else {
      entry.gross += amount
      entry.net += amount - Number(transaction.fee)
      entry.discounts += Number(transaction.payment.order.discountTotal)
      entry.taxes += Number(transaction.payment.order.taxTotal)
      entry.shipping += Number(transaction.payment.order.shippingTotal)
    }
  }

  const revenueToday = Number(todayRevenue._sum.amount ?? 0)
  const revenueYesterday = Number(yesterdayRevenue._sum.amount ?? 0)
  const revenueMonth = Number(monthRevenue._sum.amount ?? 0)
  const revenuePreviousMonth = Number(previousMonthRevenue._sum.amount ?? 0)

  return {
    stats: {
      revenueToday: { value: revenueToday, change: percentageChange(revenueToday, revenueYesterday) },
      revenueMonth: { value: revenueMonth, change: percentageChange(revenueMonth, revenuePreviousMonth) },
      totalOrders: { value: totalOrders, change: percentageChange(totalOrders, previousOrderCount) },
      pendingOrders: { value: (orderCountByStatus.get("PENDING_PAYMENT") ?? 0) + (orderCountByStatus.get("PAYMENT_FAILED") ?? 0), change: 0 },
      processingOrders: { value: (orderCountByStatus.get("PROCESSING") ?? 0) + (orderCountByStatus.get("READY_TO_SHIP") ?? 0), change: 0 },
      completedOrders: { value: (orderCountByStatus.get("DELIVERED") ?? 0), change: 0 },
      refundedOrders: { value: (orderCountByStatus.get("REFUNDED") ?? 0) + (orderCountByStatus.get("PARTIALLY_REFUNDED") ?? 0), change: 0 },
      customers: { value: customerCount, change: percentageChange(customerCount, previousCustomerCount) },
      lowStock: { value: lowStockCount, change: 0 },
      tickets: { value: openTicketCount, change: 0 },
    },
    chart: [...dayMap.values()],
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.user?.profile ? `${order.user.profile.firstName} ${order.user.profile.lastName}` : order.user?.email ?? "Guest customer",
      date: order.createdAt.toISOString(),
      paymentMethod: order.salesChannel === "admin" ? "Manual" : order.payments?.[0]?.method ?? "Online",
      amount: Number(order.total),
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      assignedStaff: order.assignedStaff?.name ?? "Unassigned",
    })),
    lowStock: lowStock.map((item) => ({
      id: item.id,
      productId: item.product.id,
      name: item.variant ? `${item.product.name} — ${item.variant.name}` : item.product.name,
      sku: item.variant?.sku ?? item.product.sku ?? "—",
      warehouse: item.warehouse.name,
      onHand: item.onHand,
      available: item.onHand - item.reserved - item.damaged,
    })),
    refunds: refunds.map((refund) => ({ id: refund.id, number: refund.refundNumber, order: refund.order.orderNumber, amount: Number(refund.amount), status: refund.status })),
    failedPayments: failedPayments.map((payment) => ({ id: payment.id, order: payment.order.orderNumber, gateway: payment.gateway, amount: Number(payment.amount), updatedAt: payment.updatedAt.toISOString() })),
    recentCustomers: recentCustomers.map((user) => ({ id: user.id, name: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email, email: user.email, createdAt: user.createdAt.toISOString() })),
    tickets: recentTickets.map((ticket) => ({ id: ticket.id, number: ticket.ticketNumber, subject: ticket.subject, priority: ticket.priority, status: ticket.status, assigned: ticket.assignedStaff?.name ?? "Unassigned" })),
    activity: activity.map((entry) => ({ id: entry.id, staff: entry.staff?.name ?? "System", action: entry.action, resource: entry.resourceType, outcome: entry.outcome, createdAt: entry.createdAt.toISOString() })),
    jobs: Object.fromEntries(jobs.map((job) => [job.status, job._count._all])),
    widgetPreferences,
    topProducts: topProducts.map((product) => ({ name: product.name, sku: product.sku, quantity: product._sum.quantity ?? 0, revenue: Number(product._sum.lineTotal ?? 0) })),
  }
}
