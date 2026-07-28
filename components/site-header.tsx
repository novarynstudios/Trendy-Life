"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react"
import { useCart } from "@/components/cart-provider"

const links = [
  { href: "/shop", label: "Furniture" },
  { href: "/collections", label: "Collections" },
  { href: "/solutions", label: "Solutions" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
]

export function SiteHeader({ announcement }: { announcement: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const reduced = useReducedMotion()
  const { count } = useCart()

  return (
    <>
      <div className="announcement">{announcement}</div>
      <header className="site-header">
        <div className="container site-nav">
          <Link href="/" className="brand" aria-label="Trendy Life home">
            <Image src="/brand/logo-main.svg" alt="Trendy Life" width={181} height={45} priority />
          </Link>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {links.map((link) => <Link className={pathname.startsWith(link.href) ? "active" : ""} key={link.href} href={link.href}>{link.label}</Link>)}
          </nav>
          <div className="nav-actions">
            <Link className="icon-button nav-search" href="/shop" aria-label="Search products"><Search size={19} /></Link>
            <Link className="icon-button nav-account" href="/account" aria-label="Customer account"><UserRound size={19} /></Link>
            <Link className="icon-button" href="/cart" aria-label={`Shopping bag with ${count} items`}>
              <ShoppingBag size={19} />
              {count > 0 && <span className="cart-count">{count}</span>}
            </Link>
            <button className="icon-button menu-button" type="button" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          </div>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation menu" initial={reduced ? false : { x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
            <div className="mobile-menu-head">
              <Link href="/" className="brand" onClick={() => setOpen(false)}><Image src="/brand/logo-main.svg" alt="Trendy Life" width={181} height={45} /></Link>
              <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
            </div>
            <nav className="mobile-menu-links">
              {links.map((link, index) => (
                <motion.div key={link.href} initial={reduced ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .05 }}>
                  <Link className={pathname.startsWith(link.href) ? "active" : ""} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
                </motion.div>
              ))}
              <Link className="button button-accent" href="/account" onClick={() => setOpen(false)}>Customer account</Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
