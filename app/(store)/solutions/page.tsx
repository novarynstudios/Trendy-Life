import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Check, ClipboardList, Ruler, Truck } from "lucide-react"

export const metadata: Metadata = {
  title: "Workspace solutions",
  description: "Workspace planning, furniture selection, interior finishes, delivery and installation from Trendy Life.",
}

const process = [
  { icon: ClipboardList, title: "Brief", copy: "Tell us about your team, timeline, rooms and practical priorities." },
  { icon: Ruler, title: "Plan", copy: "We shape a furniture and interior direction around the way the space must work." },
  { icon: Truck, title: "Deliver", copy: "Products are checked, coordinated and installed with one accountable team." },
]

export default function SolutionsPage() {
  return (
    <main id="main-content">
      <section className="solutions-hero">
        <div className="container solutions-hero-grid">
          <div>
            <p className="eyebrow">Workspace solutions</p>
            <h1 className="display">From an empty room to a working workplace.</h1>
            <p>Choose a single piece online or bring us a full office brief. Trendy Life connects furniture, space planning and interior finishes in one practical process.</p>
            <div className="hero-actions">
              <Link className="button button-dark" href="/contact">Start a project <ArrowRight size={17} /></Link>
              <Link className="button button-soft" href="/shop">Browse furniture</Link>
            </div>
          </div>
          <div className="solutions-hero-image">
            <Image src="/editorial/workplace-collaboration.webp" alt="A finished collaborative office planned with modular workstations" fill priority sizes="(max-width: 860px) 100vw, 50vw" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container solution-sections">
          <article id="workspaces" className="solution-story">
            <div className="solution-story-image"><Image src="/products/modular-office-workstation-lifestyle.webp" alt="A four-person modular workstation" fill sizes="(max-width: 800px) 100vw, 50vw" /></div>
            <div>
              <p className="eyebrow">01 · Workspaces</p>
              <h2 className="display">Plan for focus and collaboration.</h2>
              <p>We combine executive desks, individual workstations, team benches, task seating and storage into layouts that make the floor work harder without feeling crowded.</p>
              <ul><li><Check /> Individual and team workstation planning</li><li><Check /> Executive and meeting-room furniture</li><li><Check /> Storage integrated around daily workflows</li></ul>
              <Link className="text-link" href="/collections/workstations">Explore workstations <ArrowRight size={17} /></Link>
            </div>
          </article>

          <article id="interiors" className="solution-story reverse">
            <div className="solution-story-image"><Image src="/editorial/glass-partitions.webp" alt="A bright office with framed glass partitions" fill sizes="(max-width: 800px) 100vw, 50vw" /></div>
            <div>
              <p className="eyebrow">02 · Interiors</p>
              <h2 className="display">Finish the space with intention.</h2>
              <p>Furniture works best when the room supports it. Our interior line brings together glass partitions, architectural lighting, floor finishes and built-in storage for a coherent final result.</p>
              <ul><li><Check /> Glass partitions and privacy treatments</li><li><Check /> Ceiling lighting and finish coordination</li><li><Check /> Floor and built-in storage selections</li></ul>
              <Link className="text-link" href="/collections/interiors">Explore interiors <ArrowRight size={17} /></Link>
            </div>
          </article>

          <article id="reception" className="solution-story">
            <div className="solution-story-image"><Image src="/editorial/reception-space.webp" alt="A warm contemporary reception counter" fill sizes="(max-width: 800px) 100vw, 50vw" /></div>
            <div>
              <p className="eyebrow">03 · Arrival spaces</p>
              <h2 className="display">Make a strong first impression.</h2>
              <p>We shape reception areas around a clear focal counter, comfortable guest seating and durable finishes—so visitors understand the business before the first conversation starts.</p>
              <ul><li><Check /> Reception counters and working storage</li><li><Check /> Visitor seating and executive sofas</li><li><Check /> Lighting and material direction</li></ul>
              <Link className="text-link" href="/collections/reception">Explore reception <ArrowRight size={17} /></Link>
            </div>
          </article>
        </div>
      </section>

      <section className="solution-process">
        <div className="container">
          <div className="section-heading">
            <div><p className="eyebrow">How it works</p><h2 className="display">Clear from brief to handover.</h2></div>
          </div>
          <div className="process-grid">
            {process.map(({ icon: Icon, title, copy }, index) => <article key={title}><span>0{index + 1}</span><Icon /><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
          <div className="project-cta"><div><p className="eyebrow">Have a floor plan or a product list?</p><h2 className="display">Let’s turn it into a workspace.</h2></div><Link className="button button-accent" href="/contact">Talk to our team <ArrowRight size={17} /></Link></div>
        </div>
      </section>
    </main>
  )
}
