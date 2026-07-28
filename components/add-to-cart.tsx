"use client"

import { useState } from "react"
import { Check, ShoppingBag } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import type { Product } from "@/lib/types"

export function AddToCart({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const { addItem } = useCart()

  function add() {
    addItem(product, quantity)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="purchase-actions">
      <label>
        <span>Quantity</span>
        <select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
          {Array.from({ length: Math.min(10, product.inventory) }, (_, index) => index + 1).map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
      </label>
      <button className="button button-accent button-wide" type="button" onClick={add} disabled={product.inventory < 1}>
        {product.inventory < 1 ? "Currently sold out" : added ? <><Check size={18} /> Added to bag</> : <><ShoppingBag size={18} /> Add to bag</>}
      </button>
    </div>
  )
}
