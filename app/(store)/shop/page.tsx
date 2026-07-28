import type { Metadata } from "next"
import Link from "next/link"
import { Search, SlidersHorizontal } from "lucide-react"
import { ProductCard } from "@/components/product-card"
import { getCategories, getProducts } from "@/lib/db"

export const metadata: Metadata = { title: "Shop" }

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const params = await searchParams
  const products = getProducts({ category: params.category, search: params.q, status: "active" })
  const categories = getCategories().filter((category) => category.active)
  return (
    <main id="main-content">
      <section className="page-hero compact">
        <div className="container">
          <p className="eyebrow">Furniture & finish catalog</p>
          <h1 className="display">Workplace pieces with purpose.</h1>
          <p>Explore desks, seating, storage, workstations and interior details selected for professional spaces.</p>
        </div>
      </section>
      <section className="section shop-section">
        <div className="container">
          <div className="shop-tools">
            <form className="search-form" action="/shop">
              <label className="sr-only" htmlFor="product-search">Search products</label>
              <Search size={18} />
              <input id="product-search" name="q" defaultValue={params.q} placeholder="Search furniture, finishes or SKU…" />
              <button className="button button-dark" type="submit">Search</button>
            </form>
            <div className="filter-label"><SlidersHorizontal size={17} /> Filter</div>
          </div>
          <nav className="filter-pills" aria-label="Product categories">
            <Link className={!params.category ? "active" : ""} href="/shop">All products</Link>
            {categories.map((category) => (
              <Link className={params.category?.toLowerCase() === category.name.toLowerCase() ? "active" : ""} key={category.slug} href={`/shop?category=${encodeURIComponent(category.name)}`}>
                {category.name}
              </Link>
            ))}
          </nav>
          <div className="results-head"><strong>{products.length} {products.length === 1 ? "product" : "products"}</strong>{params.q && <span>Matching “{params.q}”</span>}</div>
          {products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : (
            <div className="empty-state"><Search size={34} /><h2>No products found</h2><p>Try a broader search or view the full collection.</p><Link className="button button-dark" href="/shop">Clear filters</Link></div>
          )}
        </div>
      </section>
    </main>
  )
}
