"use server"

import { randomBytes } from "node:crypto"
import { redirect } from "next/navigation"
import { z } from "zod"
import { assertCsrf, beginStaffLogin, completeTwoFactorLogin, readPendingStaff, revokeCurrentStaffSession } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"
import { decryptSecret, encryptSecret, sha256 } from "@/src/server/security/crypto"
import { hashPassword, validatePassword } from "@/src/server/security/password"
import { rateLimit } from "@/src/server/security/rate-limit"
import { assertTrustedOrigin, requestMetadata } from "@/src/server/security/request"
import { verifyTotp } from "@/src/server/security/totp"
import { staffLoginSchema, twoFactorCodeSchema } from "@/src/validations/auth"

export async function staffLoginAction(formData: FormData) {
  const input = staffLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!input.success) redirect("/admin/login?error=invalid-input")
  const result = await beginStaffLogin(input.data.email, input.data.password)
  if (!result.ok) {
    if (result.reason === "rate_limited") redirect(`/admin/login?error=rate-limited&retry=${result.retryAfter}`)
    redirect("/admin/login?error=invalid")
  }
  if (result.next === "two_factor") redirect("/admin/verify")
  if (result.next === "setup_two_factor") redirect("/admin/security/two-factor")
  redirect("/admin")
}

export async function verifyTwoFactorLoginAction(formData: FormData) {
  const pending = await readPendingStaff()
  if (!pending?.twoFactorSecret?.verifiedAt || pending.twoFactorSecret.disabledAt) redirect("/admin/login?error=session-expired")
  const input = twoFactorCodeSchema.safeParse({ code: formData.get("code") })
  if (!input.success) redirect("/admin/verify?error=invalid-code")
  const request = await requestMetadata()
  const limiter = await rateLimit(`admin:two-factor:${pending.id}:${request.ipAddress ?? "unknown"}`, 6, 10 * 60)
  if (!limiter.allowed) redirect(`/admin/verify?error=rate-limited&retry=${limiter.retryAfter}`)

  const secret = decryptSecret(pending.twoFactorSecret.encryptedSecret)
  let accepted = verifyTotp(secret, input.data.code)
  if (!accepted) {
    const recoveryCode = await prisma.recoveryCode.findFirst({
      where: { staffId: pending.id, codeHash: sha256(input.data.code), usedAt: null },
    })
    if (recoveryCode) {
      await prisma.recoveryCode.update({ where: { id: recoveryCode.id }, data: { usedAt: new Date() } })
      accepted = true
    }
  }
  if (!accepted) redirect("/admin/verify?error=invalid-code")
  if (!await completeTwoFactorLogin(pending.id)) redirect("/admin/login?error=session-expired")
  redirect("/admin")
}

export async function staffLogoutAction(formData: FormData) {
  await assertCsrf(formData)
  await revokeCurrentStaffSession()
  redirect("/admin/login")
}

export async function requestStaffPasswordResetAction(formData: FormData) {
  await assertTrustedOrigin()
  const email = z.string().trim().email().max(254).safeParse(formData.get("email"))
  if (!email.success) redirect("/admin/forgot-password?sent=1")
  const request = await requestMetadata()
  const limiter = await rateLimit(`admin:password-reset:${request.ipAddress ?? "unknown"}:${sha256(email.data.toLocaleLowerCase())}`, 4, 60 * 60)
  if (limiter.allowed) {
    const staff = await prisma.staff.findUnique({ where: { email: email.data.toLocaleLowerCase() } })
    if (staff?.status === "ACTIVE") {
      const token = randomBytes(32).toString("base64url")
      const expiresAt = new Date(Date.now() + 30 * 60_000)
      const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/admin/reset-password?token=${encodeURIComponent(token)}`
      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({ where: { staffId: staff.id, usedAt: null }, data: { usedAt: new Date() } }),
        prisma.passwordResetToken.create({ data: { staffId: staff.id, tokenHash: sha256(token), expiresAt } }),
        prisma.backgroundJob.create({
          data: {
            queue: "email",
            name: "staff-password-reset",
            payload: {
              recipient: staff.email,
              subject: "Reset your Trendy Life Admin password",
              encryptedBody: encryptSecret(`<p>A password reset was requested for your Trendy Life Admin account.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes and can be used once.</p>`),
            },
          },
        }),
      ])
    }
  }
  redirect("/admin/forgot-password?sent=1")
}

export async function completeStaffPasswordResetAction(formData: FormData) {
  await assertTrustedOrigin()
  const input = z.object({
    token: z.string().min(32).max(200),
    password: z.string().min(12).max(128),
    confirmation: z.string(),
  }).safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  })
  if (!input.success || input.data.password !== input.data.confirmation) redirect(`/admin/reset-password?token=${encodeURIComponent(String(formData.get("token") ?? ""))}&error=validation`)
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(input.data.token) },
    include: { staff: true },
  })
  if (!reset?.staff || reset.usedAt || reset.expiresAt <= new Date()) redirect("/admin/reset-password?error=expired")
  const policy = validatePassword(input.data.password, [reset.staff.name, reset.staff.email])
  if (!policy.valid) redirect(`/admin/reset-password?token=${encodeURIComponent(input.data.token)}&error=policy`)
  const passwordHash = await hashPassword(input.data.password)
  await prisma.$transaction([
    prisma.staff.update({ where: { id: reset.staff.id }, data: { passwordHash, forcePasswordReset: false, failedLoginCount: 0, protectedUntil: null } }),
    prisma.passwordHistory.create({ data: { staffId: reset.staff.id, passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.staffSession.updateMany({ where: { staffId: reset.staff.id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "Password reset" } }),
  ])
  redirect("/admin/login?reset=1")
}
