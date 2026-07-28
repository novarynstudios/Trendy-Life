import type { Metadata } from "next"
import { CartPage } from "@/components/cart-page"
import { getSettings } from "@/lib/db"

export const metadata: Metadata = { title: "Your bag" }

export default async function CartRoute({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const settings = getSettings()
  const params = await searchParams
  return <main id="main-content" className="section cart-page"><div className="container"><CartPage shippingThreshold={settings.shippingThreshold} flatShipping={settings.flatShipping} error={params.error} /></div></main>
}
