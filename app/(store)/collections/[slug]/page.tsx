import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ProductCard } from "@/components/product-card"
import { getCategories, getProducts } from "@/lib/db"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const category = getCategories().find((item) => item.slug === slug)
  return { title: category?.name || "Collection", description: category?.note }
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = getCategories().find((item) => item.slug === slug && item.active)
  if (!category) notFound()
  const products = getProducts({ category: category.name, status: "active" })
  return (
    <main id="main-content">
      <section className="collection-hero">
        <div className="container collection-hero-grid">
          <div><Link className="breadcrumb" href="/collections">Collections</Link><p className="eyebrow">{category.note}</p><h1 className="display">{category.name}</h1><p>{products.length} focused {products.length === 1 ? "option" : "options"} for a better-planned workplace.</p></div>
          <div className="collection-hero-image"><Image src={category.image} alt={`${category.name} collection`} fill priority sizes="(max-width: 800px) 100vw, 48vw" /></div>
        </div>
      </section>
      <section className="section surface-section">
        <div className="container">
          <div className="results-head"><strong>{products.length} products</strong><Link href="/shop">View all products</Link></div>
          <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        </div>
      </section>
    </main>
  )
}
