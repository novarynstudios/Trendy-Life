import { CartProvider } from "@/components/cart-provider"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { CampaignPopup } from "@/components/campaign-popup"
import { getActivePopupCampaign, getSettings } from "@/lib/db"

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = getSettings()
  const campaign = getActivePopupCampaign()
  return (
    <CartProvider>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SiteHeader announcement={settings.announcement} />
      {children}
      <SiteFooter settings={settings} />
      <CampaignPopup campaign={campaign} />
    </CartProvider>
  )
}
