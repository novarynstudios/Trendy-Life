import { AdminShell } from "@/components/admin-shell"
import { redirect } from "next/navigation"
import { getCsrfToken, getStaffPrincipal } from "@/src/server/auth/staff"

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const [admin, csrfToken] = await Promise.all([getStaffPrincipal(), getCsrfToken()])
  if (!admin) redirect("/admin/login")
  return <AdminShell admin={admin} csrfToken={csrfToken}>{children}</AdminShell>
}
