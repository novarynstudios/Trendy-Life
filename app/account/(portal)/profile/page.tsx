import { Save } from "lucide-react"
import { updateCustomerProfileAction } from "@/app/actions"
import { requireCustomer } from "@/lib/auth"

export default async function CustomerProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const customer = await requireCustomer()
  const { saved } = await searchParams
  return <>
    <header className="client-page-head"><div><p className="eyebrow">Account</p><h1>My details</h1><p>Keep your contact and default delivery information current.</p></div></header>
    {saved && <div className="client-alert success">Your profile has been updated.</div>}
    <form className="client-card client-profile-form" action={updateCustomerProfileAction}>
      <div className="client-card-head"><div><h2>Profile information</h2><p>Your email address is used as the secure account identifier.</p></div></div>
      <div className="form-grid two"><label><span>Full name</span><input name="name" defaultValue={customer.name} required /></label><label><span>Email address</span><input value={customer.email} readOnly /></label></div>
      <div className="form-grid two"><label><span>Phone</span><input name="phone" type="tel" defaultValue={customer.phone} /></label><label><span>Company</span><input name="company" defaultValue={customer.company} /></label></div>
      <label><span>Default address</span><textarea name="address" rows={3} defaultValue={customer.address} /></label>
      <label><span>City / district</span><input name="city" defaultValue={customer.city} /></label>
      <button className="button button-accent" type="submit"><Save /> Save details</button>
    </form>
  </>
}
