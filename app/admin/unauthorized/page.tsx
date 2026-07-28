import Link from "next/link"

export default function UnauthorizedPage() {
  return <main className="tl-auth-shell"><section className="tl-auth-card"><header><span className="tl-auth-mark">401</span><div><h1>Authentication required</h1><p>Trendy Life Admin</p></div></header><div className="tl-auth-form"><p>Your administrative session is missing, expired, locked, or revoked.</p><Link className="tl-button tl-button-primary tl-button-wide" href="/admin/login">Sign in securely</Link></div></section></main>
}
