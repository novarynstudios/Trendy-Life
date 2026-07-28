import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { AdminDataTable, type AdminColumnSpec, type AdminTableRow } from "@/components/admin/data-table"
import { requireStaff } from "@/src/server/auth/staff"
import { listPayments, type PaymentListQuery } from "@/src/server/services/admin-lists"

const columns: AdminColumnSpec[] = [
  { key: "transactionId", label: "Transaction ID", type: "primary" }, { key: "order", label: "Order" }, { key: "customer", label: "Customer" },
  { key: "gateway", label: "Gateway" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount", type: "money" },
  { key: "fee", label: "Fee", type: "money", hideOnMobile: true }, { key: "currency", label: "Currency", hideOnMobile: true },
  { key: "status", label: "Status", type: "status" }, { key: "createdAt", label: "Created", type: "date", hideOnMobile: true },
]

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<PaymentListQuery> }) {
  await requireStaff("payments.view")
  const query = await searchParams
  const result = await listPayments(query)
  return <>
    <header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Payments</span></nav><h1>Payments & transactions</h1><p>Gateway transactions, manual payments, refunds, disputes, webhooks, and reconciliation.</p></div><div className="tl-page-actions"><Link className="tl-button" href="/admin/payments/webhooks">Webhook events</Link><Link className="tl-button" href="/admin/payments/reconciliation">Reconciliation</Link><Link className="tl-button tl-button-primary" href="/admin/payments/new"><Plus size={14} />Record payment</Link></div></header>
    <section className="tl-card"><form className="tl-filter-toolbar" action="/admin/payments"><label className="tl-filter-search"><Search size={15} /><input name="q" defaultValue={query.q} placeholder="Transaction, order or customer email" /></label><label><span>Gateway</span><select name="gateway" defaultValue={query.gateway ?? ""}><option value="">All gateways</option>{result.gateways.map((gateway) => <option key={gateway}>{gateway}</option>)}</select></label><label><span>Type</span><select name="type" defaultValue={query.type ?? ""}><option value="">All transaction types</option>{["AUTHORIZATION","CAPTURE","SALE","REFUND","VOID","CHARGEBACK","OFFLINE"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Status</span><select name="status" defaultValue={query.status ?? ""}><option value="">All statuses</option>{["PENDING","PROCESSING","SUCCESSFUL","FAILED","CANCELLED","PARTIALLY_REFUNDED","REFUNDED","DISPUTED","CHARGEBACK"].map((value) => <option key={value}>{value}</option>)}</select></label><button className="tl-button tl-button-primary" type="submit">Apply</button><Link className="tl-button" href="/admin/payments">Reset</Link></form><AdminDataTable columns={columns} rows={result.rows as AdminTableRow[]} total={result.total} page={result.page} pageSize={result.pageSize} actionBase="/admin/payments" exportHref="/admin/exports/payments" /></section>
  </>
}
