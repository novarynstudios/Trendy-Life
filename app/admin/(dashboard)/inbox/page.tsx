import { Check, Inbox, Mail, Phone } from "lucide-react"
import { markMessageReadAction } from "@/app/actions"
import { getMessages } from "@/lib/db"
import { formatDateTime } from "@/lib/format"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"

export default async function AdminInboxPage() {
  await requireStaff("support.manage")
  const csrfToken = await getCsrfToken()
  const messages = getMessages()
  const unread = messages.filter((message) => message.status === "new").length
  return (
    <>
      <div className="admin-page-head"><div><h1>Customer inbox</h1><p>Messages sent through the storefront contact page.</p></div><span className="admin-count-pill">{unread} unread</span></div>
      <div className="inbox-list">
        {messages.map((message) => <article className={`admin-card inbox-card ${message.status}`} key={message.id}>
          <div className="inbox-card-head"><div><span className="message-avatar">{message.name.slice(0, 1).toUpperCase()}</span><span><strong>{message.name}</strong><small>{formatDateTime(message.createdAt)}</small></span></div><span className="message-subject">{message.subject}</span></div>
          <p>{message.message}</p>
          <div className="message-actions"><a href={`mailto:${message.email}`}><Mail size={15} /> {message.email}</a>{message.phone && <a href={`tel:${message.phone}`}><Phone size={15} /> {message.phone}</a>}{message.status === "new" && <form action={markMessageReadAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={message.id} /><button type="submit"><Check size={15} /> Mark read</button></form>}</div>
        </article>)}
        {!messages.length && <div className="admin-card admin-empty"><Inbox /><h3>Your inbox is clear</h3><p>Customer enquiries will appear here.</p></div>}
      </div>
    </>
  )
}
