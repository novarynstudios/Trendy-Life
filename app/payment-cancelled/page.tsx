import Link from "next/link"
import { CreditCard, RotateCcw } from "lucide-react"

export default async function PaymentCancelledPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams
  return <main className="section payment-cancelled-page"><div className="container payment-cancelled-card"><CreditCard /><p className="eyebrow">Payment not completed</p><h1 className="display">Your order is saved, but it is still unpaid.</h1><p>{order ? `Order ${order} remains in your account.` : "No charge was completed."} You can contact support or place the order again with another method.</p><div><Link className="button button-accent" href="/account/orders">View account</Link><Link className="button button-soft" href="/checkout"><RotateCcw /> Return to checkout</Link></div></div></main>
}
