import Link from "next/link"

export default function ForbiddenPage() {
  return <main className="tl-auth-shell"><section className="tl-auth-card"><header><span className="tl-auth-mark">403</span><div><h1>Access denied</h1><p>Trendy Life Admin</p></div></header><div className="tl-auth-form"><p>Your staff account does not have the permission required for this operation. The denial may be recorded in the security audit log.</p><Link className="tl-button tl-button-primary tl-button-wide" href="/admin">Return to dashboard</Link><Link href="/admin/help">Review administration help</Link></div></section></main>
}
