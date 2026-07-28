import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/src/server/db/prisma"
import { writeAuditLog } from "@/src/server/audit/service"
import { evaluatePermissions, type PermissionKey } from "@/src/server/permissions"
import { randomToken, sha256, signValue, verifySignedValue } from "@/src/server/security/crypto"
import { verifyPassword } from "@/src/server/security/password"
import { rateLimit } from "@/src/server/security/rate-limit"
import { assertTrustedOrigin, requestMetadata } from "@/src/server/security/request"

const sessionCookieName = "tl_admin_session"
const csrfCookieName = "tl_admin_csrf"
const pendingCookieName = "tl_admin_pending"
const defaultIdleDurationMs = 30 * 60 * 1000
const defaultAbsoluteDurationMs = 12 * 60 * 60 * 1000
const pendingDurationMs = 5 * 60 * 1000

async function sessionDurations() {
  const settings = await prisma.storeSetting.findMany({
    where: { namespace: "security", key: { in: ["sessionIdleMinutes", "sessionAbsoluteHours"] } },
    select: { key: true, value: true },
  })
  const values = new Map(settings.map((setting) => [setting.key, Number(setting.value)]))
  const idleMinutes = Math.min(Math.max(values.get("sessionIdleMinutes") || 30, 5), 240)
  const absoluteHours = Math.min(Math.max(values.get("sessionAbsoluteHours") || 12, 1), 24)
  return {
    idleDurationMs: idleMinutes * 60 * 1_000 || defaultIdleDurationMs,
    absoluteDurationMs: absoluteHours * 60 * 60 * 1_000 || defaultAbsoluteDurationMs,
  }
}

export type StaffPrincipal = {
  id: string
  name: string
  email: string
  role: string
  status: "ACTIVE"
  permissions: string[]
  sessionId: string
  twoFactorEnabled: boolean
  forcePasswordReset: boolean
}

async function setSessionCookies(token: string, csrfToken: string, absoluteExpiresAt: Date) {
  const store = await cookies()
  const secure = process.env.NODE_ENV === "production"
  store.set(sessionCookieName, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/admin",
    expires: absoluteExpiresAt,
    priority: "high",
  })
  store.set(csrfCookieName, csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/admin",
    expires: absoluteExpiresAt,
    priority: "high",
  })
}

async function createStaffSession(staffId: string, twoFactorVerified: boolean) {
  const request = await requestMetadata()
  const { idleDurationMs, absoluteDurationMs } = await sessionDurations()
  const token = randomToken()
  const csrfToken = randomToken()
  const now = new Date()
  const absoluteExpiresAt = new Date(now.getTime() + absoluteDurationMs)
  await prisma.staffSession.create({
    data: {
      staffId,
      tokenHash: sha256(token),
      csrfSecretHash: sha256(csrfToken),
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      idleExpiresAt: new Date(now.getTime() + idleDurationMs),
      absoluteExpiresAt,
      twoFactorVerifiedAt: twoFactorVerified ? now : null,
    },
  })
  await setSessionCookies(token, csrfToken, absoluteExpiresAt)
  return absoluteExpiresAt
}

function pendingValue(staffId: string) {
  const payload = Buffer.from(JSON.stringify({ staffId, expiresAt: Date.now() + pendingDurationMs })).toString("base64url")
  return signValue(payload)
}

