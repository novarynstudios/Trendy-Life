import Link from "next/link"
import { ArrowLeft, Send } from "lucide-react"
import { notFound } from "next/navigation"
import { replyTicketAction } from "@/app/actions"
import { requireCustomer } from "@/lib/auth"
import { getCustomerTicketById, getTicketReplies } from "@/lib/db"
import { formatDateTime } from "@/lib/format"

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await requireCustomer()
  const { id } = await params
  const ticket = getCustomerTicketById(customer.id, Number(id))
  if (!ticket) notFound()
  const replies = getTicketReplies(ticket.id)
  return <>
    <header className="client-page-head"><div><Link className="client-back" href="/account/tickets"><ArrowLeft /> Support tickets</Link><h1>{ticket.subject}</h1><p>{ticket.ticketNumber} · {ticket.department}</p></div><span className={`status-badge large ${ticket.status}`}>{ticket.status}</span></header>
    <section className="client-card ticket-thread">{replies.map((reply) => <article className={reply.authorType} key={reply.id}><header><strong>{reply.authorName}</strong><span>{reply.authorType}</span><small>{formatDateTime(reply.createdAt)}</small></header><p>{reply.message}</p></article>)}</section>
    {ticket.status !== "closed" && <form className="client-card ticket-reply" action={replyTicketAction}><input type="hidden" name="ticketId" value={ticket.id} /><label><span>Reply</span><textarea name="message" rows={5} required /></label><button className="button button-accent" type="submit">Send reply <Send /></button></form>}
  </>
}
