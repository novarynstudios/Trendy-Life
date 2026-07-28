import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, RotateCcw } from "lucide-react"
import { formatDateTime, money } from "@/lib/format"
import { processRefundAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("payments.view")
  const [{ id }, csrfToken] = await Promise.all([params, getCsrfToken()])
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id },
    include: {
      payment: {
        include: {
          order: { include: { user: { include: { profile: true } } } },
          transactions: { orderBy: { createdAt: "desc" } },
          refunds: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  })
  if (!transaction) notFound()
  const { payment } = transaction
  const order = payment.order
  const refundable = Math.max(0, Number(order.paidTotal.minus(order.refundedTotal)))
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/payments">Payments</Link><span>/</span><span>{transaction.transactionId}</span></nav><Link className="tl-back-link" href="/admin/payments"><ArrowLeft size={13} />Back to payments</Link><div className="tl-record-title"><h1>{transaction.transactionId}</h1><span className={`tl-status ${transaction.status.toLocaleLowerCase()}`}>{transaction.status.toLocaleLowerCase()}</span></div><p>{payment.gateway} · {payment.method} · {formatDateTime(transaction.createdAt.toISOString())}</p></div><div className="tl-page-actions"><Link className="tl-button" href={`/admin/orders/${order.id}`}>Open order</Link></div></header><div className="tl-detail-grid"><div className="tl-detail-primary"><section className="tl-summary-stat-grid"><article><span>Amount</span><strong>{money(Number(transaction.amount))}</strong></article><article><span>Fee</span><strong>{money(Number(transaction.fee))}</strong></article><article><span>Currency</span><strong>{transaction.currency}</strong></article><article><span>Type</span><strong>{transaction.type}</strong></article><article><span>Gateway</span><strong>{payment.gateway}</strong></article><article><span>Order</span><strong>{order.orderNumber}</strong></article></section><section className="tl-card"><div className="tl-card-header"><h2>Gateway response log</h2></div><pre className="tl-json-view">{JSON.stringify(transaction.gatewayResponse ?? { gatewayReference: payment.gatewayReference, responseCode: transaction.gatewayResponseCode, note: "No raw gateway response stored for this transaction." }, null, 2)}</pre></section><section className="tl-card"><div className="tl-card-header"><h2>Payment transaction history</h2></div><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Transaction</th><th>Type</th><th>Status</th><th>Date</th><th className="numeric">Amount</th></tr></thead><tbody>{payment.transactions.map((entry) => <tr key={entry.id}><td>{entry.transactionId}</td><td>{entry.type}</td><td>{entry.status}</td><td>{formatDateTime(entry.createdAt.toISOString())}</td><td className="numeric">{money(Number(entry.amount))}</td></tr>)}</tbody></table></div></section></div><aside className="tl-detail-aside"><section className="tl-card tl-record-meta"><div className="tl-card-header"><h2>Payment details</h2></div><dl><div><dt>Customer</dt><dd>{order.user?.profile ? `${order.user.profile.firstName} ${order.user.profile.lastName}` : order.user?.email ?? "Guest"}</dd></div><div><dt>Gateway ref.</dt><dd>{payment.gatewayReference ?? "—"}</dd></div><div><dt>Authorized</dt><dd>{payment.authorizedAt ? formatDateTime(payment.authorizedAt.toISOString()) : "—"}</dd></div><div><dt>Captured</dt><dd>{payment.capturedAt ? formatDateTime(payment.capturedAt.toISOString()) : "—"}</dd></div></dl></section>{refundable > 0 && <form className="tl-card tl-compact-form" action={processRefundAction}><div className="tl-card-header"><h2>Refund payment</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="orderId" value={order.id} /><label>Amount<input name="amount" type="number" min="0.01" max={refundable} step="0.01" required /></label><label>Reason<textarea name="reason" rows={4} required /></label><label className="tl-checkbox"><input name="restock" type="checkbox" /><span>Restock on full refund</span></label><button className="tl-button tl-button-danger tl-button-wide" type="submit"><RotateCcw size={14} />Process refund</button></div></form>}</aside></div></>
}
