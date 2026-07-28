import Link from "next/link"
import { money } from "@/lib/format"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function ReconciliationPage() {
  await requireStaff("payments.reconcile")
  const [transactions, orderTotals] = await Promise.all([
    prisma.paymentTransaction.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true, fee: true } }),
    prisma.order.aggregate({ _sum: { total: true, paidTotal: true, refundedTotal: true }, _count: { _all: true } }),
  ])
  const captured = transactions.filter((row) => row.status === "SUCCESSFUL").reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0)
  const recordedPaid = Number(orderTotals._sum.paidTotal ?? 0)
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/payments">Payments</Link><span>/</span><span>Reconciliation</span></nav><h1>Payment reconciliation</h1><p>Compare recorded order payments with gateway transaction totals and fees.</p></div><Link className="tl-button tl-button-primary" href="/admin/exports/payments">Export transactions</Link></header><section className="tl-summary-stat-grid"><article><span>Successful transactions</span><strong>{money(captured)}</strong></article><article><span>Order paid total</span><strong>{money(recordedPaid)}</strong></article><article><span>Variance</span><strong>{money(captured - recordedPaid)}</strong></article><article><span>Refunds</span><strong>{money(Number(orderTotals._sum.refundedTotal ?? 0))}</strong></article></section><section className="tl-card"><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Status</th><th>Transactions</th><th className="numeric">Amount</th><th className="numeric">Fees</th></tr></thead><tbody>{transactions.map((row) => <tr key={row.status}><td><span className={`tl-status ${row.status.toLocaleLowerCase()}`}>{row.status.toLocaleLowerCase()}</span></td><td>{row._count._all}</td><td className="numeric">{money(Number(row._sum.amount ?? 0))}</td><td className="numeric">{money(Number(row._sum.fee ?? 0))}</td></tr>)}</tbody></table></div></section></>
}
