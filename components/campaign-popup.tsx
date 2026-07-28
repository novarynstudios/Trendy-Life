"use client"

import Image from "next/image"
import Link from "next/link"
import { BadgePercent, Copy, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { Campaign } from "@/lib/types"

export function CampaignPopup({ campaign }: { campaign: Campaign | null }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!campaign || window.localStorage.getItem(`campaign-dismissed-${campaign.id}`)) return
    const timer = window.setTimeout(() => setOpen(true), 900)
    return () => window.clearTimeout(timer)
  }, [campaign])
  if (!campaign || !open) return null
  function dismiss() {
    window.localStorage.setItem(`campaign-dismissed-${campaign!.id}`, "1")
    setOpen(false)
  }
  async function copyCode() {
    await navigator.clipboard.writeText(campaign!.code)
    setCopied(true)
  }
  return <div className="campaign-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
    <section className="campaign-popup" role="dialog" aria-modal="true" aria-labelledby="campaign-title">
      <button className="campaign-close" type="button" onClick={dismiss} aria-label="Close offer"><X /></button>
      {campaign.popupImage && <div className="campaign-image"><Image src={campaign.popupImage} alt="" fill sizes="(max-width: 620px) 100vw, 320px" /></div>}
      <div className="campaign-copy"><span className="campaign-icon"><BadgePercent /></span><p className="eyebrow">Limited-time offer</p><h2 id="campaign-title" className="display">{campaign.popupTitle}</h2><p>{campaign.popupCopy}</p><button className="campaign-code" type="button" onClick={copyCode}><span>{campaign.code}</span><small>{copied ? "Copied" : "Copy code"} <Copy /></small></button><Link className="button button-accent button-wide" href={`/shop?campaign=${encodeURIComponent(campaign.code)}`} onClick={dismiss}>{campaign.popupCta}</Link></div>
    </section>
  </div>
}
