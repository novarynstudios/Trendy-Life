import Link from "next/link"
import { Download } from "lucide-react"
import { money } from "@/lib/format"
import { PrintButton } from "@/components/admin/print-button"
import { RevenueChart } from "@/components/admin/revenue-chart"
import { requireStaff } from "@/src/server/auth/staff"
import { getDashboardData } from "@/src/server/services/dashboard"
import { prisma } from "@/src/server/db/prisma"

const reportGroups = [
  ["Revenue", "Gross, net, tax, discounts, shipping and comparison periods"],
  ["Orders", "Volume, status, channel, average value and conversion"],
  ["Customers", "New, returning, lifetime value, groups and retention"],
  ["Products", "Units, revenue, categories, brands and margin"],
  ["Payments", "Gateways, fees, failures, refunds and reconciliation"],
  ["Inventory", "Valuation, aging, low stock, out of stock and movement"],
  ["Support", "Volume, SLA, first response, resolution and satisfaction"],
  ["Staff activity", "Actions, exports, sensitive operations and outcomes"],
] as const

export default async function ReportsPage() {
  const staff = await requireStaff("reports.view")
  const [dashboard, orders, customers, refunds, inventoryValue] = await Promise.all([
    getDashboardData(staff.id),
    prisma.order.aggregate({
      where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
      _count: { _all: true },
      _sum: { total: true },
      _avg: { total: true },
    }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.refund.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.inventoryItem.findMany({
      select: {
        onHand: true,
        product: { select: { costPrice: true } },
        variant: { select: { costPrice: true } },
      },
    }),
  ])
  const valuation = inventoryValue.reduce(
    (sum, item) => sum + item.onHand * Number(item.variant?.costPrice ?? item.product.costPrice ?? 0),
    0,
  )

  return (
    <>
      <header className="tl-page-header">
        <div>
          <nav className="tl-breadcrumbs">
            <Link href="/admin">Administration</Link><span>/</span><span>Reports</span>
          </nav>
          <h1>Reports & analytics</h1>
          <p>Revenue, customers, products, payments, inventory, support, and staff performance.</p>
        </div>
        <div className="tl-page-actions">
          <PrintButton />
          <Link className="tl-button tl-button-primary" href="/admin/exports/report-summary">
            <Download size={14} />Export CSV
          </Link>
        </div>
      </header>

      <section className="tl-summary-stat-grid">
        <article><span>Net sales</span><strong>{money(Number(orders._sum.total ?? 0) - Number(refunds._sum.amount ?? 0))}</strong></article>
        <article><span>Gross sales</span><strong>{money(Number(orders._sum.total ?? 0))}</strong></article>
        <article><span>Orders</span><strong>{orders._count._all}</strong></article>
        <article><span>Average order value</span><strong>{money(Number(orders._avg.total ?? 0))}</strong></article>
        <article><span>Active customers</span><strong>{customers}</strong></article>
        <article><span>Inventory value</span><strong>{money(valuation)}</strong></article>
      </section>

      <RevenueChart data={dashboard.chart} />
      <section className="tl-report-grid">
        {reportGroups.map(([title, description]) => (
          <Link
            className="tl-card"
            key={title}
            href={`/admin/reports?report=${title.toLocaleLowerCase().replaceAll(" ", "-")}`}
          >
            <h2>{title}</h2><p>{description}</p><span>Open report →</span>
          </Link>
        ))}
      </section>
    </>
  )
}
