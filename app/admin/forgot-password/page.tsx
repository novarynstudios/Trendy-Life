import Link from "next/link"
import { requestStaffPasswordResetAction } from "../auth-actions"

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const query = await searchParams
  return <main className="tl-auth-shell"><section className="tl-auth-card"><header><span className="tl-auth-mark">TL</span><div><h1>Reset staff password</h1><p>Trendy Life Admin · Trendy Group</p></div></header>{query.sent ? <div className="tl-auth-form"><div className="tl-alert tl-alert-success">If an active staff account matches that email, a short-lived reset link has been queued.</div><Link className="tl-button tl-button-primary tl-button-wide" href="/admin/login">Return to sign in</Link></div> : <form className="tl-auth-form" action={requestStaffPasswordResetAction}><p>Enter your staff email. For privacy, the response is identical whether or not the account exists.</p><label>Email address<input name="email" type="email" autoComplete="email" required /></label><button className="tl-button tl-button-primary tl-button-wide" type="submit">Send reset link</button><Link href="/admin/login">Return to sign in</Link></form>}</section></main>
}
