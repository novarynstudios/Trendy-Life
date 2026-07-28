import Link from "next/link"
import { notFound } from "next/navigation"
import { KeyRound, ShieldCheck } from "lucide-react"
import { formatDateTime } from "@/lib/format"
import { changeStaffStatusAction, updateStaffAccessAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; saved?: string }>
}) {
  const principal = await requireStaff("staff.view")
  const [{ id }, query, csrfToken, roles] = await Promise.all([
    params,
    searchParams,
    getCsrfToken(),
    prisma.staffRole.findMany({ orderBy: { name: "asc" } }),
  ])
  const member = await prisma.staff.findUnique({
    where: { id },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      permissions: { include: { permission: true } },
      sessions: { orderBy: { createdAt: "desc" } },
      twoFactorSecret: true,
      auditLogs: { take: 50, orderBy: { createdAt: "desc" } },
    },
  })
  if (!member) notFound()
  const permissions = new Set(member.role.permissions.map((item) => item.permission.key))
  for (const override of member.permissions) {
    if (override.allowed) permissions.add(override.permission.key)
    else permissions.delete(override.permission.key)
  }
  const grants = member.permissions.filter((item) => item.allowed).map((item) => item.permission.key).join(", ")
  const denials = member.permissions.filter((item) => !item.allowed).map((item) => item.permission.key).join(", ")
  const canManage = principal.permissions.includes("staff.manage")

  return (
    <>
      <header className="tl-page-header">
        <div>
          <nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/staff">Staff</Link><span>/</span><span>{member.name}</span></nav>
          <div className="tl-record-title"><span className="tl-large-avatar">{member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span><div><h1>{member.name}</h1><p>{member.email} · {member.role.name}</p></div><span className={`tl-status ${member.status.toLocaleLowerCase()}`}>{member.status.toLocaleLowerCase()}</span></div>
        </div>
      </header>
      {query.created && <div className="tl-alert tl-alert-success">Staff account created. The user must change their password and configure required two-factor authentication.</div>}
      {query.saved === "access" && <div className="tl-alert tl-alert-success">Role and permission overrides saved. Existing sessions were revoked.</div>}
      <section className="tl-summary-stat-grid">
        <article><span>Last login</span><strong>{member.lastLoginAt ? formatDateTime(member.lastLoginAt.toISOString()) : "Never"}</strong></article>
        <article><span>Last IP</span><strong>{member.lastIp ?? "—"}</strong></article>
        <article><span>Two-factor</span><strong>{member.twoFactorSecret?.verifiedAt && !member.twoFactorSecret.disabledAt ? "Enabled" : "Not enabled"}</strong></article>
        <article><span>Active sessions</span><strong>{member.sessions.filter((session) => !session.revokedAt).length}</strong></article>
        <article><span>Permissions</span><strong>{permissions.size}</strong></article>
        <article><span>Created</span><strong>{formatDateTime(member.createdAt.toISOString())}</strong></article>
      </section>
      <div className="tl-detail-grid">
        <div className="tl-detail-primary">
          <section className="tl-card"><div className="tl-card-header"><h2>Effective permissions</h2></div><div className="tl-permission-grid">{[...permissions].sort().map((permission) => <span key={permission}><ShieldCheck size={12} />{permission}</span>)}</div></section>
          <section className="tl-card"><div className="tl-card-header"><h2>Recent staff activity</h2></div><div className="tl-timeline tl-full-timeline">{member.auditLogs.map((log) => <div key={log.id}><span className={log.outcome === "SUCCESS" ? "success" : "danger"} /><p><strong>{log.action}</strong> {log.resourceType} {log.resourceId}<small>{formatDateTime(log.createdAt.toISOString())} · {log.outcome}</small></p></div>)}</div></section>
        </div>
        <aside className="tl-detail-aside">
          <section className="tl-card tl-record-meta"><div className="tl-card-header"><h2>Account</h2></div><dl><div><dt>Role</dt><dd>{member.role.name}</dd></div><div><dt>Status</dt><dd>{member.status}</dd></div><div><dt>Password reset</dt><dd>{member.forcePasswordReset ? "Required" : "No"}</dd></div><div><dt>2FA required</dt><dd>{member.requireTwoFactor ? "Yes" : "No"}</dd></div></dl></section>
          {canManage && <form className="tl-card tl-compact-form" action={updateStaffAccessAction}><div className="tl-card-header"><h2>Role & overrides</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="staffId" value={member.id} /><label>Role<select name="roleId" defaultValue={member.roleId}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label>Explicit grants<textarea name="grants" rows={4} defaultValue={grants} placeholder="orders.refund, reports.export" /></label><label>Explicit denials<textarea name="denials" rows={4} defaultValue={denials} placeholder="customers.delete" /></label><label className="tl-checkbox"><input name="requireTwoFactor" type="checkbox" defaultChecked={member.requireTwoFactor} /><span>Require two-factor</span></label><button className="tl-button tl-button-primary tl-button-wide" type="submit">Save access & revoke sessions</button></div></form>}
          {canManage && <form className="tl-card tl-compact-form" action={changeStaffStatusAction}><div className="tl-card-header"><h2>Account status</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="staffId" value={member.id} /><label>Status<select name="status" defaultValue={member.status === "ACTIVE" ? "ACTIVE" : "DISABLED"}><option>ACTIVE</option><option>DISABLED</option></select></label><button className="tl-button tl-button-primary tl-button-wide" type="submit">Update status & revoke sessions</button></div></form>}
          <Link className="tl-button tl-button-wide" href="/admin/security/password"><KeyRound size={14} />Password policy</Link>
        </aside>
      </div>
    </>
  )
}
