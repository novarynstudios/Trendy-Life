import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getCategories, getProducts } from "@/lib/db"

export const metadata: Metadata = { title: "Collections" }

export default function CollectionsPage() {
  const categories = getCategories().filter((category) => category.active)
  return (
    <main id="main-content">
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Shop by purpose</p>
          <h1 className="display">One workplace, six focused collections.</h1>
          <p>Move from the desk to the reception area, with furniture and finishes designed to work together.</p>
        </div>
      </section>
      <section className="section">
        <div className="container collection-list">
          {categories.map((category, index) => {
            const count = getProducts({ category: category.name, status: "active" }).length
            return (
              <Link className="collection-row" href={`/collections/${category.slug}`} key={category.slug}>
                <span className="collection-index">0{index + 1}</span>
                <div className="collection-image"><Image src={category.image} alt="" fill sizes="(max-width: 720px) 100vw, 42vw" /></div>
                <div className="collection-copy"><p>{category.note}</p><h2 className="display">{category.name}</h2><span>{count} products <ArrowRight size={17} /></span></div>
              </Link>
            )
          })}
        </div>
      </section>
    </main>
  )
}
