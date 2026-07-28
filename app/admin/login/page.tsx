import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"
import { redirect } from "next/navigation"
import { staffLoginAction } from "@/app/admin/auth-actions"
import { getStaffPrincipal } from "@/src/server/auth/staff"

export const metadata: Metadata = { title: "Staff sign in | Trendy Life Admin" }

const errorMessages: Record<string, string> = {
  "invalid-input": "Enter a valid email address and password.",
  invalid: "The credentials are incorrect or the account is temporarily protected.",
  "rate-limited": "Too many attempts. Wait a few minutes and try again.",
  "session-expired": "Your verification session expired. Sign in again.",
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getStaffPrincipal()) redirect("/admin")
  const { error } = await searchParams
  return (
    <main className="tl-auth-page">
      <section className="tl-auth-brand">
        <Link href="/" className="tl-auth-logo">
          <Image src="/brand/logo-main.svg" alt="Trendy Life" width={168} height={44} priority />
          <span>Administration</span>
        </Link>
        <div>
          <p className="tl-auth-eyebrow">Trendy Group commerce operations</p>
          <h1>One secure workspace for every store operation.</h1>
          <p>Manage orders, customers, catalog, inventory, payments, support, content, staff, and reporting from one accountable control desk.</p>
        </div>
        <ul>
          <li><ShieldCheck size={17} />Server-side sessions and granular access controls</li>
          <li><LockKeyhole size={17} />Two-factor verification for privileged accounts</li>
        </ul>
      </section>
      <section className="tl-auth-form-area">
        <form className="tl-auth-form" action={staffLoginAction}>
          <div className="tl-auth-form-heading">
            <span><LockKeyhole size={20} /></span>
            <div><p>Staff access</p><h2>Sign in to Trendy Life Admin</h2></div>
          </div>
          <p className="tl-auth-help">Use your assigned staff credentials. Access is monitored and recorded.</p>
          {error && <div className="tl-alert tl-alert-danger" role="alert">{errorMessages[error] ?? errorMessages.invalid}</div>}
          <label htmlFor="admin-email">Email address</label>
          <input id="admin-email" name="email" type="email" inputMode="email" autoComplete="username" required autoFocus />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
          <div className="tl-auth-options"><label><input type="checkbox" name="rememberDevice" /> Remember this device</label><Link href="/admin/forgot-password">Forgot password?</Link></div>
          <button className="tl-button tl-button-primary tl-button-wide" type="submit">Continue securely <ArrowRight size={16} /></button>
          <p className="tl-auth-notice">Unauthorized access is prohibited. Login attempts and administrative actions are audited.</p>
        </form>
      </section>
    </main>
  )
}
