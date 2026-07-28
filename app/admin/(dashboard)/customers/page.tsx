import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { AdminDataTable, type AdminColumnSpec, type AdminTableRow } from "@/components/admin/data-table"
import { requireStaff } from "@/src/server/auth/staff"
import { listCustomers, type CustomerListQuery } from "@/src/server/services/admin-lists"

const columns: AdminColumnSpec[] = [
  { key: "customerNumber", label: "Customer ID", type: "primary" },
  { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone", hideOnMobile: true },
  { key: "location", label: "Location", hideOnMobile: true }, { key: "orders", label: "Orders", type: "number" },
  { key: "lifetimeValue", label: "Lifetime value", type: "money" }, { key: "status", label: "Status", type: "status" },
  { key: "registeredAt", label: "Registered", type: "date", hideOnMobile: true }, { key: "lastActiveAt", label: "Last active", type: "date", hideOnMobile: true },
]

export default async function CustomersPage({ searchParams }: { searchParams: Promise<CustomerListQuery> }) {
  await requireStaff("customers.view")
  const query = await searchParams
  const result = await listCustomers(query)
  const exportParams = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
  return <>
    <header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Customers</span></nav><h1>Customers</h1><p>Customer CRM, account health, lifetime value, activity, and support history.</p></div><div className="tl-page-actions"><Link className="tl-button" href="/admin/customers/duplicates">Merge duplicates</Link><Link className="tl-button tl-button-primary" href="/admin/customers/new"><Plus size={14} />Create customer</Link></div></header>
    <section className="tl-card"><form className="tl-filter-toolbar" action="/admin/customers"><label className="tl-filter-search"><Search size={15} /><input name="q" defaultValue={query.q} placeholder="Customer ID, name, email or phone" /></label><label><span>Status</span><select name="status" defaultValue={query.status ?? ""}><option value="">All statuses</option>{["ACTIVE","PENDING","SUSPENDED","DISABLED","ANONYMIZED"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Customer group</span><select name="group" defaultValue={query.group ?? ""}><option value="">All groups</option>{result.groups.map((group) => <option key={group}>{group}</option>)}</select></label><button className="tl-button tl-button-primary" type="submit">Apply</button><Link className="tl-button" href="/admin/customers">Reset</Link></form><AdminDataTable columns={columns} rows={result.rows as AdminTableRow[]} total={result.total} page={result.page} pageSize={result.pageSize} actionBase="/admin/customers" exportHref={`/admin/exports/customers?${exportParams}`} /></section>
  </>
}
