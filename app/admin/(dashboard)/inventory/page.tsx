import Link from "next/link"
import { Search, Upload } from "lucide-react"
import { AdminDataTable, type AdminColumnSpec, type AdminTableRow } from "@/components/admin/data-table"
import { requireStaff } from "@/src/server/auth/staff"
import { listInventory, type InventoryListQuery } from "@/src/server/services/admin-lists"

const columns: AdminColumnSpec[] = [
  { key: "product", label: "Product", type: "primary" }, { key: "sku", label: "SKU" }, { key: "warehouse", label: "Warehouse" },
  { key: "onHand", label: "On hand", type: "number" }, { key: "reserved", label: "Reserved", type: "number" }, { key: "available", label: "Available", type: "number" },
  { key: "incoming", label: "Incoming", type: "number", hideOnMobile: true }, { key: "damaged", label: "Damaged", type: "number", hideOnMobile: true },
  { key: "returned", label: "Returned", type: "number", hideOnMobile: true }, { key: "unitCost", label: "Unit cost", type: "money", hideOnMobile: true }, { key: "value", label: "Value", type: "money" },
]

export default async function InventoryPage({ searchParams }: { searchParams: Promise<InventoryListQuery> }) {
  await requireStaff("inventory.view")
  const query = await searchParams
  const result = await listInventory(query)
  return <>
    <header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Inventory</span></nav><h1>Inventory</h1><p>Warehouse stock, reservations, movements, incoming inventory, and valuation.</p></div><div className="tl-page-actions"><Link className="tl-button" href="/admin/inventory/movements">Stock movement log</Link><Link className="tl-button" href="/admin/inventory/import"><Upload size={14} />Bulk stock import</Link><Link className="tl-button tl-button-primary" href="/admin/inventory/adjust">Adjust stock</Link></div></header>
    <section className="tl-metric-strip"><article><span>Inventory valuation</span><strong>৳{result.valuation.toLocaleString("en-BD")}</strong></article><article><span>Tracked inventory items</span><strong>{result.total.toLocaleString("en-BD")}</strong></article><article><span>Warehouses</span><strong>{result.warehouses.length}</strong></article></section>
    <section className="tl-card"><form className="tl-filter-toolbar" action="/admin/inventory"><label className="tl-filter-search"><Search size={15} /><input name="q" defaultValue={query.q} placeholder="Product name, SKU or variation" /></label><label><span>Warehouse</span><select name="warehouse" defaultValue={query.warehouse ?? ""}><option value="">All warehouses</option>{result.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label><span>Stock level</span><select name="stock" defaultValue={query.stock ?? ""}><option value="">Any stock level</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="available">In stock</option></select></label><button className="tl-button tl-button-primary" type="submit">Apply</button><Link className="tl-button" href="/admin/inventory">Reset</Link></form><AdminDataTable columns={columns} rows={result.rows as AdminTableRow[]} total={result.total} page={result.page} pageSize={result.pageSize} actionBase="/admin/inventory" exportHref="/admin/exports/inventory" /></section>
  </>
}
