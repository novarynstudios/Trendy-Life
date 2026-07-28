"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Headphones, LayoutDashboard, LogOut, Package, ShoppingBag, UserRound } from "lucide-react"
import { customerLogoutAction } from "@/app/actions"

const links = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders & invoices", icon: FileText },
  { href: "/account/tickets", label: "Support tickets", icon: Headphones },
  { href: "/account/profile", label: "My details", icon: UserRound },
]

export function AccountShell({ customer, children }: { customer: { name: string; email: string }; children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="client-portal">
      <aside className="client-sidebar">
        <Link className="client-logo" href="/"><Image src="/brand/logo-main.svg" alt="Trendy Life" width={180} height={45} /></Link>
        <div className="client-identity"><span>{customer.name.slice(0, 1).toUpperCase()}</span><div><strong>{customer.name}</strong><small>{customer.email}</small></div></div>
        <nav aria-label="Customer account">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/account" ? pathname === href : pathname.startsWith(href)
            return <Link className={active ? "active" : ""} href={href} key={href}><Icon /> {label}</Link>
          })}
        </nav>
        <div className="client-sidebar-foot">
          <Link href="/shop"><ShoppingBag /> Continue shopping</Link>
          <Link href="/track-order"><Package /> Track an order</Link>
          <form action={customerLogoutAction}><button type="submit"><LogOut /> Sign out</button></form>
        </div>
      </aside>
      <main className="client-main">{children}</main>
    </div>
  )
}