export async function beginStaffLogin(email: string, password: string) {
  await assertTrustedOrigin()
  const request = await requestMetadata()
  const normalizedEmail = email.trim().toLocaleLowerCase()
  const limiter = await rateLimit(`admin:login:${request.ipAddress ?? "unknown"}:${sha256(normalizedEmail)}`, 8, 15 * 60)
  if (!limiter.allowed) return { ok: false as const, reason: "rate_limited" as const, retryAfter: limiter.retryAfter }

  const [staff, globalTwoFactorSetting] = await Promise.all([
    prisma.staff.findUnique({
      where: { email: normalizedEmail },
      include: { role: true, twoFactorSecret: true },
    }),
    prisma.storeSetting.findUnique({ where: { namespace_key: { namespace: "security", key: "require2fa" } } }),
  ])
  const passwordValid = staff ? await verifyPassword(staff.passwordHash, password) : false
  const now = new Date()
  const protectedAccount = staff?.protectedUntil && staff.protectedUntil > now

  if (!staff || !passwordValid || staff.status !== "ACTIVE" || protectedAccount) {
    if (staff && !protectedAccount) {
      const failures = staff.failedLoginCount + 1
      const lockMinutes = failures >= 5 ? Math.min(30, 2 ** Math.min(failures - 5, 5)) : 0
      await prisma.staff.update({
        where: { id: staff.id },
        data: { failedLoginCount: failures, protectedUntil: lockMinutes ? new Date(Date.now() + lockMinutes * 60_000) : null },
      })
    }
    await writeAuditLog({
      staffId: staff?.id,
      action: "auth.login.failed",
      resourceType: "Staff",
      resourceId: staff?.id,
      outcome: "FAILURE",
      failureReason: protectedAccount ? "temporarily_protected" : "invalid_credentials",
    })
    return { ok: false as const, reason: "invalid" as const }
  }

  const enabledTwoFactor = Boolean(staff.twoFactorSecret?.verifiedAt && !staff.twoFactorSecret.disabledAt)
  const privilegedRole = ["Super Administrator", "Administrator", "Finance Manager"].includes(staff.role.name)
  const globalTwoFactorRequired = globalTwoFactorSetting?.value === true || globalTwoFactorSetting?.value === "true"
  const requiresEnrollment = staff.requireTwoFactor || (privilegedRole && globalTwoFactorRequired)
  await prisma.staff.update({
    where: { id: staff.id },
    data: { failedLoginCount: 0, protectedUntil: null, lastIp: request.ipAddress },
  })

  if (enabledTwoFactor) {
    const store = await cookies()
    store.set(pendingCookieName, pendingValue(staff.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/admin",
      maxAge: Math.floor(pendingDurationMs / 1000),
      priority: "high",
    })
    return { ok: true as const, next: "two_factor" as const }
  }

  await createStaffSession(staff.id, false)
  await prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date(), lastActiveAt: new Date() } })
  await writeAuditLog({ staffId: staff.id, action: "auth.login", resourceType: "Staff", resourceId: staff.id })
  return { ok: true as const, next: requiresEnrollment ? "setup_two_factor" as const : "dashboard" as const }
}

export async function readPendingStaff() {
  const signed = (await cookies()).get(pendingCookieName)?.value
  if (!signed) return null
  const value = verifySignedValue(signed)
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { staffId: string; expiresAt: number }
    if (parsed.expiresAt <= Date.now()) return null
    return prisma.staff.findUnique({ where: { id: parsed.staffId }, include: { twoFactorSecret: true } })
  } catch {
    return null
  }
}

export async function completeTwoFactorLogin(staffId: string) {
  const pending = await readPendingStaff()
  if (!pending || pending.id !== staffId) return false
  await createStaffSession(staffId, true)
  const store = await cookies()
  store.delete(pendingCookieName)
  await prisma.staff.update({
    where: { id: staffId },
    data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
  })
  await writeAuditLog({ staffId, action: "auth.login.two_factor", resourceType: "Staff", resourceId: staffId })
  return true
}

