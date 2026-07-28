import type { Metadata } from "next"
import Link from "next/link"
import { Check, Circle, PackageSearch } from "lucide-react"
import { getOrderByNumber } from "@/lib/db"
import { formatDate, money } from "@/lib/format"

export const metadata: Metadata = { title: "Track order" }

const stages = ["pending", "confirmed", "processing", "shipped", "delivered"]

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<{ order?: string; phone?: string }> }) {
  const params = await searchParams
  const order = params.order && params.phone ? getOrderByNumber(params.order, params.phone) : undefined
  const attempted = Boolean(params.order && params.phone)
  const currentIndex = order ? stages.indexOf(order.status) : -1
  return (
    <main id="main-content">
      <section className="page-hero compact"><div className="container"><p className="eyebrow">Order tracking</p><h1 className="display">See where your order is.</h1><p>Enter the order number from your confirmation and the phone number used at checkout.</p></div></section>
      <section className="section"><div className="container track-shell">
        <form className="track-form" action="/track-order">
          <label><span>Order number</span><input name="order" defaultValue={params.order} placeholder="TL-260726-1234" required /></label>
          <label><span>Phone number</span><input name="phone" type="tel" defaultValue={params.phone} placeholder="01XXXXXXXXX" required /></label>
          <button className="button button-dark" type="submit"><PackageSearch size={17} /> Track order</button>
        </form>
        {attempted && !order && <div className="track-result not-found"><PackageSearch /><h2>We couldn’t find that order.</h2><p>Check both entries or <Link href="/contact">contact support</Link> for help.</p></div>}
        {order && <div className="track-result">
          <div className="track-head"><div><p className="eyebrow">Order {order.orderNumber}</p><h2>Hi {order.customerName}, here’s the latest.</h2></div><div><span>Total</span><strong>{money(order.total)}</strong></div></div>
          {order.status === "cancelled" ? <p className="cancelled-note">This order has been cancelled. Contact support if you need assistance.</p> : (
            <ol className="order-timeline">
              {stages.map((stage, index) => <li className={index <= currentIndex ? "done" : ""} key={stage}>{index <= currentIndex ? <Check /> : <Circle />}<span><strong>{stage[0].toUpperCase() + stage.slice(1)}</strong>{index === currentIndex && <small>Current status</small>}</span></li>)}
            </ol>
          )}
          <div className="track-meta"><span><small>Placed</small><strong>{formatDate(order.createdAt)}</strong></span><span><small>Delivery city</small><strong>{order.city}</strong></span><span><small>Payment</small><strong>{order.paymentMethod}</strong></span></div>
        </div>}
      </div></section>
    </main>
  )
}
