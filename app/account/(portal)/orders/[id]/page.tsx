import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, MapPin } from "lucide-react"
import { notFound } from "next/navigation"
import { requireCustomer } from "@/lib/auth"
import { getCustomerOrderById, getOrderItems } from "@/lib/db"
import { formatDateTime, money } from "@/lib/format"

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await requireCustomer()
  const { id } = await params
  const order = getCustomerOrderById(customer.id, Number(id))
  if (!order) notFound()
  const items = getOrderItems(order.id)
  return <>
    <header className="client-page-head"><div><Link className="client-back" href="/account/orders"><ArrowLeft /> Orders & invoices</Link><h1>Invoice {order.orderNumber}</h1><p>Created {formatDateTime(order.createdAt)}</p></div><div className="client-head-badges"><span className={`status-badge large ${order.status}`}>{order.status}</span><span className={`status-badge large ${order.paymentStatus}`}>{order.paymentStatus}</span></div></header>
    <div className="client-order-grid">
      <section className="client-card"><div className="client-card-head"><div><h2>Invoice items</h2><p>{items.reduce((sum, item) => sum + item.quantity, 0)} units</p></div></div><div className="client-order-items">{items.map((item) => <div key={item.id}><span><Image src={item.image} alt="" fill sizes="56px" /></span><div><strong>{item.name}</strong><small>{item.sku} · Qty {item.quantity}</small></div><b>{money(item.price * item.quantity)}</b></div>)}</div><dl className="invoice-totals"><div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div><div><dt>Delivery</dt><dd>{order.shipping ? money(order.shipping) : "Free"}</dd></div>{order.discountAmount > 0 && <div><dt>Discount {order.discountCode && `(${order.discountCode})`}</dt><dd>−{money(order.discountAmount)}</dd></div>}<div><dt>Total</dt><dd>{money(order.total)}</dd></div></dl></section>
      <aside className="client-card client-order-aside"><h2>Delivery & payment</h2><div><MapPin /><span><small>Deliver to</small><strong>{order.address}, {order.city}</strong></span></div><dl><div><dt>Payment method</dt><dd>{order.paymentMethod}</dd></div><div><dt>Transaction</dt><dd>{order.paymentTransactionId || "Not available"}</dd></div></dl><Link className="button button-dark button-wide" href={`/track-order?order=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.phone)}`}>Track order</Link></aside>
    </div>
  </>
}
