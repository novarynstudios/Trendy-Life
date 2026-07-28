import Link from "next/link"
import { formatDateTime } from "@/lib/format"
import { saveBrandAction, saveCategoryAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireStaff("products.view")
  const [categories, brands, csrfToken, query] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, include: { parent: true, _count: { select: { products: true } } }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.brand.findMany({ where: { deletedAt: null }, include: { _count: { select: { products: true } } }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    getCsrfToken(),
    searchParams,
  ])
  return (
    <>
      <header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/products">Catalog</Link><span>/</span><span>Taxonomy</span></nav><h1>Categories & brands</h1><p>Nested catalog navigation, visibility, publication, SEO identity, and product counts.</p></div></header>
      {query.saved && <div className="tl-alert tl-alert-success">{query.saved === "brand" ? "Brand" : "Category"} created.</div>}
      <div className="tl-detail-grid"><div className="tl-detail-primary">
        <section className="tl-card"><div className="tl-card-header"><h2>Categories</h2></div><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Name</th><th>Parent</th><th>Slug</th><th>Status</th><th>Visible</th><th>Products</th><th>Updated</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><strong>{category.name}</strong></td><td>{category.parent?.name ?? "Top level"}</td><td>{category.slug}</td><td>{category.status}</td><td>{category.visible ? "Yes" : "No"}</td><td>{category._count.products}</td><td>{formatDateTime(category.updatedAt.toISOString())}</td></tr>)}</tbody></table></div></section>
        <section className="tl-card"><div className="tl-card-header"><h2>Brands</h2></div><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Name</th><th>Slug</th><th>Status</th><th>Products</th><th>Updated</th></tr></thead><tbody>{brands.map((brand) => <tr key={brand.id}><td><strong>{brand.name}</strong></td><td>{brand.slug}</td><td>{brand.status}</td><td>{brand._count.products}</td><td>{formatDateTime(brand.updatedAt.toISOString())}</td></tr>)}</tbody></table></div></section>
      </div><aside className="tl-detail-aside">
        <form className="tl-card tl-compact-form" action={saveCategoryAction}><div className="tl-card-header"><h2>Add category</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><label>Name<input name="name" required /></label><label>Slug<input name="slug" pattern="[a-z0-9-]+" required /></label><label>Parent<select name="parentId"><option value="">Top level</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Status<select name="status"><option>PUBLISHED</option><option>DRAFT</option></select></label><label className="tl-checkbox"><input name="visible" type="checkbox" defaultChecked /><span>Visible</span></label><button className="tl-button tl-button-primary tl-button-wide" type="submit">Create category</button></div></form>
        <form className="tl-card tl-compact-form" action={saveBrandAction}><div className="tl-card-header"><h2>Add brand</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><label>Name<input name="name" required /></label><label>Slug<input name="slug" pattern="[a-z0-9-]+" required /></label><label>Status<select name="status"><option>PUBLISHED</option><option>DRAFT</option></select></label><button className="tl-button tl-button-primary tl-button-wide" type="submit">Create brand</button></div></form>
      </aside></div>
    </>
  )
}
