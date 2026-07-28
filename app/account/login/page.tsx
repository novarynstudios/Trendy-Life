import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { customerLoginAction } from "@/app/actions"
import { getCustomer } from "@/lib/auth"

export default async function CustomerLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (await getCustomer()) redirect("/account")
  const params = await searchParams
  return <main className="customer-auth-page">
    <section className="customer-auth-brand"><Link href="/"><Image src="/brand/logo-main.svg" alt="Trendy Life" width={220} height={55} /></Link><div><p className="eyebrow">Customer portal</p><h1 className="display">Orders, invoices and support in one place.</h1><p>Manage your Trendy Life account with the clarity of a dedicated client desk.</p></div></section>
    <section className="customer-auth-form-wrap"><form className="customer-auth-form" action={customerLoginAction}>
      <p className="eyebrow">Welcome back</p><h2>Sign in to your account</h2>
      {params.error && <p className="auth-error" role="alert">{params.error === "exists" ? "This email already has an account. Sign in below." : "The email or password is incorrect."}</p>}
      <input type="hidden" name="next" value={params.next || "/account"} />
      <label><span>Email address</span><input name="email" type="email" autoComplete="email" required /></label>
      <label><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="button button-accent button-wide" type="submit">Sign in</button>
      <p>New to Trendy Life? <Link href="/account/register">Create an account</Link></p>
    </form></section>
  </main>
}
