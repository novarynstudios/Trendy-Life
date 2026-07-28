import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { formatDateTime, money } from "@/lib/format"
import { updateReturnStatusAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function ReturnDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireStaff("orders.view")
  const [{ id }, query, csrfToken] = await Promise.all([params, searchParams, getCsrfToken()])
  const request = await prisma.returnRequest.findUnique({
    where: { id },
    include: { order: { include: { user: { include: { profile: true } } } }, items: { include: { product: true } } },
  })
  if (!request) notFound()
  return (
    <>
      <header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/returns">Returns</Link><span>/</span><span>{request.returnNumber}</span></nav><Link className="tl-back-link" href="/admin/returns"><ArrowLeft size={13} />Back to returns</Link><div className="tl-record-title"><h1>{request.returnNumber}</h1><span className={`tl-status ${request.status.toLocaleLowerCase()}`}>{request.status.replaceAll("_", " ").toLocaleLowerCase()}</span></div><p>Requested {formatDateTime(request.requestedAt.toISOString())} · Order {request.order.orderNumber}</p></div><Link className="tl-button" href={`/admin/orders/${request.orderId}`}>Open order</Link></header>
      {query.saved && <div className="tl-alert tl-alert-success">Return workflow updated.</div>}
      <div className="tl-detail-grid">
        <div className="tl-detail-primary">
          <section className="tl-card"><div className="tl-card-header"><h2>Returned items</h2></div><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Product</th><th>Quantity</th><th>Condition</th><th>Restock</th><th>Inspection</th></tr></thead><tbody>{request.items.map((item) => <tr key={item.id}><td>{item.product?.name ?? "Archived product"}</td><td>{item.quantity}</td><td>{item.condition ?? "Pending inspection"}</td><td>{item.restockDecision == null ? "Pending" : item.restockDecision ? "Yes" : "No"}</td><td>{item.inspectionNotes ?? "—"}</td></tr>)}</tbody></table></div></section>
          <section className="tl-card"><div className="tl-card-header"><h2>Request details</h2></div><div className="tl-card-body"><dl className="tl-details-list"><div><dt>Reason</dt><dd>{request.reason}</dd></div><div><dt>Customer comments</dt><dd>{request.customerComments ?? "—"}</dd></div><div><dt>Staff comments</dt><dd>{request.staffComments ?? "—"}</dd></div><div><dt>Refund amount</dt><dd>{request.refundAmount ? money(Number(request.refundAmount)) : "Not approved"}</dd></div></dl></div></section>
        </div>
        <aside className="tl-detail-aside"><form className="tl-card tl-compact-form" action={updateReturnStatusAction}><div className="tl-card-header"><h2>Update return</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={request.id} /><label>Status<select name="status" defaultValue={request.status}>{["REQUESTED","APPROVED","REJECTED","AWAITING_ITEM","ITEM_RECEIVED","INSPECTION","REFUND_APPROVED","REFUNDED","REPLACEMENT_SHIPPED","CLOSED"].map((status) => <option key={status}>{status}</option>)}</select></label><label>Refund amount<input name="refundAmount" type="number" min="0" step="0.01" defaultValue={request.refundAmount ? Number(request.refundAmount) : ""} /></label><label>Staff comments<textarea name="staffComments" rows={6} defaultValue={request.staffComments ?? ""} /></label><button className="tl-button tl-button-primary tl-button-wide" type="submit"><Save size={14} />Save return</button></div></form></aside>
      </div>
    </>
  )
}
