import Link from "next/link"
import { formatDateTime, money } from "@/lib/format"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function ReturnsPage() {
  await requireStaff("orders.view")
  const returns = await prisma.returnRequest.findMany({ take: 150, orderBy: { requestedAt: "desc" }, include: { order: { include: { user: { include: { profile: true } } } }, items: true } })
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Returns</span></nav><h1>Returns & refunds</h1><p>Return requests, inspection, condition, restock decisions, replacements, and refund approvals.</p></div><div className="tl-page-actions"><Link className="tl-button" href="/admin/settings?section=returns">Return policy settings</Link></div></header><section className="tl-card"><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Return</th><th>Order</th><th>Customer</th><th>Reason</th><th>Status</th><th>Items</th><th className="numeric">Refund amount</th><th>Requested</th></tr></thead><tbody>{returns.map((request) => <tr key={request.id}><td><Link className="tl-table-primary" href={`/admin/returns/${request.id}`}>{request.returnNumber}</Link></td><td><Link href={`/admin/orders/${request.orderId}`}>{request.order.orderNumber}</Link></td><td>{request.order.user?.profile ? `${request.order.user.profile.firstName} ${request.order.user.profile.lastName}` : "Guest"}</td><td>{request.reason}</td><td><span className={`tl-status ${request.status.toLocaleLowerCase()}`}>{request.status.replaceAll("_"," ").toLocaleLowerCase()}</span></td><td>{request.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td className="numeric">{request.refundAmount ? money(Number(request.refundAmount)) : "—"}</td><td>{formatDateTime(request.requestedAt.toISOString())}</td></tr>)}</tbody></table></div></section></>
}