export async function getStaffPrincipal(): Promise<StaffPrincipal | null> {
  const store = await cookies()
  const token = store.get(sessionCookieName)?.value
  const csrfToken = store.get(csrfCookieName)?.value
  if (!token || !csrfToken) return null
  const session = await prisma.staffSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      staff: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
          permissions: { include: { permission: true } },
          twoFactorSecret: true,
        },
      },
    },
  })
  const now = new Date()
  if (
    !session ||
    session.revokedAt ||
    session.lockedAt ||
    session.idleExpiresAt <= now ||
    session.absoluteExpiresAt <= now ||
    session.staff.status !== "ACTIVE" ||
    sha256(csrfToken) !== session.csrfSecretHash
  ) return null

  if (now.getTime() - session.lastActiveAt.getTime() > 5 * 60_000) {
    const { idleDurationMs } = await sessionDurations()
    const idleExpiresAt = new Date(Math.min(now.getTime() + idleDurationMs, session.absoluteExpiresAt.getTime()))
    await prisma.$transaction([
      prisma.staffSession.update({ where: { id: session.id }, data: { lastActiveAt: now, idleExpiresAt } }),
      prisma.staff.update({ where: { id: session.staffId }, data: { lastActiveAt: now } }),
    ])
  }

  const rolePermissions = session.staff.role.permissions.map(({ permission }) => permission.key)
  const overrides = session.staff.permissions.map(({ permission, allowed }) => ({ key: permission.key, allowed }))
  const permissions = [...evaluatePermissions(rolePermissions, overrides)]
  const twoFactorEnabled = Boolean(session.staff.twoFactorSecret?.verifiedAt && !session.staff.twoFactorSecret.disabledAt)
  return {
    id: session.staff.id,
    name: session.staff.name,
    email: session.staff.email,
    role: session.staff.role.name,
    status: "ACTIVE",
    permissions,
    sessionId: session.id,
    twoFactorEnabled,
    forcePasswordReset: session.staff.forcePasswordReset,
  }
}

export async function requireStaff(permission?: PermissionKey | readonly PermissionKey[]) {
  const principal = await getStaffPrincipal()
  if (!principal) redirect("/admin/login")
  if (principal.forcePasswordReset) redirect("/admin/security/password")
  const required = permission ? (typeof permission === "string" ? [permission] : permission) : []
  if (required.some((key) => !principal.permissions.includes(key))) redirect("/admin/forbidden")
  return principal
}

export async function requireRecentAuthentication(maxAgeMinutes = 10) {
  const principal = await requireStaff()
  const session = await prisma.staffSession.findUnique({ where: { id: principal.sessionId } })
  const verifiedAt = session?.twoFactorVerifiedAt
  if (!verifiedAt || Date.now() - verifiedAt.getTime() > maxAgeMinutes * 60_000) {
    redirect("/admin/verify?reason=recent-authentication")
  }
  return principal
}

export async function getCsrfToken() {
  return (await cookies()).get(csrfCookieName)?.value ?? ""
}

export async function assertCsrf(formData: FormData) {
  await assertTrustedOrigin()
  const principal = await getStaffPrincipal()
  if (!principal) throw new Error("Authentication required")
  const submitted = String(formData.get("_csrf") ?? "")
  const cookieToken = (await cookies()).get(csrfCookieName)?.value ?? ""
  if (!submitted || !cookieToken || sha256(submitted) !== sha256(cookieToken)) throw new Error("CSRF validation failed")
  return principal
}

export async function revokeCurrentStaffSession(reason = "logout") {
  const store = await cookies()
  const token = store.get(sessionCookieName)?.value
  if (token) {
    const session = await prisma.staffSession.findUnique({ where: { tokenHash: sha256(token) } })
    if (session && !session.revokedAt) {
      await prisma.staffSession.update({ where: { id: session.id }, data: { revokedAt: new Date(), revokeReason: reason } })
      await writeAuditLog({ staffId: session.staffId, action: "auth.logout", resourceType: "StaffSession", resourceId: session.id })
    }
  }
  store.delete(sessionCookieName)
  store.delete(csrfCookieName)
  store.delete(pendingCookieName)
}

export async function lockCurrentStaffSession() {
  const principal = await requireStaff()
  await prisma.staffSession.update({ where: { id: principal.sessionId }, data: { lockedAt: new Date() } })
  await writeAuditLog({ staffId: principal.id, action: "auth.session.lock", resourceType: "StaffSession", resourceId: principal.sessionId })
  const store = await cookies()
  store.delete(sessionCookieName)
  store.delete(csrfCookieName)
}
