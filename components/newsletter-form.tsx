"use client"

import { useActionState } from "react"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { subscribeAction } from "@/app/actions"

const initialState = { ok: false, message: "" }

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeAction, initialState)
  if (state.ok) return <p className="form-success"><CheckCircle2 size={20} /> {state.message}</p>
  return (
    <form className="newsletter-form" action={action}>
      <label htmlFor="newsletter-email">Email address</label>
      <div>
        <input id="newsletter-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        <button className="button button-accent" disabled={pending} type="submit">
          {pending ? "Joining…" : "Join the edit"} <ArrowRight size={17} />
        </button>
      </div>
      {state.message && <p className="form-error" role="alert">{state.message}</p>}
    </form>
  )
}
