import Link from "next/link"
import { Search } from "lucide-react"
import { SearchResults } from "@/components/admin/search-results"
import { requireStaff } from "@/src/server/auth/staff"
import { globalAdminSearch } from "@/src/server/services/global-search"

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireStaff()
  const { q = "" } = await searchParams
  const results = q.length >= 2 ? await globalAdminSearch(q, staff.permissions.includes("staff.view")) : []
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Global search</span></nav><h1>Global search</h1><p>Exact and partial matching across commerce, CRM, catalog, support, staff, invoices, and logs.</p></div></header><section className="tl-card tl-search-page"><form action="/admin/search"><Search size={18} /><input name="q" defaultValue={q} placeholder="Order number, email, phone, SKU, transaction, invoice…" autoFocus /><button className="tl-button tl-button-primary">Search</button></form><SearchResults query={q} results={results} /></section></>
}
