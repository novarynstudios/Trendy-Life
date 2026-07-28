import Link from "next/link"
import { requireStaff } from "@/src/server/auth/staff"

export default async function AdminHelpPage() {
  await requireStaff()
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Help</span></nav><h1>Administration help</h1><p>Operational shortcuts and security guidance for Trendy Life staff.</p></div></header><section className="tl-report-grid">{[["Orders","Create manual orders, record verified payments, generate invoices, ship, and refund."],["Catalog","Manage products, variants, categories, brands, pricing, SEO, and publication."],["Inventory","Use stock adjustments for every physical change so the immutable movement ledger remains complete."],["Support","Route tickets through departments and record customer replies separately from internal notes."],["Security","Use a unique password, enroll TOTP, review active sessions, and never share recovery codes."],["Audit","Sensitive changes, exports, authentication, refunds, and permission changes are recorded immutably."]].map(([title, body]) => <article className="tl-card" key={title}><h2>{title}</h2><p>{body}</p></article>)}</section></>
}
