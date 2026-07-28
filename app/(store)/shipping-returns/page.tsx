import type { Metadata } from "next"
import { getSettings } from "@/lib/db"
import { money } from "@/lib/format"

export const metadata: Metadata = { title: "Delivery & installation" }

export default function ShippingReturnsPage() {
  const settings = getSettings()
  return (
    <main id="main-content">
      <section className="page-hero compact"><div className="container"><p className="eyebrow">Delivery & installation</p><h1 className="display">Coordinated from our floor to yours.</h1><p>Furniture needs a little more planning than a parcel. We confirm timing, access and installation before it moves.</p></div></section>
      <section className="section"><div className="container policy-grid">
        <article><span>01</span><h2>Delivery cost</h2><p>Standard delivery is {money(settings.flatShipping)}. Orders at or above {money(settings.shippingThreshold)} qualify for free standard delivery; special handling is quoted separately.</p></article>
        <article><span>02</span><h2>Delivery timing</h2><p>In-stock and made-to-order items have different lead times. We confirm availability and a realistic delivery window before processing.</p></article>
        <article><span>03</span><h2>Site readiness</h2><p>Please tell us about floor level, lift access, loading restrictions and narrow entries. Clear access helps the team deliver safely and on schedule.</p></article>
        <article><span>04</span><h2>Installation</h2><p>Assembly and installation are available for eligible furniture and project orders. The agreed scope is confirmed with your quotation or order.</p></article>
        <article><span>05</span><h2>Damage or defects</h2><p>Inspect the item at handover and contact us within 24 hours with your order number and clear photos. We will review and arrange the right solution.</p></article>
        <article><span>06</span><h2>Returns</h2><p>Eligible unused standard items may be returned within 7 days. Customized, made-to-order or installed items are not normally returnable unless defective.</p></article>
      </div></section>
    </main>
  )
}
