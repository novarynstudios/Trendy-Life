import Link from "next/link"
import { recordManualPaymentAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function NewPaymentPage() {
  await requireStaff("payments.capture")
  const [csrfToken, orders] = await Promise.all([getCsrfToken(), prisma.order.findMany({ where: { paymentStatus: { in: ["PENDING", "PROCESSING", "FAILED"] } }, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, orderNumber: true, total: true, paidTotal: true } })])
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/payments">Payments</Link><span>/</span><span>Record payment</span></nav><h1>Record manual payment</h1><p>Record a verified offline payment against an outstanding order.</p></div></header><form className="tl-card tl-form-section tl-narrow-form" action={recordManualPaymentAction}><div className="tl-card-header"><h2>Payment details</h2></div><div className="tl-card-body tl-form-grid"><input type="hidden" name="_csrf" value={csrfToken} /><label className="span-2">Order<select name="orderId" required><option value="">Select an outstanding order</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · due {moneyValue(Number(order.total.minus(order.paidTotal)))}</option>)}</select></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Method<select name="method"><option>Cash on delivery</option><option>Bank transfer</option><option>bKash manual</option><option>Nagad manual</option></select></label><label className="span-2">External reference<input name="reference" required /></label><div className="span-2 tl-form-actions"><Link className="tl-button" href="/admin/payments">Cancel</Link><button className="tl-button tl-button-primary" type="submit">Record payment</button></div></div></form></>
}

function moneyValue(value: number) {
  return `৳${value.toLocaleString("en-BD")}`
}
