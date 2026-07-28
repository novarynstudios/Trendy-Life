/* eslint-disable @next/next/no-img-element */
import QRCode from "qrcode"
import Link from "next/link"
import { redirect } from "next/navigation"
import { TwoFactorSetupForm } from "@/components/admin/two-factor-setup-form"
import { getCsrfToken, getStaffPrincipal } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"
import { decryptSecret } from "@/src/server/security/crypto"
import { totpUri } from "@/src/server/security/totp"
import { startTwoFactorSetupAction } from "../security-actions"

export default async function TwoFactorPage() {
  const [staff, csrfToken] = await Promise.all([getStaffPrincipal(), getCsrfToken()])
  if (!staff) redirect("/admin/login")
  const record = await prisma.twoFactorSecret.findUnique({ where: { staffId: staff.id } })
  const enabled = Boolean(record?.verifiedAt && !record.disabledAt)
  let secret = ""
  let qr = ""
  if (record && !record.verifiedAt) {
    secret = decryptSecret(record.encryptedSecret)
    qr = await QRCode.toDataURL(totpUri(secret, staff.email), { errorCorrectionLevel: "M", margin: 1, width: 240 })
  }
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><span>Security</span><span>/</span><span>Two-factor</span></nav><h1>Two-factor authentication</h1><p>Protect privileged access with time-based one-time passwords and hashed recovery codes.</p></div></header>{enabled ? <section className="tl-card tl-narrow-form"><div className="tl-card-header"><h2>Two-factor authentication is enabled</h2><span className="tl-status active">protected</span></div><div className="tl-card-body"><p>Your account requires an authenticator code after password verification.</p><Link className="tl-button" href="/admin/security">Review active sessions</Link></div></section> : !record ? <section className="tl-card tl-narrow-form"><div className="tl-card-header"><h2>Set up an authenticator</h2></div><div className="tl-card-body"><p>Generate a new encrypted TOTP secret and pair it with your authenticator app.</p><form action={startTwoFactorSetupAction}><input type="hidden" name="_csrf" value={csrfToken} /><button className="tl-button tl-button-primary" type="submit">Begin setup</button></form></div></section> : <section className="tl-card tl-two-factor-setup"><div className="tl-card-header"><h2>Scan and verify</h2></div><div className="tl-card-body"><div><img src={qr} alt="QR code for Trendy Life Admin two-factor setup" width={240} height={240} /><p>Manual secret</p><code>{secret}</code></div><TwoFactorSetupForm csrfToken={csrfToken} /></div></section>}</>
}
