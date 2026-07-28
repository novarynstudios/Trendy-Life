"use client"

import { useActionState } from "react"
import { CheckCircle2, Send } from "lucide-react"
import { contactAction } from "@/app/actions"

const initialState = { ok: false, message: "" }

export function ContactForm() {
  const [state, action, pending] = useActionState(contactAction, initialState)
  if (state.ok) return <div className="contact-success"><CheckCircle2 size={32} /><h2>We’ve got it.</h2><p>{state.message}</p></div>
  return (
    <form className="contact-form" action={action}>
      <div className="form-grid two">
        <label><span>Full name *</span><input name="name" autoComplete="name" required /></label>
        <label><span>Email address *</span><input name="email" type="email" autoComplete="email" required /></label>
      </div>
      <div className="form-grid two">
        <label><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" /></label>
        <label><span>How can we help? *</span><select name="subject" required defaultValue=""><option value="" disabled>Select a topic</option><option>Workspace project</option><option>Product question</option><option>Quotation request</option><option>Delivery or installation</option><option>Existing order support</option><option>Something else</option></select></label>
      </div>
      <label><span>Message *</span><textarea name="message" rows={6} minLength={10} required placeholder="Tell us what you need help with…" /></label>
      {state.message && <p className="form-error" role="alert">{state.message}</p>}
      <button className="button button-accent" disabled={pending} type="submit">{pending ? "Sending…" : <>Send message <Send size={16} /></>}</button>
    </form>
  )
}
