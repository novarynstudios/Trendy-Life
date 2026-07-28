import Link from "next/link"
import { formatDateTime } from "@/lib/format"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function NotificationsPage() {
  const staff = await requireStaff()
  const notifications = await prisma.notification.findMany({ where: { recipientType: "STAFF", recipientId: staff.id }, take: 200, orderBy: { createdAt: "desc" } })
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Notifications</span></nav><h1>Notification center</h1><p>Operational, security, customer, order, inventory, and support alerts.</p></div></header><section className="tl-card"><div className="tl-widget-list">{notifications.map((notification) => <article key={notification.id}><span><strong>{notification.title}</strong><small>{notification.body}</small></span><time>{formatDateTime(notification.createdAt.toISOString())}</time></article>)}{!notifications.length && <p className="tl-widget-empty">No notifications for this staff account.</p>}</div></section></>
}
