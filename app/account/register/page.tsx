import Image from "next/image"
import Link from "next/link"
import { customerRegisterAction } from "@/app/actions"

export default async function CustomerRegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <main className="customer-auth-page">
    <section className="customer-auth-brand"><Link href="/"><Image src="/brand/logo-main.svg" alt="Trendy Life" width={220} height={55} /></Link><div><p className="eyebrow">Customer portal</p><h1 className="display">A simpler way to manage every order.</h1><p>See invoices, payment status, delivery progress and support conversations from one secure account.</p></div></section>
    <section className="customer-auth-form-wrap"><form className="customer-auth-form" action={customerRegisterAction}>
      <p className="eyebrow">Create account</p><h2>Start your client profile</h2>
      {error && <p className="auth-error" role="alert">Complete every field, use matching passwords and choose at least 8 characters.</p>}
      <label><span>Full name</span><input name="name" autoComplete="name" required /></label>
      <label><span>Email address</span><input name="email" type="email" autoComplete="email" required /></label>
      <label><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" /></label>
      <div className="form-grid two"><label><span>Password</span><input name="password" type="password" minLength={8} autoComplete="new-password" required /></label><label><span>Confirm password</span><input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></label></div>
      <button className="button button-accent button-wide" type="submit">Create account</button>
      <p>Already registered? <Link href="/account/login">Sign in</Link></p>
    </form></section>
  </main>
}
