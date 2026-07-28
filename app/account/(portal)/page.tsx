import Link from "next/link"
import { ArrowRight, CreditCard, Headphones, PackageCheck, ReceiptText } from "lucide-react"
import { requireCustomer } from "@/lib/auth"
import { getCustomerOrders, getCustomerTickets } from "@/lib/db"
import { formatDate, money } from "@/lib/format"

export default async function AccountDashboardPage() {
  const customer = await requireCustomer()
  const orders = getCustomerOrders(customer.id)
  const tickets = getCustomerTickets(customer.id)
  const unpaid = orders.filter((order) => order.paymentStatus !== "paid")
  return <>
    <header className="client-page-head"><div><p className="eyebrow">Client area</p><h1>Welcome back, {customer.name.split(" ")[0]}.</h1><p>Here is the current picture across your orders and support.</p></div><Link className="button button-accent" href="/shop">New order <ArrowRight /></Link></header>
    <section className="client-stat-grid">
      <article><PackageCheck /><span><small>Total orders</small><strong>{orders.length}</strong></span></article>
      <article><CreditCard /><span><small>Unpaid invoices</small><strong>{unpaid.length}</strong></span></article>
      <article><Headphones /><span><small>Open tickets</small><strong>{tickets.filter((ticket) => ticket.status !== "closed").length}</strong></span></article>
      <article><ReceiptText /><span><small>Total billed</small><strong>{money(orders.reduce((sum, order) => sum + order.total, 0))}</strong></span></article>
    </section>
    <section className="client-card">
      <div className="client-card-head"><div><h2>Recent orders</h2><p>Your latest purchases and payment status.</p></div><Link href="/account/orders">View all <ArrowRight /></Link></div>
      {orders.length ? <div className="client-table-wrap"><table className="client-table"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Payment</th><th>Total</th><th></th></tr></thead><tbody>{orders.slice(0, 5).map((order) => <tr key={order.id}><td><strong>{order.orderNumber}</strong></td><td>{formatDate(order.createdAt)}</td><td><span className={`status-badge ${order.status}`}>{order.status}</span></td><td><span className={`status-badge ${order.paymentStatus}`}>{order.paymentStatus}</span></td><td><strong>{money(order.total)}</strong></td><td><Link href={`/account/orders/${order.id}`}>Open</Link></td></tr>)}</tbody></table></div> : <div className="client-empty"><PackageCheck /><h3>No orders yet</h3><p>Your first order will appear here.</p><Link href="/shop">Browse furniture</Link></div>}
    </section>
  </>
}
