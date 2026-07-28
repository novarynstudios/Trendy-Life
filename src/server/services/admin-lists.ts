import "server-only"

import { Prisma } from "@prisma/client"
import { prisma } from "@/src/server/db/prisma"
import { parseDateFilter, parsePageQuery, type PageQuery } from "@/src/server/services/listing"

export type CustomerListQuery = PageQuery & { status?: string; group?: string; dateFrom?: string; dateTo?: string }
export async function listCustomers(query: CustomerListQuery) {
  const pagination = parsePageQuery(query, ["email", "createdAt", "lastActiveAt", "status"], "createdAt")
  const where: Prisma.UserWhereInput = {}
  if (pagination.q) where.OR = [
    { email: { contains: pagination.q, mode: "insensitive" } },
    { profile: { customerNumber: { contains: pagination.q, mode: "insensitive" } } },
    { profile: { firstName: { contains: pagination.q, mode: "insensitive" } } },
    { profile: { lastName: { contains: pagination.q, mode: "insensitive" } } },
    { profile: { phone: { contains: pagination.q, mode: "insensitive" } } },
  ]
  if (["PENDING", "ACTIVE", "SUSPENDED", "DISABLED", "ANONYMIZED"].includes(query.status ?? "")) where.status = query.status as Prisma.EnumAccountStatusFilter
  if (query.group) where.profile = { is: { customerGroup: query.group.slice(0, 80) } }
  const customerDateFrom = parseDateFilter(query.dateFrom)
  const customerDateTo = parseDateFilter(query.dateTo, true)
  if (customerDateFrom || customerDateTo) where.createdAt = { ...(customerDateFrom ? { gte: customerDateFrom } : {}), ...(customerDateTo ? { lte: customerDateTo } : {}) }
  const orderBy = { [pagination.sort]: pagination.direction } as Prisma.UserOrderByWithRelationInput
  const [users, total, groups] = await Promise.all([
    prisma.user.findMany({
      where, skip: pagination.skip, take: pagination.pageSize, orderBy,
      include: { profile: true, orders: { where: { status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { total: true, createdAt: true }, orderBy: { createdAt: "desc" } } },
    }),
    prisma.user.count({ where }),
    prisma.customerProfile.findMany({ distinct: ["customerGroup"], select: { customerGroup: true }, orderBy: { customerGroup: "asc" } }),
  ])
  return {
    ...pagination, total, groups: groups.map((group) => group.customerGroup),
    rows: users.map((user) => {
      const spent = user.orders.reduce((sum, order) => sum.plus(order.total), new Prisma.Decimal(0))
      const name = user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email
      return {
        id: user.id, customerNumber: user.profile?.customerNumber ?? "—", name, email: user.email,
        phone: user.profile?.phone ?? "—", location: "Bangladesh", orders: user.orders.length,
        lifetimeValue: Number(spent), status: user.status, registeredAt: user.createdAt.toISOString(),
        lastActiveAt: user.lastActiveAt?.toISOString() ?? "",
      }
    }),
  }
}

export type ProductListQuery = PageQuery & { status?: string; type?: string; category?: string; brand?: string; stock?: string }
export async function listProducts(query: ProductListQuery) {
  const pagination = parsePageQuery(query, ["name", "sku", "regularPrice", "status", "createdAt"], "createdAt")
  const where: Prisma.ProductWhereInput = { deletedAt: null }
  if (pagination.q) where.OR = [
    { name: { contains: pagination.q, mode: "insensitive" } }, { sku: { contains: pagination.q, mode: "insensitive" } },
    { barcode: { contains: pagination.q, mode: "insensitive" } }, { variants: { some: { sku: { contains: pagination.q, mode: "insensitive" } } } },
  ]
  if (["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(query.status ?? "")) where.status = query.status as Prisma.EnumPublicationStatusFilter
  if (["SIMPLE", "VARIABLE", "DIGITAL", "BUNDLE", "PREORDER"].includes(query.type ?? "")) where.type = query.type as Prisma.EnumProductTypeFilter
  if (query.category) where.categoryId = query.category
  if (query.brand) where.brandId = query.brand
  if (query.stock === "low") where.inventoryItems = { some: { onHand: { lte: 5 } } }
  if (query.stock === "out") where.inventoryItems = { some: { onHand: { lte: 0 } } }
  const orderBy = { [pagination.sort]: pagination.direction } as Prisma.ProductOrderByWithRelationInput
  const [products, total, categories, brands] = await Promise.all([
    prisma.product.findMany({ where, skip: pagination.skip, take: pagination.pageSize, orderBy, include: { category: { select: { name: true } }, brand: { select: { name: true } }, inventoryItems: { select: { onHand: true, reserved: true, damaged: true } }, variants: { select: { id: true } } } }),
    prisma.product.count({ where }),
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])
  return {
    ...pagination, total, categories, brands,
    rows: products.map((product) => {
      const onHand = product.inventoryItems.reduce((sum, item) => sum + item.onHand, 0)
      const available = product.inventoryItems.reduce((sum, item) => sum + item.onHand - item.reserved - item.damaged, 0)
      return { id: product.id, name: product.name, sku: product.sku ?? "Variable", type: product.type, status: product.status, inventory: onHand, available, price: Number(product.salePrice ?? product.regularPrice), category: product.category?.name ?? "Uncategorized", brand: product.brand?.name ?? "—", variants: product.variants.length }
    }),
  }
}

export type InventoryListQuery = PageQuery & { warehouse?: string; stock?: string }
export async function listInventory(query: InventoryListQuery) {
  const pagination = parsePageQuery(query, ["onHand", "reserved", "incoming", "updatedAt"], "updatedAt")
  const where: Prisma.InventoryItemWhereInput = {}
  if (pagination.q) where.OR = [{ product: { name: { contains: pagination.q, mode: "insensitive" } } }, { product: { sku: { contains: pagination.q, mode: "insensitive" } } }, { variant: { sku: { contains: pagination.q, mode: "insensitive" } } }]
  if (query.warehouse) where.warehouseId = query.warehouse
  if (query.stock === "low") where.onHand = { lte: 5 }
  if (query.stock === "out") where.onHand = { lte: 0 }
  if (query.stock === "available") where.onHand = { gt: 0 }
  const orderBy = { [pagination.sort]: pagination.direction } as Prisma.InventoryItemOrderByWithRelationInput
  const [items, total, warehouses, valuation] = await Promise.all([
    prisma.inventoryItem.findMany({ where, skip: pagination.skip, take: pagination.pageSize, orderBy, include: { product: { select: { name: true, sku: true, costPrice: true, lowStockThreshold: true } }, variant: { select: { name: true, sku: true, costPrice: true } }, warehouse: { select: { name: true } } } }),
    prisma.inventoryItem.count({ where }),
    prisma.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.inventoryItem.findMany({ where, select: { onHand: true, product: { select: { costPrice: true } }, variant: { select: { costPrice: true } } } }),
  ])
  return {
    ...pagination, total, warehouses,
    valuation: valuation.reduce((sum, item) => sum + item.onHand * Number(item.variant?.costPrice ?? item.product.costPrice ?? 0), 0),
    rows: items.map((item) => ({
      id: item.id, product: item.variant ? `${item.product.name} — ${item.variant.name}` : item.product.name,
      sku: item.variant?.sku ?? item.product.sku ?? "—", warehouse: item.warehouse.name, onHand: item.onHand,
      reserved: item.reserved, available: item.onHand - item.reserved - item.damaged, incoming: item.incoming,
      damaged: item.damaged, returned: item.returned, unitCost: Number(item.variant?.costPrice ?? item.product.costPrice ?? 0),
      value: item.onHand * Number(item.variant?.costPrice ?? item.product.costPrice ?? 0), updatedAt: item.updatedAt.toISOString(),
    })),
  }
}

export type PaymentListQuery = PageQuery & { status?: string; gateway?: string; type?: string; dateFrom?: string; dateTo?: string }
export async function listPayments(query: PaymentListQuery) {
  const pagination = parsePageQuery(query, ["transactionId", "amount", "fee", "status", "createdAt"], "createdAt")
  const where: Prisma.PaymentTransactionWhereInput = {}
  if (pagination.q) where.OR = [{ transactionId: { contains: pagination.q, mode: "insensitive" } }, { payment: { order: { orderNumber: { contains: pagination.q, mode: "insensitive" } } } }, { payment: { order: { user: { email: { contains: pagination.q, mode: "insensitive" } } } } }]
  if (["PENDING","PROCESSING","SUCCESSFUL","FAILED","CANCELLED","PARTIALLY_REFUNDED","REFUNDED","DISPUTED","CHARGEBACK"].includes(query.status ?? "")) where.status = query.status as Prisma.EnumPaymentStatusFilter
  if (query.gateway) where.payment = { gateway: query.gateway.slice(0, 80) }
  if (["AUTHORIZATION","CAPTURE","SALE","REFUND","VOID","CHARGEBACK","OFFLINE"].includes(query.type ?? "")) where.type = query.type as Prisma.EnumTransactionTypeFilter
  const paymentDateFrom = parseDateFilter(query.dateFrom)
  const paymentDateTo = parseDateFilter(query.dateTo, true)
  if (paymentDateFrom || paymentDateTo) where.createdAt = { ...(paymentDateFrom ? { gte: paymentDateFrom } : {}), ...(paymentDateTo ? { lte: paymentDateTo } : {}) }
  const orderBy = { [pagination.sort]: pagination.direction } as Prisma.PaymentTransactionOrderByWithRelationInput
  const [transactions, total, gateways] = await Promise.all([
    prisma.paymentTransaction.findMany({ where, skip: pagination.skip, take: pagination.pageSize, orderBy, include: { payment: { include: { order: { include: { user: { include: { profile: true } } } } } } } }),
    prisma.paymentTransaction.count({ where }),
    prisma.payment.findMany({ distinct: ["gateway"], select: { gateway: true }, orderBy: { gateway: "asc" } }),
  ])
  return {
    ...pagination, total, gateways: gateways.map((gateway) => gateway.gateway),
    rows: transactions.map((transaction) => {
      const customer = transaction.payment.order.user
      return { id: transaction.id, transactionId: transaction.transactionId, order: transaction.payment.order.orderNumber, customer: customer?.profile ? `${customer.profile.firstName} ${customer.profile.lastName}` : customer?.email ?? "Guest", gateway: transaction.payment.gateway, type: transaction.type, amount: Number(transaction.amount), fee: Number(transaction.fee), currency: transaction.currency, status: transaction.status, createdAt: transaction.createdAt.toISOString() }
    }),
  }
}

export type TicketListQuery = PageQuery & { status?: string; priority?: string; department?: string; staff?: string }
export async function listTickets(query: TicketListQuery) {
  const pagination = parsePageQuery(query, ["ticketNumber", "priority", "status", "updatedAt", "createdAt"], "updatedAt")
  const where: Prisma.SupportTicketWhereInput = {}
  if (pagination.q) where.OR = [{ ticketNumber: { contains: pagination.q, mode: "insensitive" } }, { subject: { contains: pagination.q, mode: "insensitive" } }, { user: { email: { contains: pagination.q, mode: "insensitive" } } }]
  if (["OPEN","CUSTOMER_REPLIED","STAFF_REPLIED","IN_PROGRESS","WAITING_FOR_CUSTOMER","RESOLVED","CLOSED"].includes(query.status ?? "")) where.status = query.status as Prisma.EnumTicketStatusFilter
  if (["LOW","MEDIUM","HIGH","URGENT"].includes(query.priority ?? "")) where.priority = query.priority as Prisma.EnumTicketPriorityFilter
  if (query.department) where.departmentId = query.department
  if (query.staff) where.assignedStaffId = query.staff
  const orderBy = { [pagination.sort]: pagination.direction } as Prisma.SupportTicketOrderByWithRelationInput
  const [tickets, total, departments, staff] = await Promise.all([
    prisma.supportTicket.findMany({ where, skip: pagination.skip, take: pagination.pageSize, orderBy, include: { user: { include: { profile: true } }, department: { select: { name: true } }, assignedStaff: { select: { name: true } } } }),
    prisma.supportTicket.count({ where }),
    prisma.supportDepartment.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.staff.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])
  return {
    ...pagination, total, departments, staff,
    rows: tickets.map((ticket) => ({ id: ticket.id, ticketNumber: ticket.ticketNumber, customer: ticket.user?.profile ? `${ticket.user.profile.firstName} ${ticket.user.profile.lastName}` : ticket.user?.email ?? "Guest", department: ticket.department.name, subject: ticket.subject, priority: ticket.priority, status: ticket.status, assignedStaff: ticket.assignedStaff?.name ?? "Unassigned", lastResponse: ticket.lastResponseAt?.toISOString() ?? "", createdAt: ticket.createdAt.toISOString() })),
  }
}
