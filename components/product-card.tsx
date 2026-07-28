"use client"

import Image from "next/image"
import Link from "next/link"
import { Heart, PackageCheck, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useCart } from "@/components/cart-provider"
import { money } from "@/lib/format"
import type { Product } from "@/lib/types"

export function ProductCard({ product }: { product: Product }) {
  const [saved, setSaved] = useState(false)
  const [added, setAdded] = useState(false)
  const { addItem } = useCart()
  const reduced = useReducedMotion()

  useEffect(() => {
    try {
      const savedItems = JSON.parse(window.localStorage.getItem("trendy-life-saved-products") ?? "[]") as number[]
      setSaved(savedItems.includes(product.id))
    } catch {
      window.localStorage.removeItem("trendy-life-saved-products")
    }
  }, [product.id])

  function toggleSaved() {
    setSaved((current) => {
      try {
        const savedItems = JSON.parse(window.localStorage.getItem("trendy-life-saved-products") ?? "[]") as number[]
        const next = current ? savedItems.filter((id) => id !== product.id) : [...new Set([...savedItems, product.id])]
        window.localStorage.setItem("trendy-life-saved-products", JSON.stringify(next))
      } catch {
        // The preference is optional; the visual state still updates when storage is unavailable.
      }
      return !current
    })
  }

  function add() {
    addItem(product)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1800)
  }

  return (
    <motion.article className="product-card" initial={reduced ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: .45 }}>
      <div className="product-media">
        <Link href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
          <Image className="primary-image" src={product.image} alt={product.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 25vw" />
          <Image className="secondary-image" src={product.secondImage} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 25vw" />
        </Link>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button className="round-action save-action" type="button" aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name}`} onClick={toggleSaved}>
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <button className="quick-add" type="button" onClick={add} disabled={product.inventory < 1}>
          {product.inventory < 1 ? "Sold out" : added ? "Added to bag" : <><Plus size={16} /> Quick add</>}
        </button>
      </div>
      <div className="product-info">
        <div className="product-kicker"><span>{product.category}</span><span><PackageCheck size={12} /> {product.inventory > 0 ? "Available" : "Sold out"}</span></div>
        <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
        <div className="product-price"><strong>{money(product.price)}</strong>{product.comparePrice && <del>{money(product.comparePrice)}</del>}</div>
      </div>
    </motion.article>
  )
}
