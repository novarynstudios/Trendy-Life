import Image from "next/image"
import Link from "next/link"
import type { SiteSettings } from "@/lib/types"
import { NewsletterForm } from "@/components/newsletter-form"

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <>
      <section className="newsletter-band">
        <div className="container newsletter-grid">
          <div>
            <p className="eyebrow">The Trendy edit</p>
            <h2 className="display">Better spaces, without the guesswork.</h2>
            <p>New furniture, workplace ideas and practical project guidance—sent occasionally.</p>
          </div>
          <NewsletterForm />
        </div>
      </section>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <span className="footer-logo">
              <Image
                src="/brand/trendy-life-footer.png"
                alt={`${settings.storeName} logo`}
                width={1175}
                height={596}
                sizes="(max-width: 620px) 180px, 220px"
              />
            </span>
            <p>Furniture and interior solutions for workplaces that are built to perform.</p>
          </div>
          <FooterColumn title="Explore" links={[["All furniture", "/shop"], ["Collections", "/collections"], ["Workspace solutions", "/solutions"], ["Track order", "/track-order"]]} />
          <FooterColumn title="Support" links={[["Customer account", "/account"], ["Contact us", "/contact"], ["Delivery & installation", "/shipping-returns"], ["FAQs", "/faq"]]} />
          <FooterColumn title="Company" links={[["About Trendy Life", "/about"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Admin", "/admin"]]} />
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</span>
          <span>{settings.supportEmail} · {settings.supportPhone}</span>
        </div>
      </footer>
    </>
  )
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="footer-links">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
    </div>
  )
}
