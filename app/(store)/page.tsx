import Image from "next/image"
import Link from "next/link"
import { ArrowRight, PackageCheck, Ruler, Sparkles, Truck } from "lucide-react"
import { getCategories, getProducts, getSettings } from "@/lib/db"
import { ProductCard } from "@/components/product-card"
import { money } from "@/lib/format"

export default function HomePage() {
  const settings = getSettings()
  const categories = getCategories().filter((category) => category.active)
  const featured = getProducts({ status: "active", featured: true, limit: 4 })
  const arrivals = getProducts({ status: "active", limit: 8 })
  const bestseller = featured[0] || arrivals[0]

  return (
    <main id="main-content">
      <section className="home-hero">
        <div className="container hero-shell">
          <div className="hero-copy">
            <p className="eyebrow">{settings.heroEyebrow}</p>
            <h1 className="display">{settings.heroTitle} <em>{settings.heroAccent}</em></h1>
            <p>{settings.heroDescription}</p>
            <div className="hero-actions">
              <Link className="button button-dark" href="/shop">Explore furniture <ArrowRight size={17} /></Link>
              <Link className="button button-soft" href="/contact">Plan a workspace</Link>
            </div>
            <div className="trust-row">
              <span><Ruler size={17} /> Space planning</span>
              <span><PackageCheck size={17} /> Quality checked</span>
              <span><Truck size={17} /> Delivery & installation</span>
            </div>
          </div>
          <div className="hero-image-wrap">
            <Image src={settings.heroImage} alt="A refined modern lifestyle shop" fill priority sizes="(max-width: 900px) 100vw, 48vw" />
            <div className="hero-image-fade" />
            <div className="hero-note">
              <span><Sparkles size={14} /> The workplace edit</span>
              <strong>One team for furniture,<br />fit-out and finish.</strong>
              <small>Serving projects across Bangladesh</small>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div><p className="eyebrow">Find the right fit</p><h2 className="display">Everything a workspace needs.</h2></div>
            <Link className="text-link" href="/collections">View all collections <ArrowRight size={17} /></Link>
          </div>
          <div className="category-grid">
            {categories.map((category) => (
              <Link className="category-tile" key={category.slug} href={`/collections/${category.slug}`}>
                <Image src={category.image} alt={`${category.name} collection`} fill sizes="(max-width: 620px) 50vw, (max-width: 1000px) 33vw, 17vw" />
                <span><strong>{category.name}</strong><small>{category.note}</small></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section surface-section">
        <div className="container">
          <div className="section-heading">
            <div><p className="eyebrow">Selected range</p><h2 className="display">Made for serious work.</h2></div>
            <Link className="text-link" href="/shop">View all furniture <ArrowRight size={17} /></Link>
          </div>
          <div className="product-grid">{arrivals.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        </div>
      </section>

      <section className="section home-solutions">
        <div className="container">
          <div className="section-heading">
            <div><p className="eyebrow">Beyond individual pieces</p><h2 className="display">A complete space, handled.</h2></div>
            <Link className="text-link" href="/solutions">See our solutions <ArrowRight size={17} /></Link>
          </div>
          <div className="solution-teaser-grid">
            <Link href="/solutions#workspaces">
              <span className="solution-teaser-image"><Image src="/editorial/workplace-collaboration.webp" alt="A collaborative modular office workspace" fill sizes="(max-width: 760px) 100vw, 33vw" /></span>
              <span><small>01</small><strong>Workplace planning</strong><em>Layouts, workstations and team-ready furniture</em></span>
            </Link>
            <Link href="/solutions#interiors">
              <span className="solution-teaser-image"><Image src="/editorial/glass-partitions.webp" alt="Modern framed glass office partitions" fill sizes="(max-width: 760px) 100vw, 33vw" /></span>
              <span><small>02</small><strong>Interior fit-out</strong><em>Partitions, lighting and material finishes</em></span>
            </Link>
            <Link href="/solutions#reception">
              <span className="solution-teaser-image"><Image src="/editorial/reception-space.webp" alt="Contemporary office reception desk" fill sizes="(max-width: 760px) 100vw, 33vw" /></span>
              <span><small>03</small><strong>Arrival spaces</strong><em>Reception counters, seating and first impressions</em></span>
            </Link>
          </div>
        </div>
      </section>

      {bestseller && (
        <section className="feature-section">
          <div className="container feature-card">
            <div className="feature-image"><Image src={bestseller.secondImage} alt={`${bestseller.name} in a finished office`} fill sizes="(max-width: 780px) 100vw, 50vw" /></div>
            <div className="feature-copy">
              <p className="eyebrow">The executive collection</p>
              <h2 className="display">{bestseller.name}</h2>
              <p>{bestseller.description}</p>
              <div className="feature-meta"><strong>{money(bestseller.price)}</strong><span>{bestseller.inventory} currently available</span></div>
              <Link className="button button-accent" href={`/products/${bestseller.slug}`}>View the details <ArrowRight size={17} /></Link>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
