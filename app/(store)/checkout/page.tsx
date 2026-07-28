import type { Metadata } from "next"
import { CheckoutForm } from "@/components/checkout-form"
import { getSettings } from "@/lib/db"
import { getCustomer } from "@/lib/auth"

export const metadata: Metadata = { title: "Checkout" }

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ error?: string; coupon?: string }> }) {
  const settings = getSettings()
  const params = await searchParams
  const customer = await getCustomer()
  return <main id="main-content" className="section checkout-page"><div className="container"><CheckoutForm shippingThreshold={settings.shippingThreshold} flatShipping={settings.flatShipping} customer={customer} error={params.error} initialCoupon={params.coupon} /></div></main>
}
