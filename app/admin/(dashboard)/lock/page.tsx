import { LockKeyhole } from "lucide-react"
import { lockCurrentStaffSession, getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { redirect } from "next/navigation"

async function lockAction(formData: FormData) {
  "use server"
  const { assertCsrf } = await import("@/src/server/auth/staff")
  await assertCsrf(formData)
  await lockCurrentStaffSession()
  redirect("/admin/login?locked=1")
}
export default async function LockPage() {
  const staff = await requireStaff()
  const csrfToken = await getCsrfToken()
  return <section className="tl-card tl-lock-card"><LockKeyhole size={38} /><h1>Lock administrative session?</h1><p>This immediately invalidates access on this device. Sign in again to continue as {staff.name}.</p><form action={lockAction}><input type="hidden" name="_csrf" value={csrfToken} /><button className="tl-button tl-button-primary" type="submit">Lock now</button></form></section>
}
