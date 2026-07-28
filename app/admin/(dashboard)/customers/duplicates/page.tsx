import Link from "next/link"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function DuplicateCustomersPage() {
  await requireStaff("customers.edit")
  const duplicates = await prisma.customerProfile.groupBy({
    by: ["phone"],
    where: { phone: { not: null }, deletedAt: null },
    having: { phone: { _count: { gt: 1 } } },
    _count: { _all: true },
    orderBy: { _count: { phone: "desc" } },
    take: 100,
  })
  const phones = duplicates.flatMap((row) => row.phone ? [row.phone] : [])
  const profiles = phones.length ? await prisma.customerProfile.findMany({ where: { phone: { in: phones } }, include: { user: true }, orderBy: { createdAt: "asc" } }) : []
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/customers">Customers</Link><span>/</span><span>Duplicates</span></nav><h1>Potential duplicate customers</h1><p>Accounts grouped by shared phone number for controlled manual review.</p></div></header><section className="tl-card"><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Phone</th><th>Customer</th><th>Email</th><th>Registered</th><th>Action</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id}><td>{profile.phone}</td><td><strong>{profile.firstName} {profile.lastName}</strong></td><td>{profile.user.email}</td><td>{profile.createdAt.toLocaleDateString("en-BD")}</td><td><Link href={`/admin/customers/${profile.userId}`}>Review</Link></td></tr>)}{!profiles.length && <tr><td colSpan={5}><p className="tl-widget-empty">No duplicate phone numbers detected.</p></td></tr>}</tbody></table></div><div className="tl-card-body"><p className="tl-inline-note">Merging remains a recent-authentication operation because it reassigns orders and deletes redundant identity records.</p></div></section></>
}
