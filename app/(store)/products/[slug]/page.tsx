import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BadgeCheck, Check, PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react"
import { AddToCart } from "@/components/add-to-cart"
import { ProductCard } from "@/components/product-card"
import { getProductBySlug, getProducts } from "@/lib/db"
import { money } from "@/lib/format"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = getProductBySlug(slug)
  return { title: product?.name || "Product", description: product?.description }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product || product.status !== "active") notFound()
  const related = getProducts({ category: product.category, status: "active", limit: 5 }).filter((item) => item.id !== product.id).slice(0, 4)
  return (
    <main id="main-content">
      <section className="product-detail section">
        <div className="container">
          <nav className="breadcrumbs"><Link href="/">Home</Link><span>/</span><Link href={`/collections/${product.category.toLowerCase()}`}>{product.category}</Link><span>/</span><span>{product.name}</span></nav>
          <div className="product-detail-grid">
            <div className="product-gallery">
              <div className="gallery-main"><Image src={product.image} alt={product.name} fill priority sizes="(max-width: 820px) 100vw, 50vw" /></div>
              <div className="gallery-secondary"><Image src={product.secondImage} alt={`${product.name}, alternate view`} fill sizes="(max-width: 820px) 100vw, 50vw" /></div>
            </div>
            <div className="product-summary">
              <p className="eyebrow">{product.category} · {product.sku}</p>
              <h1 className="display">{product.name}</h1>
              <div className="rating-line"><span><BadgeCheck size={15} /> Trendy selected</span><span>Designed for professional spaces</span></div>
              <div className="detail-price"><strong>{money(product.price)}</strong>{product.comparePrice && <del>{money(product.comparePrice)}</del>}</div>
              <p className="detail-description">{product.description}</p>
              <ul className="detail-list">
                <li><Check size={17} /> Commercial-grade materials and construction</li>
                <li><Check size={17} /> Quality checked before dispatch</li>
                <li><Check size={17} /> Planning support from our Bangladesh-based team</li>
              </ul>
              <div className={`stock-status ${product.inventory < 1 ? "out" : ""}`}>
                <span /> {product.inventory > 0 ? `${product.inventory} in stock and ready to ship` : "Currently out of stock"}
              </div>
              <AddToCart product={product} />
              <div className="service-grid">
                <div><Truck size={21} /><strong>Nationwide delivery</strong><span>Timing confirmed by product</span></div>
                <div><RotateCcw size={21} /><strong>7-day returns</strong><span>Simple return support</span></div>
                <div><ShieldCheck size={21} /><strong>Secure ordering</strong><span>Your details stay private</span></div>
                <div><PackageCheck size={21} /><strong>Installation support</strong><span>Available for project orders</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {related.length > 0 && <section className="section surface-section"><div className="container"><div className="section-heading"><div><p className="eyebrow">You may also like</p><h2 className="display">Keep exploring.</h2></div></div><div className="product-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></div></section>}
    </main>
  )
}
