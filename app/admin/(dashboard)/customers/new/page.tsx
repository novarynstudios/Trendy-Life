import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { createCustomerAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff("customers.create")
  const [csrfToken, query] = await Promise.all([getCsrfToken(), searchParams])
  return <>
    <header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/customers">Customers</Link><span>/</span><span>New</span></nav><Link className="tl-back-link" href="/admin/customers"><ArrowLeft size={13} />Back to customers</Link><h1>Create customer</h1><p>Create a verified CRM and storefront account. The customer must change the initial password.</p></div></header>
    {query.error && <div className="tl-alert tl-alert-danger">{query.error === "password-policy" ? "Use at least 12 characters with uppercase, lowercase, number, and symbol; do not include the customer’s identity." : "Review the required fields and try again."}</div>}
    <form className="tl-card tl-form-section tl-narrow-form" action={createCustomerAction}><div className="tl-card-header"><div><h2>Customer account</h2><p>Identity, contact, customer group, and initial access</p></div></div><div className="tl-card-body tl-form-grid"><input type="hidden" name="_csrf" value={csrfToken} /><label>First name *<input name="firstName" required /></label><label>Last name *<input name="lastName" required /></label><label>Email address *<input name="email" type="email" required /></label><label>Phone<input name="phone" type="tel" /></label><label>Customer group<select name="customerGroup"><option>Retail</option><option>Corporate</option><option>Wholesale</option><option>VIP</option></select></label><label>Initial password *<input name="password" type="password" autoComplete="new-password" minLength={12} required /><small>12+ characters with uppercase, lowercase, number, and symbol.</small></label><div className="span-2 tl-form-actions"><Link className="tl-button" href="/admin/customers">Cancel</Link><button className="tl-button tl-button-primary" type="submit"><Save size={14} />Create customer</button></div></div></form>
  </>
}
