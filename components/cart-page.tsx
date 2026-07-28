"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { money } from "@/lib/format"

export function CartPage({ shippingThreshold, flatShipping, error }: { shippingThreshold: number; flatShipping: number; error?: string }) {
  const { items, subtotal, updateQuantity, removeItem } = useCart()
  const shipping = subtotal >= shippingThreshold ? 0 : flatShipping

  if (!items.length) {
    return (
      <div className="empty-state cart-empty">
        <ShoppingBag size={38} />
        <h1 className="display">Your bag is ready for something good.</h1>
        <p>Explore the collection and add the pieces that will make your workplace work better.</p>
        <Link className="button button-dark" href="/shop">Start shopping <ArrowRight size={17} /></Link>
      </div>
    )
  }

  return (
    <div className="cart-layout">
      <div className="cart-lines">
        {error && <div className="checkout-error" role="alert">
          {error === "stock" ? "One or more items are no longer available in the requested quantity. Please remove it or adjust the quantity before checkout." : error === "invalid-cart" ? "Your cart could not be verified. Please remove the affected item and add it again." : "Your cart needs attention before checkout."}
        </div>}
        {items.map(({ product, quantity }) => (
          <article className="cart-line" key={product.id}>
            <Link className="cart-line-image" href={`/products/${product.slug}`}><Image src={product.image} alt="" fill sizes="120px" /></Link>
            <div className="cart-line-copy">
              <span>{product.category}</span>
              <h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2>
              <strong>{money(product.price)}</strong>
              <div className="quantity-control">
                <button type="button" aria-label={`Decrease ${product.name} quantity`} onClick={() => updateQuantity(product.id, quantity - 1)}><Minus size={15} /></button>
                <span aria-live="polite">{quantity}</span>
                <button type="button" aria-label={`Increase ${product.name} quantity`} onClick={() => updateQuantity(product.id, quantity + 1)}><Plus size={15} /></button>
              </div>
            </div>
            <div className="cart-line-total">
              <strong>{money(product.price * quantity)}</strong>
              <button type="button" onClick={() => removeItem(product.id)}><Trash2 size={16} /> Remove</button>
            </div>
          </article>
        ))}
      </div>
      <aside className="order-summary">
        <p className="eyebrow">Order summary</p>
        <h2>Ready when you are.</h2>
        <dl>
          <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd>{shipping === 0 ? "Free" : money(shipping)}</dd></div>
          <div className="summary-total"><dt>Total</dt><dd>{money(subtotal + shipping)}</dd></div>
        </dl>
        {subtotal < shippingThreshold && <p className="shipping-note">Add {money(shippingThreshold - subtotal)} more for free delivery.</p>}
        <Link className="button button-accent button-wide" href="/checkout">Continue to checkout <ArrowRight size={17} /></Link>
        <Link className="text-link centered" href="/shop">Continue shopping</Link>
      </aside>
    </div>
  )
}
