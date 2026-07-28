import Link from "next/link"
import { completeStaffPasswordResetAction } from "../auth-actions"

const messages: Record<string, string> = {
  validation: "Passwords must match and satisfy the required format.",
  policy: "Use at least 12 characters with upper, lower, number, and symbol, without your name or email.",
  expired: "This reset link is invalid, expired, or has already been used.",
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const query = await searchParams
  return <main className="tl-auth-shell"><section className="tl-auth-card"><header><span className="tl-auth-mark">TL</span><div><h1>Choose a new password</h1><p>Trendy Life Admin</p></div></header>{query.error && <div className="tl-alert tl-alert-danger">{messages[query.error] ?? messages.expired}</div>}{query.token ? <form className="tl-auth-form" action={completeStaffPasswordResetAction}><input type="hidden" name="token" value={query.token} /><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label><label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></label><button className="tl-button tl-button-primary tl-button-wide">Reset password</button></form> : <div className="tl-auth-form"><p>Request a new one-time reset link.</p><Link className="tl-button tl-button-primary tl-button-wide" href="/admin/forgot-password">Request reset link</Link></div>}</section></main>
}
