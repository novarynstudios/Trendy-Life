import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { AdminDataTable, type AdminColumnSpec, type AdminTableRow } from "@/components/admin/data-table"
import { requireStaff } from "@/src/server/auth/staff"
import { listTickets, type TicketListQuery } from "@/src/server/services/admin-lists"

const columns: AdminColumnSpec[] = [
  { key: "ticketNumber", label: "Ticket", type: "primary" }, { key: "customer", label: "Customer" }, { key: "department", label: "Department" },
  { key: "subject", label: "Subject" }, { key: "priority", label: "Priority", type: "status" }, { key: "status", label: "Status", type: "status" },
  { key: "assignedStaff", label: "Assigned staff" }, { key: "lastResponse", label: "Last response", type: "date", hideOnMobile: true }, { key: "createdAt", label: "Created", type: "date", hideOnMobile: true },
]

export default async function TicketsPage({ searchParams }: { searchParams: Promise<TicketListQuery> }) {
  await requireStaff("support.view")
  const query = await searchParams
  const result = await listTickets(query)
  return <>
    <header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Support</span></nav><h1>Support tickets</h1><p>Department queues, assignments, SLA status, customer conversations, and internal notes.</p></div><div className="tl-page-actions"><Link className="tl-button" href="/admin/tickets/departments">Departments</Link><Link className="tl-button" href="/admin/tickets/canned-responses">Canned responses</Link><Link className="tl-button tl-button-primary" href="/admin/tickets/new"><Plus size={14} />Open ticket</Link></div></header>
    <section className="tl-card"><form className="tl-filter-toolbar" action="/admin/tickets"><label className="tl-filter-search"><Search size={15} /><input name="q" defaultValue={query.q} placeholder="Ticket number, subject or customer email" /></label><label><span>Status</span><select name="status" defaultValue={query.status ?? ""}><option value="">All statuses</option>{["OPEN","CUSTOMER_REPLIED","STAFF_REPLIED","IN_PROGRESS","WAITING_FOR_CUSTOMER","RESOLVED","CLOSED"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Priority</span><select name="priority" defaultValue={query.priority ?? ""}><option value="">All priorities</option>{["LOW","MEDIUM","HIGH","URGENT"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Department</span><select name="department" defaultValue={query.department ?? ""}><option value="">All departments</option>{result.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label><span>Assigned staff</span><select name="staff" defaultValue={query.staff ?? ""}><option value="">Any staff</option>{result.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label><button className="tl-button tl-button-primary" type="submit">Apply</button><Link className="tl-button" href="/admin/tickets">Reset</Link></form><AdminDataTable columns={columns} rows={result.rows as AdminTableRow[]} total={result.total} page={result.page} pageSize={result.pageSize} actionBase="/admin/tickets" exportHref="/admin/exports/tickets" /></section>
  </>
}
