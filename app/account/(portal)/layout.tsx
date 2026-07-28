import { AccountShell } from "@/components/account-shell"
import { requireCustomer } from "@/lib/auth"

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const customer = await requireCustomer()
  return <AccountShell customer={customer}>{children}</AccountShell>
}
