import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft, Banknote, ClipboardList, Copy, CreditCard, FileText,
  History, Mail, MessageSquareText, PackageCheck, ReceiptText, RotateCcw,
  Save, ShieldAlert, ShoppingBag, Truck, UserRound,
} from "lucide-react"
import { formatDateTime, money } from "@/lib/format"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"
import { getOrderDetail } from "@/src/server/services/orders"
import {
  addOrderNoteAction, assignOrderStaffAction, createShipmentAction, duplicateOrderAction,
  enqueueOrderCommunicationAction, generateInvoiceAction, processRefundAction,
  recordManualPaymentAction, updateOrderStatusAction,
} from "../../actions"

const tabs = [
  ["summary", "Summary", ClipboardList],
  ["products", "Products", ShoppingBag],
  ["payment", "Payment", CreditCard],
  ["fulfillment", "Fulfillment", Truck],
  ["customer", "Customer", UserRound],
  ["timeline", "Timeline", History],
  ["notes", "Notes", MessageSquareText],
  ["fraud", "Fraud analysis", ShieldAlert],
  ["emails", "Emails", Mail],
  ["invoice", "Invoice", ReceiptText],
] as const

function AddressCard({ title, address }: { title: string; address: { firstName: string; lastName: string; company: string | null; line1: string; line2: string | null; city: string; district: string | null; postalCode: string | null; countryCode: string; email: string | null; phone: string | null } | undefined }) {
  return <section className="tl-record-box"><h3>{title}</h3>{address ? <address><strong>{address.firstName} {address.lastName}</strong>{address.company && <span>{address.company}</span>}<span>{address.line1}</span>{address.line2 && <span>{address.line2}</span>}<span>{[address.city, address.district, address.postalCode].filter(Boolean).join(", ")}</span><span>{address.countryCode}</span>{address.email && <a href={`mailto:${address.email}`}>{address.email}</a>}{address.phone && <a href={`tel:${address.phone}`}>{address.phone}</a>}</address> : <p className="tl-muted">No address recorded.</p>}</section>
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; saved?: string; created?: string }>
}) {
  await requireStaff("orders.view")
  const { id } = await params
  const query = await searchParams
  const activeTab = tabs.some(([key]) => key === query.tab) ? query.tab! : "summary"
  const [order, csrfToken, staff] = await Promise.all([
    getOrderDetail(id),
    getCsrfToken(),
    prisma.staff.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])
  if (!order) notFound()
  const billing = order.addresses.find((address) => address.type === "BILLING")
  const shipping = order.addresses.find((address) => address.type === "SHIPPING")
  const amountDue = Math.max(0, Number(order.total.minus(order.paidTotal)))
  const refundable = Math.max(0, Number(order.paidTotal.minus(order.refundedTotal)))
  const customerName = order.user?.profile ? `${order.user.profile.firstName} ${order.user.profile.lastName}` : order.user?.email ?? "Guest customer"

  return (
    <>
      <header className="tl-page-header">
        <div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/orders">Orders</Link><span>/</span><span>{order.orderNumber}</span></nav><Link className="tl-back-link" href="/admin/orders"><ArrowLeft size={13} />Back to orders</Link><div className="tl-record-title"><h1>{order.orderNumber}</h1><span className={`tl-status ${order.status.toLocaleLowerCase()}`}>{order.status.replaceAll("_", " ").toLocaleLowerCase()}</span></div><p>Created {formatDateTime(order.createdAt.toISOString())} · {customerName}</p></div>
        <div className="tl-page-actions">
          <form action={duplicateOrderAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="orderId" value={order.id} /><button className="tl-button" type="submit"><Copy size={14} />Duplicate</button></form>
          <form action={generateInvoiceAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="orderId" value={order.id} /><button className="tl-button" type="submit"><FileText size={14} />Generate invoice</button></form>
          <Link className="tl-button tl-button-primary" href={`/admin/orders/${order.id}?tab=fulfillment`}><Truck size={14} />Create shipment</Link>
        </div>
      </header>
      {query.saved && <div className="tl-alert tl-alert-success">The {query.saved.replaceAll("-", " ")} action completed successfully.</div>}
      {query.created && <div className="tl-alert tl-alert-success">This draft was duplicated from another order.</div>}

      <div className="tl-record-layout">
        <aside className="tl-context-sidebar">
          <h2>Order</h2>
          <nav>{tabs.map(([key, label, Icon]) => <Link key={key} className={activeTab === key ? "is-active" : ""} href={`/admin/orders/${order.id}?tab=${key}`}><Icon size={14} />{label}</Link>)}</nav>
          <h2>Related</h2>
          <nav>{order.userId && <Link href={`/admin/customers/${order.userId}`}><UserRound size={14} />Customer record</Link>}{order.invoices[0] && <Link href={`/admin/invoices/${order.invoices[0].id}`}><ReceiptText size={14} />Invoice</Link>}<Link href={`/admin/tickets/new?order=${order.id}`}><MessageSquareText size={14} />Open ticket</Link></nav>
        </aside>

        <main className="tl-record-main">
          <nav className="tl-record-tabs" aria-label="Order detail sections">{tabs.map(([key, label]) => <Link key={key} className={activeTab === key ? "is-active" : ""} href={`/admin/orders/${order.id}?tab=${key}`}>{label}</Link>)}</nav>

          {activeTab === "summary" && <div className="tl-detail-grid">
            <div className="tl-detail-primary">
              <section className="tl-card">
                <div className="tl-card-header"><div><h2>Order summary</h2><p>{order.items.reduce((sum, item) => sum + item.quantity, 0)} units across {order.items.length} line items</p></div></div>
                <div className="tl-order-lines">{order.items.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.variant?.name ? `${item.variant.name} · ` : ""}{item.sku}</small></span><span>{item.quantity} × {money(Number(item.unitPrice))}</span><b>{money(Number(item.lineTotal))}</b></div>)}</div>
                <dl className="tl-order-totals"><div><dt>Subtotal</dt><dd>{money(Number(order.subtotal))}</dd></div><div><dt>Discount</dt><dd>−{money(Number(order.discountTotal))}</dd></div><div><dt>Tax</dt><dd>{money(Number(order.taxTotal))}</dd></div><div><dt>Shipping</dt><dd>{money(Number(order.shippingTotal))}</dd></div><div className="total"><dt>Total</dt><dd>{money(Number(order.total))}</dd></div><div><dt>Paid</dt><dd>{money(Number(order.paidTotal))}</dd></div><div className="due"><dt>Amount due</dt><dd>{money(amountDue)}</dd></div></dl>
              </section>
              <div className="tl-address-grid"><AddressCard title="Billing address" address={billing} /><AddressCard title="Shipping address" address={shipping} /></div>
              <section className="tl-card"><div className="tl-card-header"><h2>Latest activity</h2><Link href={`/admin/orders/${order.id}?tab=timeline`}>Full timeline</Link></div><div className="tl-timeline tl-record-timeline">{order.statusHistory.slice(0, 5).map((event) => <div key={event.id}><span className="success" /><p><strong>{event.staff?.name ?? "System"}</strong> changed status to {event.toStatus.replaceAll("_", " ").toLocaleLowerCase()}<small>{formatDateTime(event.createdAt.toISOString())}{event.reason ? ` · ${event.reason}` : ""}</small></p></div>)}</div></section>
            </div>
            <aside className="tl-detail-aside">
              <form className="tl-card tl-compact-form" action={updateOrderStatusAction}>
                <div className="tl-card-header"><h2>Order workflow</h2></div>
                <div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={order.id} /><label>Status<select name="status" defaultValue={order.status}>{["DRAFT","PENDING_PAYMENT","PAYMENT_FAILED","PAID","CONFIRMED","PROCESSING","READY_TO_SHIP","SHIPPED","DELIVERED","CANCELLED","PARTIALLY_REFUNDED","REFUNDED","ON_HOLD","FRAUD_REVIEW"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Reason<input name="reason" defaultValue="Administrative update" required /></label><button className="tl-button tl-button-primary tl-button-wide" type="submit"><Save size={14} />Update status</button></div>
              </form>
              <form className="tl-card tl-compact-form" action={assignOrderStaffAction}>
                <div className="tl-card-header"><h2>Assignment</h2></div>
                <div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="orderId" value={order.id} /><label>Assigned staff<select name="staffId" defaultValue={order.assignedStaffId ?? ""}><option value="">Unassigned</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><button className="tl-button tl-button-wide" type="submit">Save assignment</button></div>
              </form>
              <section className="tl-card tl-record-meta"><div className="tl-card-header"><h2>Order metadata</h2></div><dl><div><dt>Channel</dt><dd>{order.salesChannel}</dd></div><div><dt>Currency</dt><dd>{order.currency}</dd></div><div><dt>IP address</dt><dd>{order.ipAddress ?? "Not recorded"}</dd></div><div><dt>Risk score</dt><dd>{order.riskScore}/100</dd></div><div><dt>Assigned</dt><dd>{order.assignedStaff?.name ?? "Unassigned"}</dd></div></dl></section>
            </aside>
          </div>}

          {activeTab === "products" && <section className="tl-card"><div className="tl-card-header"><div><h2>Products and variations</h2><p>Pricing, discounts, tax, and fulfillment quantities</p></div></div><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Fulfilled</th><th>Refunded</th><th className="numeric">Unit price</th><th className="numeric">Discount</th><th className="numeric">Tax</th><th className="numeric">Line total</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong>{item.variant?.name && <small>{item.variant.name}</small>}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{item.fulfilledQty}</td><td>{item.refundedQty}</td><td className="numeric">{money(Number(item.unitPrice))}</td><td className="numeric">{money(Number(item.discountTotal))}</td><td className="numeric">{money(Number(item.taxTotal))}</td><td className="numeric"><strong>{money(Number(item.lineTotal))}</strong></td></tr>)}</tbody></table></div></section>}

          {activeTab === "payment" && <div className="tl-detail-grid">
            <div className="tl-detail-primary"><section className="tl-card"><div className="tl-card-header"><div><h2>Payments and transactions</h2><p>Server-verified gateway and offline payment records</p></div></div>{order.payments.map((payment) => <article className="tl-payment-record" key={payment.id}><header><span><CreditCard size={16} /><strong>{payment.method}</strong><small>{payment.gateway} · {payment.gatewayReference ?? "No reference"}</small></span><span className={`tl-status ${payment.status.toLocaleLowerCase()}`}>{payment.status.toLocaleLowerCase()}</span><b>{money(Number(payment.amount))}</b></header>{payment.transactions.map((transaction) => <div key={transaction.id}><span>{transaction.transactionId}</span><span>{transaction.type.toLocaleLowerCase()}</span><span>{formatDateTime(transaction.createdAt.toISOString())}</span><strong>{money(Number(transaction.amount))}</strong></div>)}</article>)}{!order.payments.length && <p className="tl-widget-empty">No payments have been recorded.</p>}</section></div>
            <aside className="tl-detail-aside">
              {amountDue > 0 && <form className="tl-card tl-compact-form" action={recordManualPaymentAction}><div className="tl-card-header"><h2>Record offline payment</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="orderId" value={order.id} /><label>Amount<input name="amount" type="number" step="0.01" min="0.01" max={amountDue} defaultValue={amountDue} required /></label><label>Method<select name="method"><option>Cash on delivery</option><option>Bank transfer</option><option>bKash manual</option><option>Nagad manual</option></select></label><label>Reference<input name="reference" required /></label><button className="tl-button tl-button-success tl-button-wide" type="submit"><Banknote size={14} />Record payment</button></div></form>}
              {refundable > 0 && <form className="tl-card tl-compact-form tl-danger-form" action={processRefundAction}><div className="tl-card-header"><h2>Process refund</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="orderId" value={order.id} /><label>Refund amount<input name="amount" type="number" step="0.01" min="0.01" max={refundable} required /></label><label>Reason<textarea name="reason" rows={3} required /></label><label className="tl-checkbox"><input name="restock" type="checkbox" /><span>Restock eligible items for a full refund</span></label><button className="tl-button tl-button-danger tl-button-wide" type="submit"><RotateCcw size={14} />Confirm refund</button></div></form>}
            </aside>
          </div>}

          {activeTab === "fulfillment" && <div className="tl-detail-grid">
            <div className="tl-detail-primary"><section className="tl-card"><div className="tl-card-header"><div><h2>Shipments</h2><p>Multiple and partial shipments are supported</p></div></div>{order.shipments.map((shipment) => <article className="tl-shipment-record" key={shipment.id}><header><span><Truck size={16} /><strong>{shipment.shipmentNumber}</strong><small>{shipment.courier ?? "Courier not set"}</small></span><span className={`tl-status ${shipment.status.toLocaleLowerCase()}`}>{shipment.status.replaceAll("_", " ").toLocaleLowerCase()}</span></header><dl><div><dt>Tracking number</dt><dd>{shipment.trackingNumber ?? "—"}</dd></div><div><dt>Shipped</dt><dd>{shipment.shippedAt ? formatDateTime(shipment.shippedAt.toISOString()) : "—"}</dd></div><div><dt>Delivered</dt><dd>{shipment.deliveredAt ? formatDateTime(shipment.deliveredAt.toISOString()) : "—"}</dd></div></dl></article>)}{!order.shipments.length && <p className="tl-widget-empty">No shipments have been created.</p>}</section></div>
            <aside className="tl-detail-aside"><form className="tl-card tl-compact-form" action={createShipmentAction}><div className="tl-card-header"><h2>Create shipment</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="orderId" value={order.id} /><label>Courier<select name="courier"><option>Pathao Courier</option><option>Steadfast</option><option>RedX</option><option>Paperfly</option><option>Manual courier</option></select></label><label>Tracking number<input name="trackingNumber" required /></label><label>Tracking URL<input name="trackingUrl" type="url" /></label><button className="tl-button tl-button-primary tl-button-wide" type="submit"><PackageCheck size={14} />Create and mark shipped</button></div></form></aside>
          </div>}

          {activeTab === "customer" && <div className="tl-address-grid"><section className="tl-card tl-customer-summary"><div className="tl-card-header"><h2>Customer</h2></div><div className="tl-card-body"><span className="tl-large-avatar">{customerName.split(/\s+/).map((part) => part[0]).join("").slice(0,2)}</span><h3>{customerName}</h3><a href={`mailto:${order.user?.email}`}>{order.user?.email}</a>{order.user?.profile?.phone && <a href={`tel:${order.user.profile.phone}`}>{order.user.profile.phone}</a>}{order.userId && <Link className="tl-button" href={`/admin/customers/${order.userId}`}>Open customer profile</Link>}</div></section><AddressCard title="Billing address" address={billing} /><AddressCard title="Shipping address" address={shipping} /></div>}

          {activeTab === "timeline" && <section className="tl-card"><div className="tl-card-header"><h2>Complete order timeline</h2></div><div className="tl-timeline tl-record-timeline tl-full-timeline">{order.statusHistory.map((event) => <div key={event.id}><span className="success" /><p><strong>{event.staff?.name ?? "System"}</strong> changed status from {event.fromStatus?.replaceAll("_", " ").toLocaleLowerCase() ?? "created"} to {event.toStatus.replaceAll("_", " ").toLocaleLowerCase()}<small>{formatDateTime(event.createdAt.toISOString())}{event.reason ? ` · ${event.reason}` : ""}</small></p></div>)}</div></section>}

          {activeTab === "notes" && <div className="tl-detail-grid"><div className="tl-detail-primary"><section className="tl-card"><div className="tl-card-header"><h2>Private staff notes</h2></div><div className="tl-note-list">{order.notes.map((note) => <article key={note.id}><header><strong>{note.staff?.name ?? "System"}</strong><time>{formatDateTime(note.createdAt.toISOString())}</time></header><p>{note.body}</p></article>)}{!order.notes.length && <p className="tl-widget-empty">No private notes.</p>}</div></section>{order.customerNote && <section className="tl-card"><div className="tl-card-header"><h2>Customer note</h2></div><div className="tl-card-body"><p>{order.customerNote}</p></div></section>}</div><aside className="tl-detail-aside"><form className="tl-card tl-compact-form" action={addOrderNoteAction}><div className="tl-card-header"><h2>Add private note</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={order.id} /><label>Note<textarea name="body" rows={7} required /></label><button className="tl-button tl-button-primary tl-button-wide" type="submit"><MessageSquareText size={14} />Add note</button></div></form></aside></div>}

          {activeTab === "fraud" && <div className="tl-detail-grid"><div className="tl-detail-primary"><section className="tl-card"><div className="tl-card-header"><h2>Risk assessment</h2><span className={`tl-risk-score ${order.riskScore >= 70 ? "high" : order.riskScore >= 35 ? "medium" : "low"}`}>{order.riskScore}/100</span></div><div className="tl-risk-panel"><ShieldAlert size={34} /><div><h3>{order.riskScore >= 70 ? "High risk" : order.riskScore >= 35 ? "Review recommended" : "Low observed risk"}</h3><p>Risk indicators are based on request metadata, account history, payment response, and configurable fraud rules.</p></div></div></section><section className="tl-card"><div className="tl-card-header"><h2>Recorded indicators</h2></div><pre className="tl-json-view">{JSON.stringify(order.riskIndicators ?? { ipAddress: order.ipAddress, userAgent: order.userAgent, assessment: "No elevated indicators recorded" }, null, 2)}</pre></section></div><aside className="tl-detail-aside"><section className="tl-card tl-record-meta"><div className="tl-card-header"><h2>Request metadata</h2></div><dl><div><dt>IP address</dt><dd>{order.ipAddress ?? "—"}</dd></div><div><dt>User agent</dt><dd>{order.userAgent ?? "—"}</dd></div><div><dt>Customer sessions</dt><dd>{order.user?.sessions.length ?? 0}</dd></div></dl></section></aside></div>}

          {activeTab === "emails" && <div className="tl-detail-grid"><div className="tl-detail-primary"><section className="tl-card"><div className="tl-card-header"><h2>Order email actions</h2></div><div className="tl-action-list">{[["order-confirmation","Resend order confirmation"],["invoice","Send invoice"],["payment-receipt","Send payment receipt"],["shipment","Send shipment notification"]].map(([template,label]) => <form key={template} action={enqueueOrderCommunicationAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="template" value={template} /><span><Mail size={15} /><strong>{label}</strong></span><button className="tl-button" type="submit">Queue email</button></form>)}</div></section></div></div>}

          {activeTab === "invoice" && <section className="tl-card"><div className="tl-card-header"><div><h2>Invoices</h2><p>Generated documents and payment status</p></div><form action={generateInvoiceAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="orderId" value={order.id} /><button className="tl-button tl-button-primary" type="submit">Generate invoice</button></form></div><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Invoice</th><th>Issue date</th><th>Status</th><th className="numeric">Total</th><th className="numeric">Paid</th><th className="numeric">Due</th><th>Action</th></tr></thead><tbody>{order.invoices.map((invoice) => <tr key={invoice.id}><td><Link className="tl-table-primary" href={`/admin/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link></td><td>{formatDateTime(invoice.issueDate.toISOString())}</td><td><span className={`tl-status ${invoice.status.toLocaleLowerCase()}`}>{invoice.status.replaceAll("_"," ").toLocaleLowerCase()}</span></td><td className="numeric">{money(Number(invoice.total))}</td><td className="numeric">{money(Number(invoice.paidAmount))}</td><td className="numeric">{money(Number(invoice.dueAmount))}</td><td><Link className="tl-table-action" href={`/api/admin/invoices/${invoice.id}/pdf`}>Download PDF</Link></td></tr>)}{!order.invoices.length && <tr><td colSpan={7}><p className="tl-widget-empty">No invoice has been generated.</p></td></tr>}</tbody></table></div></section>}
        </main>
      </div>
    </>
  )
}
