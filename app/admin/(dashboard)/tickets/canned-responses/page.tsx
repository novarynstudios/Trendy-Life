import Link from "next/link"
import { saveCannedResponseAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

type CannedValue = { name?: string; body?: string }

export default async function CannedResponsesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireStaff("support.manage")
  const [responses, csrfToken, query] = await Promise.all([prisma.storeSetting.findMany({ where: { namespace: "support.canned" }, orderBy: { key: "asc" } }), getCsrfToken(), searchParams])
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/tickets">Support</Link><span>/</span><span>Canned responses</span></nav><h1>Canned responses</h1><p>Reusable, plain-text support replies without executable template code.</p></div></header>{query.saved && <div className="tl-alert tl-alert-success">Canned response saved.</div>}<div className="tl-detail-grid"><section className="tl-card"><div className="tl-widget-list">{responses.map((response) => { const value = response.value as CannedValue; return <article key={response.id}><span><strong>{value.name ?? response.key}</strong><small>{value.body ?? ""}</small></span></article> })}{!responses.length && <p className="tl-widget-empty">No canned responses.</p>}</div></section><aside><form className="tl-card tl-compact-form" action={saveCannedResponseAction}><div className="tl-card-header"><h2>Add response</h2></div><div className="tl-card-body"><input type="hidden" name="_csrf" value={csrfToken} /><label>Name<input name="name" required /></label><label>Response<textarea name="body" rows={9} required /></label><button className="tl-button tl-button-primary tl-button-wide">Save response</button></div></form></aside></div></>
}
