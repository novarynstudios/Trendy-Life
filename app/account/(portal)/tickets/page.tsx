import Link from "next/link"
import { Headphones, Plus } from "lucide-react"
import { requireCustomer } from "@/lib/auth"
import { getCustomerTickets } from "@/lib/db"
import { formatDateTime } from "@/lib/format"

export default async function CustomerTicketsPage() {
  const customer = await requireCustomer()
  const tickets = getCustomerTickets(customer.id)
  return <>
    <header className="client-page-head"><div><p className="eyebrow">Support</p><h1>Support tickets</h1><p>Keep every product, delivery and billing conversation organized.</p></div><Link className="button button-accent" href="/account/tickets/new"><Plus /> Open ticket</Link></header>
    <section className="client-card">{tickets.length ? <div className="client-table-wrap"><table className="client-table"><thead><tr><th>Ticket</th><th>Subject</th><th>Department</th><th>Priority</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.ticketNumber}</strong></td><td>{ticket.subject}</td><td>{ticket.department}</td><td>{ticket.priority}</td><td><span className={`status-badge ${ticket.status}`}>{ticket.status}</span></td><td>{formatDateTime(ticket.updatedAt)}</td><td><Link href={`/account/tickets/${ticket.id}`}>Open</Link></td></tr>)}</tbody></table></div> : <div className="client-empty"><Headphones /><h3>No support tickets</h3><p>When you need help, open a ticket here.</p></div>}</section>
  </>
}
