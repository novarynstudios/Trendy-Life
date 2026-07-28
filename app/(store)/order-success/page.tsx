import type { Metadata } from "next"
import Link from "next/link"
import { Check, ClipboardCheck, PackageCheck } from "lucide-react"
import { ClearCart } from "@/components/clear-cart"
import { getOrderByNumber } from "@/lib/db"
import { money } from "@/lib/format"

export const metadata: Metadata = { title: "Order received" }

export default async function OrderSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderNumber = "" } = await searchParams
  const order = getOrderByNumber(orderNumber)
  return (
    <main id="main-content" className="section success-page">
      <ClearCart />
      <div className="container success-card">
        <span className="success-icon"><Check /></span>
        <p className="eyebrow">Order received</p>
        <h1 className="display">Thank you. We’ll take it from here.</h1>
        <p>Your order has been saved. Our team will call to confirm the delivery details before dispatch.</p>
        {order && <div className="success-order"><div><span>Order number</span><strong>{order.orderNumber}</strong></div><div><span>Order total</span><strong>{money(order.total)}</strong></div><div><span>Payment</span><strong>{order.paymentMethod}</strong></div></div>}
        <div className="next-steps"><div><ClipboardCheck size={21} /><span><strong>1. Confirmation</strong><small>We verify your order by phone</small></span></div><div><PackageCheck size={21} /><span><strong>2. Dispatch</strong><small>You receive an update when it ships</small></span></div></div>
        <div className="success-actions"><Link className="button button-dark" href={`/track-order?order=${encodeURIComponent(orderNumber)}`}>Track this order</Link><Link className="button button-soft" href="/shop">Keep shopping</Link></div>
      </div>
    </main>
  )
}
