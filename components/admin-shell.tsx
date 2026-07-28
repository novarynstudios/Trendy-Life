"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity, BadgePercent, Bell, Boxes, BriefcaseBusiness, Building2, ChevronDown,
  CircleHelp, CircleUserRound, ClipboardList, CreditCard, FileBarChart, FileText,
  Gauge, Headphones, KeyRound, LayoutDashboard, LockKeyhole, LogOut, Mail, Menu,
  PackagePlus, PanelLeftClose, ReceiptText, RotateCcw, Search, Settings, ShieldCheck,
  ShoppingCart, Store, Tags, Truck, UserPlus, Users, Warehouse, X,
} from "lucide-react"
import { staffLogoutAction } from "@/app/admin/auth-actions"

type NavigationItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> }
type NavigationGroup = { label: string; items: NavigationItem[] }

const navigation: NavigationGroup[] = [
  { label: "Workspace", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/search", label: "Global search", icon: Search },
  ] },
  { label: "Commerce", items: [
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/products", label: "Catalog", icon: Boxes },
    { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/invoices", label: "Invoices", icon: ReceiptText },
    { href: "/admin/fulfillment", label: "Fulfillment", icon: Truck },
    { href: "/admin/returns", label: "Returns", icon: RotateCcw },
  ] },
  { label: "Engagement", items: [
    { href: "/admin/marketing", label: "Marketing", icon: BadgePercent },
    { href: "/admin/reviews", label: "Reviews", icon: Tags },
    { href: "/admin/tickets", label: "Support", icon: Headphones },
    { href: "/admin/content", label: "Content", icon: FileText },
    { href: "/admin/communications", label: "Communications", icon: Mail },
  ] },
  { label: "Operations", items: [
    { href: "/admin/reports", label: "Reports", icon: FileBarChart },
    { href: "/admin/staff", label: "Staff & access", icon: BriefcaseBusiness },
    { href: "/admin/audit", label: "Audit log", icon: ShieldCheck },
    { href: "/admin/jobs", label: "Background jobs", icon: Activity },
    { href: "/admin/system/health", label: "System health", icon: Gauge },
    { href: "/admin/settings", label: "Configuration", icon: Settings },
  ] },
]

const topNavigation = [
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/products", label: "Catalog" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/tickets", label: "Support" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Configuration" },
]

export function AdminShell({
  admin,
  csrfToken,
  children,
}: {
  admin: { name: string; email: string; role?: string }
  csrfToken: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <div className={`tl-admin ${collapsed ? "is-collapsed" : ""}`}>
      <a className="skip-link" href="#admin-main">Skip to main content</a>
      {open && <button className="tl-admin-scrim" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <aside className={`tl-admin-sidebar ${open ? "is-open" : ""}`} aria-label="Primary administration">
        <div className="tl-admin-brand">
          <Link href="/admin" aria-label="Trendy Life admin dashboard">
            <Image src="/brand/logo-main.svg" alt="" width={132} height={34} priority />
            <span><strong>Admin</strong><small>Trendy Group</small></span>
          </Link>
          <button className="tl-icon-button tl-mobile-only" type="button" onClick={() => setOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <nav className="tl-admin-nav">
          {navigation.map((group) => (
            <section key={group.label}>
              <h2>{group.label}</h2>
              {group.items.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} onClick={() => setOpen(false)}>
                    <Icon size={17} aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </section>
          ))}
        </nav>
        <div className="tl-admin-sidebar-footer">
          <Link href="/" target="_blank"><Store size={17} aria-hidden /><span>View storefront</span></Link>
          <button type="button" onClick={() => setCollapsed((value) => !value)}><PanelLeftClose size={17} aria-hidden /><span>Collapse navigation</span></button>
        </div>
      </aside>

      <div className="tl-admin-workspace">
        <header className="tl-admin-header">
          <div className="tl-admin-header-main">
            <button className="tl-icon-button tl-menu-trigger" type="button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <Link className="tl-admin-mobile-brand" href="/admin"><Building2 size={20} /><strong>Trendy Life</strong></Link>
            <form className="tl-global-search" action="/admin/search" role="search">
              <Search size={16} aria-hidden />
              <label className="sr-only" htmlFor="global-admin-search">Search administration</label>
              <input id="global-admin-search" name="q" placeholder="Search orders, customers, products, tickets…" autoComplete="off" />
              <kbd>Ctrl K</kbd>
            </form>
            <div className="tl-header-actions">
              <details className="tl-dropdown">
                <summary className="tl-quick-add"><PackagePlus size={16} aria-hidden /><span>Quick add</span><ChevronDown size={14} aria-hidden /></summary>
                <div className="tl-dropdown-panel tl-quick-add-menu">
                  <Link href="/admin/orders/new"><ShoppingCart size={16} />Manual order</Link>
                  <Link href="/admin/customers/new"><UserPlus size={16} />Customer</Link>
                  <Link href="/admin/products/new"><PackagePlus size={16} />Product</Link>
                  <Link href="/admin/tickets/new"><CircleHelp size={16} />Support ticket</Link>
                </div>
              </details>
              <Link className="tl-icon-button has-indicator" href="/admin/jobs?status=FAILED" aria-label="Pending tasks"><ClipboardList size={18} /><span>3</span></Link>
              <Link className="tl-icon-button has-indicator" href="/admin/notifications" aria-label="Notifications"><Bell size={18} /><span>5</span></Link>
              <details className="tl-dropdown tl-profile-dropdown">
                <summary>
                  <span className="tl-avatar" aria-hidden>{admin.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                  <span className="tl-profile-copy"><strong>{admin.name}</strong><small>{admin.role ?? "Administrator"}</small></span>
                  <ChevronDown size={14} aria-hidden />
                </summary>
                <div className="tl-dropdown-panel">
                  <div className="tl-profile-summary"><strong>{admin.name}</strong><small>{admin.email}</small></div>
                  <Link href="/admin/account"><CircleUserRound size={16} />My account</Link>
                  <Link href="/admin/security"><KeyRound size={16} />Security settings</Link>
                  <Link href="/admin/lock"><LockKeyhole size={16} />Lock session</Link>
                  <form action={staffLogoutAction}>
                    <input type="hidden" name="_csrf" value={csrfToken} />
                    <button type="submit"><LogOut size={16} />Sign out</button>
                  </form>
                </div>
              </details>
            </div>
          </div>
          <nav className="tl-admin-topnav" aria-label="Administration sections">
            {topNavigation.map((item) => {
              const active = pathname.startsWith(item.href)
              return <Link key={item.href} href={item.href} className={active ? "is-active" : ""}>{item.label}</Link>
            })}
          </nav>
        </header>
        <main id="admin-main" className="tl-admin-main" tabIndex={-1}>{children}</main>
        <footer className="tl-admin-footer">
          <span>Trendy Life Admin</span>
          <span>Operated by Trendy Group</span>
          <nav><Link href="/admin/system/health">System status</Link><Link href="/admin/security">Security</Link><Link href="/admin/help">Help</Link></nav>
        </footer>
      </div>
    </div>
  )
}
