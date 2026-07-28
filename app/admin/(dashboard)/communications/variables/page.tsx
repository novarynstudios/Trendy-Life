import Link from "next/link"
import { requireStaff } from "@/src/server/auth/staff"

const variables = [
  ["{{customer_name}}", "Customer display name"],
  ["{{order_number}}", "Order reference"],
  ["{{invoice_number}}", "Invoice reference"],
  ["{{order_total}}", "Formatted order total"],
  ["{{tracking_number}}", "Courier tracking number"],
  ["{{ticket_number}}", "Support ticket reference"],
  ["{{reset_link}}", "Short-lived, single-use reset URL"],
] as const

export default async function TemplateVariablesPage() {
  await requireStaff("content.view")
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/communications">Communications</Link><span>/</span><span>Variables</span></nav><h1>Template variables</h1><p>Allowlisted substitutions available to sanitized email, SMS, and notification templates.</p></div></header><section className="tl-card"><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Variable</th><th>Description</th><th>Safety</th></tr></thead><tbody>{variables.map(([key, description]) => <tr key={key}><td><code>{key}</code></td><td>{description}</td><td>Escaped before insertion</td></tr>)}</tbody></table></div><div className="tl-card-body"><p className="tl-inline-note">Arbitrary JavaScript, server expressions, dynamic property access, and raw HTML variables are not supported.</p></div></section></>
}
