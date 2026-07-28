import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Planning & order FAQs" }

const faqs = [
  ["How long does delivery take?", "In-stock accessories and seating can move quickly, while furniture and project items may require production or coordination time. We confirm a realistic schedule before processing your order."],
  ["Do you offer installation?", "Yes. Installation or assembly support is available for eligible furniture and project orders. The scope, site access and charge are confirmed before dispatch."],
  ["Can you help plan a full office?", "Yes. Share your floor plan, team size, timeline and priorities through the contact page. We can help shape a coordinated selection across workstations, seating, storage and finishes."],
  ["Can I request a quotation?", "Yes. Contact us with the products, quantities and delivery location. For larger orders, our team can prepare a project quotation and payment schedule."],
  ["Can I change or cancel my order?", "Contact us as soon as possible with your order number. We can usually change or cancel an order before it has been dispatched."],
  ["What is your return policy?", "Eligible unused standard items can be returned within 7 days of delivery. Made-to-order, installed or customized items are not normally returnable unless there is a confirmed defect."],
  ["How do I know my order was placed?", "You will see a confirmation page with a unique order number. Keep it to track the order or contact support."],
]

export default function FaqPage() {
  return (
    <main id="main-content">
      <section className="page-hero compact"><div className="container"><p className="eyebrow">Quick answers</p><h1 className="display">Before the order—or the project.</h1><p>Planning, quotations, delivery, installation and support in one place.</p></div></section>
      <section className="section"><div className="container faq-list">{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div><div className="container faq-cta"><p>Still need help?</p><Link className="button button-dark" href="/contact">Contact our team</Link></div></section>
    </main>
  )
}
