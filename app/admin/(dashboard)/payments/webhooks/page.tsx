import Link from "next/link"
import { formatDateTime } from "@/lib/format"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function PaymentWebhooksPage() {
  await requireStaff("payments.view")
  const events = await prisma.paymentWebhookEvent.findMany({ take: 200, orderBy: { receivedAt: "desc" } })
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/payments">Payments</Link><span>/</span><span>Webhooks</span></nav><h1>Payment webhook events</h1><p>Signature-verified delivery history, replay protection, processing state, and safe retry visibility.</p></div></header><section className="tl-card"><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Gateway</th><th>External event</th><th>Status</th><th>Attempts</th><th>Received</th><th>Processed</th><th>Last error</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><strong>{event.gateway}</strong></td><td>{event.externalEventId}</td><td><span className={`tl-status ${event.status.toLocaleLowerCase()}`}>{event.status.toLocaleLowerCase()}</span></td><td>{event.attempts}</td><td>{formatDateTime(event.receivedAt.toISOString())}</td><td>{event.processedAt ? formatDateTime(event.processedAt.toISOString()) : "—"}</td><td>{event.lastError ?? "—"}</td></tr>)}{!events.length && <tr><td colSpan={7}><p className="tl-widget-empty">No payment webhook events have been received.</p></td></tr>}</tbody></table></div></section></>
}
