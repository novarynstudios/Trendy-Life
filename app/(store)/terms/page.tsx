import type { Metadata } from "next"

export const metadata: Metadata = { title: "Terms & conditions" }

export default function TermsPage() {
  return (
    <main id="main-content">
      <section className="page-hero compact"><div className="container"><p className="eyebrow">Legal</p><h1 className="display">Terms & conditions</h1><p>Last updated 26 July 2026</p></div></section>
      <article className="container legal-content">
        <h2>Using this store</h2><p>By using Trendy Life, you agree to provide accurate information, use the website lawfully and avoid activities that disrupt the service or harm other customers.</p>
        <h2>Products and pricing</h2><p>We work to keep product information, availability and prices accurate. If a material error affects an order, we will contact you before dispatch and offer a correction or cancellation.</p>
        <h2>Orders</h2><p>An order is a request to purchase. We may confirm it by phone and reserve the right to cancel orders that cannot be verified, contain inaccurate details or involve unavailable stock.</p>
        <h2>Delivery and returns</h2><p>Delivery estimates are not guarantees and can be affected by couriers, weather or location. Returns are governed by our delivery and returns policy.</p>
        <h2>Liability</h2><p>To the extent allowed by law, Trendy Life is not responsible for indirect loss arising from use of the store. Nothing in these terms limits rights that cannot legally be limited.</p>
        <h2>Changes</h2><p>We may update these terms as the store evolves. The date above shows the most recent revision.</p>
      </article>
    </main>
  )
}
