import type { Metadata } from "next"
import { KeyRound, ShieldCheck } from "lucide-react"
import { redirect } from "next/navigation"
import { verifyTwoFactorLoginAction } from "@/app/admin/auth-actions"
import { readPendingStaff } from "@/src/server/auth/staff"

export const metadata: Metadata = { title: "Two-factor verification | Trendy Life Admin" }

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const pending = await readPendingStaff()
  if (!pending) redirect("/admin/login?error=session-expired")
  const { error } = await searchParams
  return (
    <main className="tl-auth-page tl-auth-page-compact">
      <section className="tl-auth-form-area">
        <form className="tl-auth-form" action={verifyTwoFactorLoginAction}>
          <div className="tl-auth-form-heading">
            <span><KeyRound size={20} /></span>
            <div><p>Second step</p><h1>Verify it’s you</h1></div>
          </div>
          <p className="tl-auth-help">Enter the six-digit code from your authenticator app for <strong>{pending.email}</strong>.</p>
          {error && <div className="tl-alert tl-alert-danger" role="alert">{error === "rate-limited" ? "Too many attempts. Wait before trying again." : "That verification code was not accepted."}</div>}
          <input type="hidden" name="staffId" value={pending.id} />
          <label htmlFor="two-factor-code">Authenticator code</label>
          <input id="two-factor-code" className="tl-otp-input" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus />
          <button className="tl-button tl-button-primary tl-button-wide" type="submit"><ShieldCheck size={16} />Verify and continue</button>
          <p className="tl-auth-notice">You can also enter an unused recovery code.</p>
        </form>
      </section>
    </main>
  )
}
