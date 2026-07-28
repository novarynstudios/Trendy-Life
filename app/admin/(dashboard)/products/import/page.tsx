import Link from "next/link"
import { Upload } from "lucide-react"
import { importProductsCsvAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"

export default async function ProductImportPage({ searchParams }: { searchParams: Promise<{ imported?: string }> }) {
  await requireStaff("products.import")
  const [csrfToken, query] = await Promise.all([getCsrfToken(), searchParams])
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/products">Products</Link><span>/</span><span>Import</span></nav><h1>Product CSV import</h1><p>Create or update products by unique SKU with server-side row validation.</p></div></header>{query.imported && <div className="tl-alert tl-alert-success">{query.imported} products imported.</div>}<form className="tl-card tl-narrow-form tl-form-section" action={importProductsCsvAction}><div className="tl-card-header"><h2>Upload CSV</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><label>CSV file<input name="file" type="file" accept=".csv,text/csv" required /></label><p className="tl-inline-note">Required headers: <code>sku,name,slug,regularPrice</code>. Optional: <code>salePrice,costPrice,status,type</code>. Maximum 2 MB and 2,000 rows.</p><button className="tl-button tl-button-primary" type="submit"><Upload size={14} />Validate and import</button></div></form></>
}
