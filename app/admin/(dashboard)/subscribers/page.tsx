import { Mail, Tags } from "lucide-react"
import { getSubscribers } from "@/lib/db"
import { formatDateTime } from "@/lib/format"
import { requireStaff } from "@/src/server/auth/staff"

export default async function AdminSubscribersPage() {
  await requireStaff("marketing.view")
  const subscribers = getSubscribers()
  return (
    <>
      <div className="admin-page-head"><div><h1>Subscribers</h1><p>People who joined the Trendy Life email list.</p></div><span className="admin-count-pill">{subscribers.length} total</span></div>
      <section className="admin-card">
        {subscribers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Email address</th><th>Joined</th><th>Contact</th></tr></thead><tbody>{subscribers.map((subscriber) => <tr key={subscriber.id}><td><strong>{subscriber.email}</strong></td><td>{formatDateTime(subscriber.createdAt)}</td><td><a className="table-action" href={`mailto:${subscriber.email}`}><Mail size={14} /> Email</a></td></tr>)}</tbody></table></div> : <div className="admin-empty"><Tags /><h3>No subscribers yet</h3><p>New email signups will appear here.</p></div>}
      </section>
    </>
  )
}
