import Link from "next/link"
import { ArrowLeft, Send } from "lucide-react"
import { createTicketAction } from "@/app/actions"

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <>
    <header className="client-page-head"><div><Link className="client-back" href="/account/tickets"><ArrowLeft /> Support tickets</Link><h1>Open a ticket</h1><p>Give the team enough context to start with a useful answer.</p></div></header>
    <form className="client-card client-profile-form" action={createTicketAction}>
      {error && <p className="auth-error">Add a subject and at least 10 characters of detail.</p>}
      <label><span>Subject</span><input name="subject" required /></label>
      <div className="form-grid two"><label><span>Department</span><select name="department"><option>General</option><option>Orders</option><option>Billing</option><option>Delivery & installation</option><option>Projects</option></select></label><label><span>Priority</span><select name="priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
      <label><span>How can we help?</span><textarea name="message" rows={8} minLength={10} required /></label>
      <button className="button button-accent" type="submit">Submit ticket <Send /></button>
    </form>
  </>
}
