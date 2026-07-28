import { BadgePercent, Save } from "lucide-react"
import { saveCampaignAction } from "@/app/actions"
import { getCampaigns } from "@/lib/db"
import { formatDate } from "@/lib/format"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"

function localDate(value: string) {
  return new Date(value).toISOString().slice(0, 16)
}

export default async function AdminCampaignsPage({ searchParams }: { searchParams: Promise<{ saved?: string; edit?: string }> }) {
  await requireStaff("marketing.manage")
  const csrfToken = await getCsrfToken()
  const params = await searchParams
  const campaigns = getCampaigns()
  const selected = campaigns.find((campaign) => campaign.id === Number(params.edit)) || campaigns[0]
  return <>
    <div className="admin-page-head"><div><h1>Discount campaigns</h1><p>Manage checkout codes and the storefront promotional popup.</p></div><span className="admin-count-pill">{campaigns.filter((item) => item.active).length} active</span></div>
    {params.saved && <div className="admin-alert success">Campaign saved and storefront cache refreshed.</div>}
    <div className="campaign-admin-layout">
      <section className="admin-card"><div className="admin-card-head"><div><h2>Campaigns</h2><p>Select one to edit, or start a new configuration.</p></div><BadgePercent /></div><div className="campaign-admin-list">{campaigns.map((campaign) => <a className={selected?.id === campaign.id ? "active" : ""} href={`/admin/campaigns?edit=${campaign.id}`} key={campaign.id}><span><strong>{campaign.name}</strong><small>{campaign.code} · ends {formatDate(campaign.endsAt)}</small></span><b className={campaign.active ? "active" : ""}>{campaign.active ? "Active" : "Paused"}</b></a>)}</div></section>
      <form className="admin-card form-card" action={saveCampaignAction}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="id" value={selected?.id || ""} />
        <div className="admin-card-head"><div><h2>{selected ? `Edit ${selected.name}` : "New campaign"}</h2><p>Discount rules and popup message.</p></div></div>
        <div className="admin-form-grid two"><label><span>Internal name</span><input name="name" defaultValue={selected?.name} required /></label><label><span>Coupon code</span><input name="code" defaultValue={selected?.code} required /></label></div>
        <label><span>Customer-facing title</span><input name="title" defaultValue={selected?.title} required /></label>
        <label><span>Description</span><textarea name="description" rows={3} defaultValue={selected?.description} /></label>
        <div className="admin-form-grid two"><label><span>Discount type</span><select name="discountType" defaultValue={selected?.discountType || "percentage"}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label><label><span>Discount value</span><input name="discountValue" type="number" min="0" defaultValue={selected?.discountValue || 10} required /></label></div>
        <label><span>Minimum order (৳)</span><input name="minOrder" type="number" min="0" defaultValue={selected?.minOrder || 0} /></label>
        <div className="admin-form-grid two"><label><span>Starts</span><input name="startsAt" type="datetime-local" defaultValue={selected ? localDate(selected.startsAt) : "2026-01-01T00:00"} required /></label><label><span>Ends</span><input name="endsAt" type="datetime-local" defaultValue={selected ? localDate(selected.endsAt) : "2030-12-31T23:59"} required /></label></div>
        <div className="admin-form-grid two"><label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked={selected?.active ?? true} /><span><strong>Campaign active</strong><small>Allow this code at checkout</small></span></label><label className="admin-checkbox"><input name="popupEnabled" type="checkbox" defaultChecked={selected?.popupEnabled ?? true} /><span><strong>Show popup</strong><small>Display promotional dialog</small></span></label></div>
        <label><span>Popup heading</span><input name="popupTitle" defaultValue={selected?.popupTitle} required /></label>
        <label><span>Popup copy</span><textarea name="popupCopy" rows={3} defaultValue={selected?.popupCopy} /></label>
        <div className="admin-form-grid two"><label><span>Button label</span><input name="popupCta" defaultValue={selected?.popupCta || "Shop now"} /></label><label><span>Image path</span><input name="popupImage" defaultValue={selected?.popupImage} /></label></div>
        <button className="admin-button primary" type="submit"><Save /> Save campaign</button>
      </form>
    </div>
  </>
}
