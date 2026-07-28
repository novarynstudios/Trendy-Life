import Link from "next/link"
import { formatDateTime } from "@/lib/format"
import { requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function MediaLibraryPage() {
  await requireStaff("content.view")
  const media = await prisma.mediaAsset.findMany({ take: 500, orderBy: { createdAt: "desc" } })
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/content">Content</Link><span>/</span><span>Media</span></nav><h1>Media library</h1><p>Securely stored images and documents with immutable storage keys and metadata.</p></div></header><section className="tl-card"><div className="tl-table-scroll"><table className="tl-data-table"><thead><tr><th>File</th><th>MIME type</th><th>Dimensions</th><th>Size</th><th>Uploaded</th><th>Storage key</th></tr></thead><tbody>{media.map((asset) => <tr key={asset.id}><td><strong>{asset.originalName}</strong></td><td>{asset.mimeType}</td><td>{asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}</td><td>{(asset.sizeBytes / 1024).toFixed(1)} KB</td><td>{formatDateTime(asset.createdAt.toISOString())}</td><td><code>{asset.storageKey}</code></td></tr>)}{!media.length && <tr><td colSpan={6}><p className="tl-widget-empty">No media assets are stored.</p></td></tr>}</tbody></table></div></section></>
}
