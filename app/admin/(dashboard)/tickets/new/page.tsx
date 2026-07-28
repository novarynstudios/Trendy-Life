import Link from "next/link"
import { createSupportTicketAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  await requireStaff("support.manage")
  const [query, csrfToken, departments, customers] = await Promise.all([
    searchParams, getCsrfToken(),
    prisma.supportDepartment.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { status: "ACTIVE" }, take: 200, orderBy: { createdAt: "desc" }, include: { profile: true } }),
  ])
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/tickets">Support</Link><span>/</span><span>New ticket</span></nav><h1>Open support ticket</h1><p>Create a tracked customer conversation with department, priority, and staff ownership.</p></div></header><form className="tl-card tl-form-section tl-narrow-form" action={createSupportTicketAction}><div className="tl-card-header"><h2>Ticket details</h2></div><div className="tl-card-body tl-form-grid"><input type="hidden" name="_csrf" value={csrfToken} /><label>Customer<select name="userId" defaultValue={query.customer ?? ""}><option value="">Guest / no customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.profile ? `${customer.profile.firstName} ${customer.profile.lastName}` : customer.email} · {customer.email}</option>)}</select></label><label>Department<select name="departmentId" required>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label>Priority<select name="priority" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label><label className="span-2">Subject<input name="subject" required /></label><label className="span-2">Message<textarea name="message" rows={10} required /></label><div className="span-2 tl-form-actions"><Link className="tl-button" href="/admin/tickets">Cancel</Link><button className="tl-button tl-button-primary" type="submit">Create ticket</button></div></div></form></>
}
