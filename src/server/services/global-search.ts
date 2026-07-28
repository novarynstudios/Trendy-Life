import "server-only"

import { prisma } from "@/src/server/db/prisma"
import { rateLimit } from "@/src/server/security/rate-limit"
import { requestMetadata } from "@/src/server/security/request"

export type SearchResult = { id: string; category: string; title: string; subtitle: string; href: string; status?: string }

export async function globalAdminSearch(query: string, includeStaff: boolean) {
  const q = query.trim().slice(0, 150)
  if (q.length < 2) return []
  const request = await requestMetadata()
  const limiter = await rateLimit(`admin:search:${request.ipAddress ?? "unknown"}`, 120, 60)
  if (!limiter.allowed) throw new Error("Search rate limit exceeded")
  const [users, orders, products, categories, transactions, coupons, tickets, invoices, staff, emails] = await Promise.all([
    prisma.user.findMany({ where: { OR: [{ email: { contains: q, mode: "insensitive" } }, { profile: { phone: { contains: q, mode: "insensitive" } } }, { profile: { customerNumber: { contains: q, mode: "insensitive" } } }, { profile: { firstName: { contains: q, mode: "insensitive" } } }, { profile: { lastName: { contains: q, mode: "insensitive" } } }] }, take: 8, include: { profile: true } }),
    prisma.order.findMany({ where: { OR: [{ orderNumber: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }] }, take: 8, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
        ],
      },
      take: 8,
    }),
    prisma.category.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }, take: 5 }),
    prisma.paymentTransaction.findMany({ where: { transactionId: { contains: q, mode: "insensitive" } }, take: 8, include: { payment: { include: { order: true } } } }),
    prisma.coupon.findMany({ where: { code: { contains: q, mode: "insensitive" } }, take: 8 }),
    prisma.supportTicket.findMany({ where: { OR: [{ ticketNumber: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }] }, take: 8 }),
    prisma.invoice.findMany({ where: { invoiceNumber: { contains: q, mode: "insensitive" } }, take: 8, include: { order: true } }),
    includeStaff ? prisma.staff.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }, take: 8, include: { role: true } }) : [],
    prisma.emailLog.findMany({ where: { OR: [{ recipient: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }] }, take: 8, orderBy: { queuedAt: "desc" } }),
  ])
  const results: SearchResult[] = [
    ...users.map((user) => ({ id: user.id, category: "Customers", title: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email, subtitle: `${user.profile?.customerNumber ?? ""} · ${user.email} · ${user.profile?.phone ?? ""}`, href: `/admin/customers/${user.id}`, status: user.status })),
    ...orders.map((order) => ({ id: order.id, category: "Orders", title: order.orderNumber, subtitle: `${order.currency} ${order.total.toString()} · ${order.paymentStatus}`, href: `/admin/orders/${order.id}`, status: order.status })),
    ...products.map((product) => ({ id: product.id, category: "Products & SKUs", title: product.name, subtitle: `${product.sku ?? "Variable"} · ${product.type}`, href: `/admin/products/${product.id}`, status: product.status })),
    ...categories.map((category) => ({ id: category.id, category: "Categories", title: category.name, subtitle: `/${category.slug}`, href: `/admin/products/categories?category=${category.id}`, status: category.status })),
    ...transactions.map((transaction) => ({ id: transaction.id, category: "Transactions", title: transaction.transactionId, subtitle: `${transaction.payment.order.orderNumber} · ${transaction.currency} ${transaction.amount.toString()}`, href: `/admin/payments/${transaction.id}`, status: transaction.status })),
    ...coupons.map((coupon) => ({ id: coupon.id, category: "Coupons", title: coupon.code, subtitle: `${coupon.type} · ${coupon.amount.toString()}`, href: `/admin/marketing?coupon=${coupon.id}`, status: coupon.active ? "ACTIVE" : "DISABLED" })),
    ...tickets.map((ticket) => ({ id: ticket.id, category: "Support tickets", title: `${ticket.ticketNumber} · ${ticket.subject}`, subtitle: ticket.priority, href: `/admin/tickets/${ticket.id}`, status: ticket.status })),
    ...invoices.map((invoice) => ({ id: invoice.id, category: "Invoices", title: invoice.invoiceNumber, subtitle: `${invoice.order.orderNumber} · ${invoice.currency} ${invoice.total.toString()}`, href: `/admin/invoices/${invoice.id}`, status: invoice.status })),
    ...staff.map((member) => ({ id: member.id, category: "Staff", title: member.name, subtitle: `${member.email} · ${member.role.name}`, href: `/admin/staff/${member.id}`, status: member.status })),
    ...emails.map((email) => ({ id: email.id, category: "Email logs", title: email.subject, subtitle: `${email.recipient} · ${email.status}`, href: `/admin/communications?email=${email.id}`, status: email.status })),
  ]
  return results
}
