"use client"

import { useActionState } from "react"
import { verifyTwoFactorSetupAction, type TwoFactorSetupState } from "@/app/admin/(dashboard)/security/security-actions"

export function TwoFactorSetupForm({ csrfToken }: { csrfToken: string }) {
  const initial: TwoFactorSetupState = { ok: false }
  const [state, action, pending] = useActionState(verifyTwoFactorSetupAction, initial)
  if (state.ok && state.recoveryCodes) return <div className="tl-alert tl-alert-warning"><strong>Save these recovery codes now. They will not be shown again.</strong><div className="tl-recovery-codes">{state.recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div></div>
  return <form className="tl-compact-form" action={action}><input type="hidden" name="_csrf" value={csrfToken} />{state.error && <div className="tl-alert tl-alert-danger" role="alert">{state.error}</div>}<label>Six-digit authenticator code<input className="tl-otp-input" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label><button className="tl-button tl-button-primary tl-button-wide" type="submit" disabled={pending}>{pending ? "Verifying…" : "Verify and enable two-factor"}</button></form>
}
