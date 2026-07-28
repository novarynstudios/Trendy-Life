import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, HeartHandshake, SearchCheck } from "lucide-react"

export const metadata: Metadata = { title: "About Trendy Life" }

export default function AboutPage() {
  return (
    <main id="main-content">
      <section className="about-hero">
        <div className="container about-grid">
          <div>
            <p className="eyebrow">About Trendy Life</p>
            <h1 className="display">Better workplaces start with better decisions.</h1>
            <p>Trendy Life brings furniture, storage and interior elements into one clear collection for modern offices. We focus on pieces that look composed, work hard and stay useful long after installation day.</p>
            <Link className="button button-dark" href="/solutions">See how we work <ArrowRight size={17} /></Link>
          </div>
          <div className="about-image"><Image src="/editorial/workplace-collaboration.webp" alt="A collaborative office furnished by Trendy Life" fill priority sizes="(max-width: 820px) 100vw, 50vw" /></div>
        </div>
      </section>
      <section className="section">
        <div className="container values-grid">
          <article><span>01</span><SearchCheck /><h2>Selected for real spaces</h2><p>Every item is judged by proportion, durability, function and how well it works with the wider room.</p></article>
          <article><span>02</span><CheckCircle2 /><h2>One coherent process</h2><p>Furniture, finish coordination and project support stay connected from selection through delivery.</p></article>
          <article><span>03</span><HeartHandshake /><h2>Local, accountable support</h2><p>A Bangladesh-based team is here before, during and after your order or workplace project.</p></article>
        </div>
      </section>
      <section className="statement-section"><div className="container"><p className="eyebrow">Our point of view</p><h2 className="display">An office should feel considered before anyone says a word.</h2></div></section>
    </main>
  )
}
