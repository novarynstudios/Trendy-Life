import Link from "next/link"
import { Package } from "lucide-react"
import { requireCustomer } from "@/lib/auth"
import { getCustomerOrders } from "@/lib/db"
import { formatDate, money } from "@/lib/format"

export default async function CustomerOrdersPage() {
  const customer = await requireCustomer()
  const orders = getCustomerOrders(customer.id)
  return <>
    <header className="client-page-head"><div><p className="eyebrow">Billing</p><h1>Orders & invoices</h1><p>Review totals, payment state and fulfilment progress.</p></div></header>
    <section className="client-card">
      {orders.length ? <div className="client-table-wrap"><table className="client-table"><thead><tr><th>Order</th><th>Placed</th><th>Fulfilment</th><th>Payment</th><th>Method</th><th>Total</th><th></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.orderNumber}</strong></td><td>{formatDate(order.createdAt)}</td><td><span className={`status-badge ${order.status}`}>{order.status}</span></td><td><span className={`status-badge ${order.paymentStatus}`}>{order.paymentStatus}</span></td><td>{order.paymentMethod}</td><td><strong>{money(order.total)}</strong></td><td><Link href={`/account/orders/${order.id}`}>View invoice</Link></td></tr>)}</tbody></table></div> : <div className="client-empty"><Package /><h3>No orders yet</h3><p>Completed checkouts will appear here.</p><Link href="/shop">Start shopping</Link></div>}
    </section>
  </>
}
