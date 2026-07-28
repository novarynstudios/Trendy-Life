"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import type { SearchResult } from "@/src/server/services/global-search"

export function SearchResults({ query, results }: { query: string; results: SearchResult[] }) {
  const [active, setActive] = useState(0)
  const router = useRouter()
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)) }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)) }
      if (event.key === "Enter" && results[active]) { event.preventDefault(); router.push(results[active].href) }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [active, results, router])
  const groups = Map.groupBy(results, (result) => result.category)
  let index = -1
  return <div className="tl-search-results" ref={container}>{results.length ? [...groups.entries()].map(([category, items]) => <section key={category}><h2>{category}<span>{items.length}</span></h2>{items.map((result) => { index += 1; const current = index; return <Link key={`${category}-${result.id}`} className={active === current ? "is-active" : ""} href={result.href} onMouseEnter={() => setActive(current)}><Search size={14} /><span><strong>{result.title}</strong><small>{result.subtitle}</small></span>{result.status && <span className={`tl-status ${result.status.toLocaleLowerCase()}`}>{result.status.replaceAll("_"," ").toLocaleLowerCase()}</span>}</Link> })}</section>) : <div className="tl-table-empty"><strong>{query ? "No matching records" : "Search Trendy Life Admin"}</strong><span>{query ? "Try another name, number, email, phone, SKU, or transaction ID." : "Enter at least two characters."}</span></div>}</div>
}
