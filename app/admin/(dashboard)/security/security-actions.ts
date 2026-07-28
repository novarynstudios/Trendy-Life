"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { writeAuditLog } from "@/src/server/audit/service"
import { assertCsrf } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"
import { decryptSecret, encryptSecret, sha256 } from "@/src/server/security/crypto"
import { generateTotpSecret, verifyTotp } from "@/src/server/security/totp"
import { hashPassword, validatePassword, verifyPassword } from "@/src/server/security/password"

export async function changeStaffPasswordAction(formData: FormData) {
  const principal = await assertCsrf(formData)
  const currentPassword = String(formData.get("currentPassword") ?? "")
  const password = String(formData.get("password") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "")
  if (password !== confirmation) redirect("/admin/security/password?error=mismatch")
  const staff = await prisma.staff.findUnique({ where: { id: principal.id }, include: { passwordHistory: { take: 5, orderBy: { createdAt: "desc" } } } })
  if (!staff || !await verifyPassword(staff.passwordHash, currentPassword)) redirect("/admin/security/password?error=current")
  const policy = validatePassword(password, [staff.name, staff.email])
  if (!policy.valid) redirect("/admin/security/password?error=policy")
  for (const history of [staff.passwordHash, ...staff.passwordHistory.map((entry) => entry.passwordHash)]) {
    if (await verifyPassword(history, password)) redirect("/admin/security/password?error=history")
  }
  const newHash = await hashPassword(password)
  await prisma.$transaction([
    prisma.passwordHistory.create({ data: { staffId: staff.id, passwordHash: staff.passwordHash } }),
    prisma.staff.update({ where: { id: staff.id }, data: { passwordHash: newHash, forcePasswordReset: false } }),
    prisma.staffSession.updateMany({ where: { staffId: staff.id, id: { not: principal.sessionId }, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "Password changed" } }),
  ])
  await writeAuditLog({ staffId: staff.id, action: "auth.password.change", resourceType: "Staff", resourceId: staff.id })
  redirect("/admin/security/password?saved=1")
}

export async function startTwoFactorSetupAction(formData: FormData) {
  const principal = await assertCsrf(formData)
  const secret = generateTotpSecret()
  await prisma.twoFactorSecret.upsert({
    where: { staffId: principal.id },
    create: { staffId: principal.id, encryptedSecret: encryptSecret(secret) },
    update: { encryptedSecret: encryptSecret(secret), verifiedAt: null, disabledAt: null },
  })
  await writeAuditLog({ staffId: principal.id, action: "auth.two_factor.setup.start", resourceType: "Staff", resourceId: principal.id })
  revalidatePath("/admin/security/two-factor")
  redirect("/admin/security/two-factor?setup=1")
}

export type TwoFactorSetupState = { ok: boolean; error?: string; recoveryCodes?: string[] }
export async function verifyTwoFactorSetupAction(_state: TwoFactorSetupState, formData: FormData): Promise<TwoFactorSetupState> {
  const principal = await assertCsrf(formData)
  const code = String(formData.get("code") ?? "").trim()
  const record = await prisma.twoFactorSecret.findUnique({ where: { staffId: principal.id } })
  if (!record || record.verifiedAt || !verifyTotp(decryptSecret(record.encryptedSecret), code)) return { ok: false, error: "The authenticator code was not accepted." }
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(6).toString("hex").toUpperCase())
  await prisma.$transaction([
    prisma.twoFactorSecret.update({ where: { id: record.id }, data: { verifiedAt: new Date() } }),
    prisma.staff.update({ where: { id: principal.id }, data: { requireTwoFactor: true } }),
    prisma.recoveryCode.deleteMany({ where: { staffId: principal.id } }),
    prisma.recoveryCode.createMany({ data: recoveryCodes.map((recoveryCode) => ({ staffId: principal.id, codeHash: sha256(recoveryCode) })) }),
    prisma.staffSession.update({ where: { id: principal.sessionId }, data: { twoFactorVerifiedAt: new Date() } }),
  ])
  await writeAuditLog({ staffId: principal.id, action: "auth.two_factor.enable", resourceType: "Staff", resourceId: principal.id })
  return { ok: true, recoveryCodes }
}
