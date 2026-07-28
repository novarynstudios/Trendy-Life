import type { Metadata } from "next"

export const metadata: Metadata = { title: "Privacy policy" }

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" updated="26 July 2026">
    <h2>Information we collect</h2><p>We collect information you provide when placing an order, contacting support or subscribing to updates. This may include your name, contact details, delivery address and order history.</p>
    <h2>How we use it</h2><p>We use your information to process and deliver orders, provide customer support, prevent misuse, improve the store and send updates you requested.</p>
    <h2>Sharing and retention</h2><p>We only share information with service providers needed to operate the store, such as delivery partners. We do not sell personal information. Records are kept only as long as needed for operations, legal obligations and fraud prevention.</p>
    <h2>Your choices</h2><p>You can ask to review, correct or remove personal information, subject to any records we must retain. You can unsubscribe from marketing messages at any time.</p>
    <h2>Security</h2><p>We use reasonable technical and organizational safeguards. No online system is completely risk-free, so please contact us if you suspect unauthorized activity.</p>
  </LegalPage>
}

function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return <main id="main-content"><section className="page-hero compact"><div className="container"><p className="eyebrow">Legal</p><h1 className="display">{title}</h1><p>Last updated {updated}</p></div></section><article className="container legal-content">{children}</article></main>
}
