import Link from "next/link"
import { Upload } from "lucide-react"
import { importInventoryCsvAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"

export default async function InventoryImportPage({ searchParams }: { searchParams: Promise<{ imported?: string }> }) {
  await requireStaff("inventory.adjust")
  const [csrfToken, query] = await Promise.all([getCsrfToken(), searchParams])
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/inventory">Inventory</Link><span>/</span><span>Import</span></nav><h1>Inventory CSV import</h1><p>Set warehouse opening/on-hand balances with immutable correction movements.</p></div></header>{query.imported && <div className="tl-alert tl-alert-success">{query.imported} inventory rows processed.</div>}<form className="tl-card tl-narrow-form tl-form-section" action={importInventoryCsvAction}><div className="tl-card-header"><h2>Upload CSV</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><label>CSV file<input name="file" type="file" accept=".csv,text/csv" required /></label><p className="tl-inline-note">Required headers: <code>sku,warehouseCode,onHand,reason</code>. SKU can identify a product or variation. Maximum 2 MB and 5,000 rows.</p><button className="tl-button tl-button-primary" type="submit"><Upload size={14} />Validate and import</button></div></form></>
}
