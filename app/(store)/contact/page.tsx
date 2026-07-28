import type { Metadata } from "next"
import { Clock3, Mail, MapPin, Phone } from "lucide-react"
import { ContactForm } from "@/components/contact-form"
import { getSettings } from "@/lib/db"

export const metadata: Metadata = { title: "Contact & project enquiries" }

export default function ContactPage() {
  const settings = getSettings()
  return (
    <main id="main-content">
      <section className="page-hero compact"><div className="container"><p className="eyebrow">Products, projects & support</p><h1 className="display">Tell us what the space needs.</h1><p>Ask about a product, share a workplace brief or get help with an existing order.</p></div></section>
      <section className="section">
        <div className="container contact-layout">
          <aside className="contact-aside">
            <h2 className="display">A useful answer starts with the right brief.</h2>
            <div className="contact-methods">
              <div><Mail /><span><strong>Email</strong><a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></span></div>
              <div><Phone /><span><strong>Phone</strong><a href={`tel:${settings.supportPhone}`}>{settings.supportPhone}</a></span></div>
              <div><MapPin /><span><strong>Based in</strong><small>{settings.address}</small></span></div>
              <div><Clock3 /><span><strong>Support hours</strong><small>Saturday–Thursday, 10am–7pm</small></span></div>
            </div>
          </aside>
          <ContactForm />
        </div>
      </section>
    </main>
  )
}
