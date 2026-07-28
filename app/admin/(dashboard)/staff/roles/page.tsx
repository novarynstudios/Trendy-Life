import Link from "next/link"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function RolesPage() {
  await requireStaff("staff.view")
  const roles = await prisma.staffRole.findMany({ orderBy: { name: "asc" }, include: { permissions: { include: { permission: true } }, _count: { select: { staff: true } } } })
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/staff">Staff</Link><span>/</span><span>Roles</span></nav><h1>Roles & permissions</h1><p>Default roles are built from granular server-enforced permissions; per-staff overrides are applied last.</p></div></header><section className="tl-role-grid">{roles.map((role) => <article className="tl-card" key={role.id}><div className="tl-card-header"><div><h2>{role.name}</h2><p>{role._count.staff} staff · {role.permissions.length} permissions</p></div>{role.isSystem && <span className="tl-status active">system role</span>}</div><div className="tl-permission-grid">{role.permissions.slice(0,18).map((item) => <span key={item.permissionId}>{item.permission.key}</span>)}{role.permissions.length > 18 && <span>+{role.permissions.length - 18} more</span>}</div></article>)}</section></>
}
