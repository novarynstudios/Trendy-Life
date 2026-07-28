import Link from "next/link"
import { saveHomepageConfigurationAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

type HomepageValue = { announcement?: string; heroTitle?: string; heroSubtitle?: string; featuredCollection?: string; enabled?: boolean }

export default async function HomepagePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireStaff("content.manage")
  const [record, csrfToken, query] = await Promise.all([prisma.storeSetting.findUnique({ where: { namespace_key: { namespace: "content", key: "homepage" } } }), getCsrfToken(), searchParams])
  const value = (record?.value ?? {}) as HomepageValue
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/content">Content</Link><span>/</span><span>Homepage</span></nav><h1>Homepage configuration</h1><p>Announcement, hero content, and featured collection settings used by the storefront.</p></div></header>{query.saved && <div className="tl-alert tl-alert-success">Homepage configuration saved.</div>}<form className="tl-card tl-form-section tl-narrow-form" action={saveHomepageConfigurationAction}><div className="tl-card-header"><h2>Storefront homepage</h2></div><div className="tl-card-body tl-form-grid"><input type="hidden" name="_csrf" value={csrfToken} /><label className="span-2">Announcement bar<input name="announcement" maxLength={240} defaultValue={value.announcement ?? ""} /></label><label className="span-2">Hero title<input name="heroTitle" required defaultValue={value.heroTitle ?? "Style for everyday life"} /></label><label className="span-2">Hero subtitle<textarea name="heroSubtitle" rows={3} defaultValue={value.heroSubtitle ?? ""} /></label><label>Featured collection slug<input name="featuredCollection" defaultValue={value.featuredCollection ?? ""} /></label><label className="tl-checkbox-field"><input name="enabled" type="checkbox" defaultChecked={value.enabled ?? true} /><span><strong>Publish homepage configuration</strong></span></label><div className="span-2"><button className="tl-button tl-button-primary">Save homepage</button></div></div></form></>
}
