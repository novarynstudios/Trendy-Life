import Link from "next/link"
import { Filter, Plus, Search } from "lucide-react"
import { AdminDataTable, type AdminColumnSpec, type AdminTableRow } from "@/components/admin/data-table"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { listOrders, type OrderListQuery } from "@/src/server/services/orders"
import { bulkOrderAction } from "../actions"

const columns: AdminColumnSpec[] = [
  { key: "orderNumber", label: "Order", type: "primary" },
  { key: "customer", label: "Customer" },
  { key: "createdAt", label: "Date", type: "date", hideOnMobile: true },
  { key: "paymentMethod", label: "Payment method", hideOnMobile: true },
  { key: "total", label: "Amount", type: "money" },
  { key: "paymentStatus", label: "Payment", type: "status" },
  { key: "fulfillmentStatus", label: "Fulfillment", type: "status" },
  { key: "status", label: "Order status", type: "status" },
  { key: "assignedStaff", label: "Assigned staff", hideOnMobile: true },
  { key: "salesChannel", label: "Channel", hideOnMobile: true },
]

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<OrderListQuery> }) {
  await requireStaff("orders.view")
  const query = await searchParams
  const [result, csrfToken] = await Promise.all([listOrders(query), getCsrfToken()])
  const exportParams = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string"))

  return (
    <>
      <header className="tl-page-header">
        <div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Orders</span></nav><h1>Orders</h1><p>Search, filter, assign, invoice, and move orders through fulfillment.</p></div>
        <div className="tl-page-actions"><Link className="tl-button tl-button-primary" href="/admin/orders/new"><Plus size={14} />Create manual order</Link></div>
      </header>
      <section className="tl-card">
        <form className="tl-filter-toolbar" action="/admin/orders">
          <label className="tl-filter-search"><Search size={15} /><span className="sr-only">Search orders</span><input name="q" defaultValue={query.q} placeholder="Order number, customer, email, phone, SKU or transaction" /></label>
          <label><span>Status</span><select name="status" defaultValue={query.status ?? ""}><option value="">All order statuses</option>{["DRAFT","PENDING_PAYMENT","PAYMENT_FAILED","PAID","CONFIRMED","PROCESSING","READY_TO_SHIP","SHIPPED","DELIVERED","CANCELLED","PARTIALLY_REFUNDED","REFUNDED","ON_HOLD","FRAUD_REVIEW"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
          <label><span>Payment</span><select name="payment" defaultValue={query.payment ?? ""}><option value="">All payment statuses</option>{["PENDING","PROCESSING","SUCCESSFUL","FAILED","CANCELLED","PARTIALLY_REFUNDED","REFUNDED","DISPUTED","CHARGEBACK"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Fulfillment</span><select name="fulfillment" defaultValue={query.fulfillment ?? ""}><option value="">All fulfillment</option>{["UNFULFILLED","PARTIAL","FULFILLED","RETURNED"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Assigned staff</span><select name="staff" defaultValue={query.staff ?? ""}><option value="">Any staff member</option>{result.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label>
          <details className="tl-advanced-filters"><summary className="tl-button"><Filter size={14} />More filters</summary><div>
            <label><span>Date from</span><input type="date" name="dateFrom" defaultValue={query.dateFrom} /></label>
            <label><span>Date to</span><input type="date" name="dateTo" defaultValue={query.dateTo} /></label>
            <label><span>Minimum amount</span><input type="number" min="0" name="amountMin" defaultValue={query.amountMin} /></label>
            <label><span>Maximum amount</span><input type="number" min="0" name="amountMax" defaultValue={query.amountMax} /></label>
            <label><span>Sales channel</span><select name="channel" defaultValue={query.channel ?? ""}><option value="">All channels</option><option value="storefront">Storefront</option><option value="admin">Admin/manual</option><option value="marketplace">Marketplace</option></select></label>
          </div></details>
          <button className="tl-button tl-button-primary" type="submit">Apply filters</button>
          <Link className="tl-button" href="/admin/orders">Reset</Link>
        </form>
        <AdminDataTable
          columns={columns}
          rows={result.rows as AdminTableRow[]}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          actionBase="/admin/orders"
          exportHref={`/admin/exports/orders?${exportParams.toString()}`}
          bulkAction={bulkOrderAction}
          csrfToken={csrfToken}
          bulkOptions={[
            { value: "confirm", label: "Mark confirmed" },
            { value: "processing", label: "Move to processing" },
            { value: "hold", label: "Place on hold" },
            { value: "invoice", label: "Generate invoices" },
            { value: "cancel", label: "Cancel orders" },
          ]}
        />
      </section>
    </>
  )
}
