import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { AdminDataTable, type AdminColumnSpec, type AdminTableRow } from "@/components/admin/data-table"
import { requireStaff } from "@/src/server/auth/staff"
import { listProducts, type ProductListQuery } from "@/src/server/services/admin-lists"

const columns: AdminColumnSpec[] = [
  { key: "name", label: "Product", type: "primary" }, { key: "sku", label: "SKU" }, { key: "type", label: "Type", hideOnMobile: true },
  { key: "status", label: "Status", type: "status" }, { key: "inventory", label: "On hand", type: "number" }, { key: "available", label: "Available", type: "number" },
  { key: "price", label: "Price", type: "money" }, { key: "category", label: "Category", hideOnMobile: true }, { key: "brand", label: "Brand", hideOnMobile: true }, { key: "variants", label: "Variants", type: "number", hideOnMobile: true },
]

export default async function ProductsPage({ searchParams }: { searchParams: Promise<ProductListQuery> }) {
  await requireStaff("products.view")
  const query = await searchParams
  const result = await listProducts(query)
  return <>
    <header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Catalog</span></nav><h1>Products</h1><p>Products, variations, media, pricing, publishing, SEO, and catalog relationships.</p></div><div className="tl-page-actions"><Link className="tl-button" href="/admin/products/import">Import CSV</Link><Link className="tl-button" href="/admin/products/categories">Categories & brands</Link><Link className="tl-button tl-button-primary" href="/admin/products/new"><Plus size={14} />Add product</Link></div></header>
    <section className="tl-card"><form className="tl-filter-toolbar" action="/admin/products"><label className="tl-filter-search"><Search size={15} /><input name="q" defaultValue={query.q} placeholder="Product name, SKU or barcode" /></label><label><span>Status</span><select name="status" defaultValue={query.status ?? ""}><option value="">All statuses</option>{["DRAFT","SCHEDULED","PUBLISHED","ARCHIVED"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Type</span><select name="type" defaultValue={query.type ?? ""}><option value="">All types</option>{["SIMPLE","VARIABLE","DIGITAL","BUNDLE","PREORDER"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Category</span><select name="category" defaultValue={query.category ?? ""}><option value="">All categories</option>{result.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label><span>Stock</span><select name="stock" defaultValue={query.stock ?? ""}><option value="">Any stock level</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></label><button className="tl-button tl-button-primary" type="submit">Apply</button><Link className="tl-button" href="/admin/products">Reset</Link></form><AdminDataTable columns={columns} rows={result.rows as AdminTableRow[]} total={result.total} page={result.page} pageSize={result.pageSize} actionBase="/admin/products" exportHref="/admin/exports/products" /></section>
  </>
}
