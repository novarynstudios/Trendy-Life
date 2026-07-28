import Link from "next/link"

export default function AdminNotFound() {
  return <main className="tl-auth-shell"><section className="tl-auth-card"><header><span className="tl-auth-mark">404</span><div><h1>Admin record not found</h1><p>Trendy Life Admin</p></div></header><div className="tl-auth-form"><p>The requested record does not exist or is no longer available to this account.</p><Link className="tl-button tl-button-primary tl-button-wide" href="/admin">Return to dashboard</Link></div></section></main>
}
