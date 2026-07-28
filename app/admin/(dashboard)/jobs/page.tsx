import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { formatDateTime } from "@/lib/format"
import { retryBackgroundJobAction } from "../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string; queue?: string }> }) {
  await requireStaff("jobs.manage")
  const [query, csrfToken] = await Promise.all([searchParams, getCsrfToken()])
  const jobs = await prisma.backgroundJob.findMany({ where: { ...(["WAITING","ACTIVE","COMPLETED","FAILED","DELAYED","CANCELLED"].includes(query.status ?? "") ? { status: query.status as "WAITING" } : {}), ...(query.queue ? { queue: query.queue } : {}) }, take: 250, orderBy: { createdAt: "desc" } })
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Background jobs</span></nav><h1>Background jobs</h1><p>Email, notification, invoice, import, export, webhook, report, session, inventory, and abandoned-cart queues.</p></div></header><section className="tl-card"><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>Job</th><th>Queue</th><th>Status</th><th>Attempts</th><th>Scheduled</th><th>Created</th><th>Last error</th><th>Action</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td><strong>{job.name}</strong><small>{job.externalId}</small></td><td>{job.queue}</td><td><span className={`tl-status ${job.status.toLocaleLowerCase()}`}>{job.status.toLocaleLowerCase()}</span></td><td>{job.attempts} / {job.maxAttempts}</td><td>{job.runAt ? formatDateTime(job.runAt.toISOString()) : "Immediate"}</td><td>{formatDateTime(job.createdAt.toISOString())}</td><td>{job.lastError ?? "—"}</td><td>{job.status === "FAILED" ? <form action={retryBackgroundJobAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="jobId" value={job.id} /><button className="tl-table-action" type="submit"><RefreshCw size={12} />Retry</button></form> : "—"}</td></tr>)}</tbody></table></div></section></>
}
