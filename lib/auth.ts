import "server-only"

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import {
  beginStaffLogin,
  getStaffPrincipal,
  requireStaff,
  revokeCurrentStaffSession,
} from "@/src/server/auth/staff"

const customerCookieName = "trendy_life_customer"

function passwordMatches(password: string, passwordHash: string, salt: string) {
  const attempted = scryptSync(password, salt, 64)
  const expected = Buffer.from(passwordHash, "hex")
  return attempted.length === expected.length && timingSafeEqual(attempted, expected)
}

export async function createAdminSession(email: string, password: string) {
  const result = await beginStaffLogin(email, password)
  return result.ok && result.next !== "two_factor"
}

export async function getAdmin() {
  return getStaffPrincipal()
}

export async function requireAdmin() {
  return requireStaff()
}

export async function destroyAdminSession() {
  await revokeCurrentStaffSession()
}

async function setCustomerSession(userId: number) {
  const token = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
  db.prepare("DELETE FROM customer_sessions WHERE expires_at < ?").run(new Date().toISOString())
  db.prepare("INSERT INTO customer_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenHash, userId, expires.toISOString())
  const cookieStore = await cookies()
  cookieStore.set(customerCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  })
}

export async function registerCustomer(input: { name: string; email: string; phone: string; password: string }) {
  const existing = db.prepare("SELECT id FROM customer_users WHERE LOWER(email) = LOWER(?)").get(input.email) as { id: number } | undefined
  if (existing) return { ok: false as const, reason: "exists" }
  const salt = randomBytes(16).toString("hex")
  const passwordHash = scryptSync(input.password, salt, 64).toString("hex")
  const result = db.prepare(`
    INSERT INTO customer_users (name, email, phone, password_hash, salt)
    VALUES (?, ?, ?, ?, ?)
  `).run(input.name, input.email.toLowerCase(), input.phone, passwordHash, salt)
  await setCustomerSession(Number(result.lastInsertRowid))
  return { ok: true as const }
}

export async function createCustomerSession(email: string, password: string) {
  const user = db.prepare(`
    SELECT id, password_hash AS passwordHash, salt
    FROM customer_users WHERE LOWER(email) = LOWER(?)
  `).get(email) as { id: number; passwordHash: string; salt: string } | undefined
  if (!user || !passwordMatches(password, user.passwordHash, user.salt)) return false
  await setCustomerSession(user.id)
  return true
}

export async function getCustomer() {
  const token = (await cookies()).get(customerCookieName)?.value
  if (!token) return null
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const row = db.prepare(`
    SELECT customer_users.id, customer_users.name, customer_users.email,
      customer_users.phone, customer_users.company, customer_users.address,
      customer_users.city, customer_users.created_at AS createdAt
    FROM customer_sessions
    JOIN customer_users ON customer_users.id = customer_sessions.user_id
    WHERE customer_sessions.token_hash = ? AND customer_sessions.expires_at > ?
  `).get(tokenHash, new Date().toISOString()) as {
    id: number; name: string; email: string; phone: string; company: string;
    address: string; city: string; createdAt: string
  } | undefined
  if (!row) return null

  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    company: String(row.company),
    address: String(row.address),
    city: String(row.city),
    createdAt: String(row.createdAt),
  }
}

export async function requireCustomer() {
  const customer = await getCustomer()
  if (!customer) redirect("/account/login?next=/account")
  return customer
}

export async function destroyCustomerSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(customerCookieName)?.value
  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex")
    db.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").run(tokenHash)
  }
  cookieStore.delete(customerCookieName)
}
