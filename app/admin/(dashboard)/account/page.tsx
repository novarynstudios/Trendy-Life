import { redirect } from "next/navigation"
import { requireStaff } from "@/src/server/auth/staff"
export default async function MyAccountPage() {
  const staff = await requireStaff()
  redirect(`/admin/staff/${staff.id}`)
}
