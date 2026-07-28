"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, BadgePercent, Banknote, CreditCard, LockKeyhole, ShoppingBag } from "lucide-react"
import { useState } from "react"
import { placeOrderAction } from "@/app/actions"
import { useCart } from "@/components/cart-provider"
import { money } from "@/lib/format"

type CheckoutCustomer = { name: string; email: string; phone: string; address: string; city: string } | null | undefined

export function CheckoutForm({ shippingThreshold, flatShipping, customer, error, initialCoupon = "" }: {
  shippingThreshold: number
  flatShipping: number
  customer?: CheckoutCustomer
  error?: string
  initialCoupon?: string
}) {
  const { items, subtotal } = useCart()
  const [coupon, setCoupon] = useState(initialCoupon)
  const [couponMessage, setCouponMessage] = useState("")
  const [discount, setDiscount] = useState(0)
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const shipping = subtotal >= shippingThreshold ? 0 : flatShipping
  const serialized = JSON.stringify(items.map((item) => ({ id: item.product.id, quantity: item.quantity })))

  async function applyCoupon() {
    setCheckingCoupon(true)
    try {
      const response = await fetch(`/api/coupons/validate?code=${encodeURIComponent(coupon)}&subtotal=${subtotal}`)
      const result = await response.json() as { valid: boolean; discount?: number; message: string; code?: string }
      setCouponMessage(result.message)
      setDiscount(result.valid ? Number(result.discount || 0) : 0)
      if (result.code) setCoupon(result.code)
    } finally {
      setCheckingCoupon(false)
    }
  }

  if (!items.length) {
    return (
      <div className="empty-state cart-empty">
        <ShoppingBag size={36} />
        <h1 className="display">Your bag is empty.</h1>
        <p>Add something before heading to checkout.</p>
        <Link className="button button-dark" href="/shop">Browse products</Link>
      </div>
    )
  }

  return (
    <form className="checkout-layout" action={placeOrderAction}>
      <input type="hidden" name="items" value={serialized} />
      <div className="checkout-form">
        <Link className="breadcrumb" href="/cart"><ArrowLeft size={15} /> Back to bag</Link>
        <p className="eyebrow">Secure checkout</p>
        <h1 className="display">Where should we send it?</h1>
        <p className="checkout-intro">Complete your delivery details. We’ll confirm your order by phone before dispatch.</p>
        {error && <div className="checkout-error" role="alert">
          {error === "gateway" ? "Online payment could not be started. Try again or choose the other payment gateway." : "Please review the checkout details and try again."}
        </div>}

        <fieldset>
          <legend>Contact information</legend>
          <div className="form-grid two">
            <label><span>Full name *</span><input name="name" autoComplete="name" defaultValue={customer?.name} required /></label>
            <label><span>Phone number *</span><input name="phone" type="tel" autoComplete="tel" defaultValue={customer?.phone} placeholder="01XXXXXXXXX" required /></label>
          </div>
          <label><span>Email address *</span><input name="email" type="email" autoComplete="email" defaultValue={customer?.email} required /></label>
        </fieldset>

        <fieldset>
          <legend>Delivery address</legend>
          <label><span>Street address *</span><textarea name="address" autoComplete="street-address" rows={3} defaultValue={customer?.address} required /></label>
          <div className="form-grid two">
            <label><span>City / district *</span><input name="city" autoComplete="address-level2" defaultValue={customer?.city} required /></label>
            <label><span>Delivery note</span><input name="notes" placeholder="Landmark or preferred time" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Payment</legend>
          <label className="radio-card">
            <input name="paymentMethod" type="radio" value="SSLCommerz" defaultChecked />
            <CreditCard />
            <span><strong>Pay with SSLCommerz</strong><small>Secure online payment in Bangladeshi taka</small></span>
          </label>
          <label className="radio-card">
            <input name="paymentMethod" type="radio" value="UddoktaPay" />
            <CreditCard />
            <span><strong>Pay with UddoktaPay</strong><small>Use the payment methods enabled in your UddoktaPay account</small></span>
          </label>
          <label className="radio-card">
            <input name="paymentMethod" type="radio" value="Cash on delivery" />
            <Banknote />
            <span><strong>Cash on delivery</strong><small>Pay in cash when your order is delivered</small></span>
          </label>
        </fieldset>
      </div>

      <aside className="checkout-summary">
        <h2>Your order</h2>
        <div className="checkout-items">
          {items.map(({ product, quantity }) => (
            <div key={product.id}>
              <span className="checkout-thumb"><Image src={product.image} alt="" fill sizes="64px" /><b>{quantity}</b></span>
              <span><strong>{product.name}</strong><small>{product.category}</small></span>
              <strong>{money(product.price * quantity)}</strong>
            </div>
          ))}
        </div>
        <div className="coupon-box">
          <label htmlFor="coupon-code"><BadgePercent /> Discount code</label>
          <div><input id="coupon-code" name="couponCode" value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="Enter code" /><button type="button" onClick={applyCoupon} disabled={!coupon || checkingCoupon}>{checkingCoupon ? "Checking…" : "Apply"}</button></div>
          {couponMessage && <p className={discount ? "coupon-success" : "form-error"} aria-live="polite">{couponMessage}</p>}
        </div>
        <dl>
          <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd>{shipping === 0 ? "Free" : money(shipping)}</dd></div>
          {discount > 0 && <div className="discount-line"><dt>Discount</dt><dd>−{money(discount)}</dd></div>}
          <div className="summary-total"><dt>Total</dt><dd>{money(subtotal + shipping - discount)}</dd></div>
        </dl>
        <button className="button button-accent button-wide" type="submit"><LockKeyhole size={17} /> Place order</button>
        <p className="secure-note"><LockKeyhole size={13} /> Your details are encrypted in transit and never sold.</p>
      </aside>
    </form>
  )
}
