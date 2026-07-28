"use server"

import { randomInt } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  createAdminSession, createCustomerSession, destroyAdminSession, destroyCustomerSession,
  getCustomer, registerCustomer, requireCustomer,
} from "@/lib/auth"
import { db, getCampaignByCode, getProductById, getSettings } from "@/lib/db"
import { createSSLCommerzSession } from "@/lib/sslcommerz"
import { createUddoktaCharge } from "@/lib/uddoktapay"
import { assertCsrf } from "@/src/server/auth/staff"
import { can, type PermissionKey } from "@/src/server/permissions"

export type FormState = { ok: boolean; message: string }

const clean = (value: FormDataEntryValue | null) => String(value || "").trim()
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

async function requireLegacyAdminAction(formData: FormData, permission: PermissionKey) {
  const principal = await assertCsrf(formData)
  if (!can(principal.permissions, permission)) throw new Error("Permission denied")
  return principal
}

export async function subscribeAction(_state: FormState, formData: FormData): Promise<FormState> {
  const email = clean(formData.get("email")).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email address." }
  db.prepare("INSERT OR IGNORE INTO subscribers (email) VALUES (?)").run(email)
  revalidatePath("/admin/subscribers")
  return { ok: true, message: "You’re on the list. Watch your inbox for the next edit." }
}

export async function contactAction(_state: FormState, formData: FormData): Promise<FormState> {
  const name = clean(formData.get("name"))
  const email = clean(formData.get("email")).toLowerCase()
  const phone = clean(formData.get("phone"))
  const subject = clean(formData.get("subject"))
  const message = clean(formData.get("message"))
  if (!name || !email || !subject || message.length < 10) {
    return { ok: false, message: "Please complete the required fields and include a little more detail." }
  }
  db.prepare("INSERT INTO messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)")
    .run(name, email, phone, subject, message)
  revalidatePath("/admin/inbox")
  return { ok: true, message: "Message received. Our team will get back to you shortly." }
}

export async function placeOrderAction(formData: FormData) {
  const customer = await getCustomer()
  const rawItems = clean(formData.get("items"))
  let cartItems: { id: number; quantity: number }[] = []
  try {
    cartItems = JSON.parse(rawItems) as { id: number; quantity: number }[]
  } catch {
    redirect("/cart?error=invalid-cart")
  }

  const normalized = cartItems
    .map((item) => ({ id: Number(item.id), quantity: Math.max(1, Math.min(20, Number(item.quantity))) }))
    .filter((item) => Number.isInteger(item.id) && Number.isInteger(item.quantity))
  if (!normalized.length) redirect("/cart?error=empty")

  const name = clean(formData.get("name"))
  const email = clean(formData.get("email")).toLowerCase()
  const phone = clean(formData.get("phone"))
  const address = clean(formData.get("address"))
  const city = clean(formData.get("city"))
  const paymentMethod = clean(formData.get("paymentMethod"))
  const couponCode = clean(formData.get("couponCode")).toUpperCase()
  const notes = clean(formData.get("notes"))
  if (!name || !email || !phone || !address || !city) redirect("/checkout?error=missing")
  if (paymentMethod !== "SSLCommerz" && paymentMethod !== "UddoktaPay" && paymentMethod !== "Cash on delivery") {
    redirect("/checkout?error=payment-method")
  }

  const products = normalized.map((item) => ({ product: getProductById(item.id), quantity: item.quantity }))
  if (products.some((item) => !item.product || item.product.status !== "active" || item.product.inventory < item.quantity)) {
    redirect("/cart?error=stock")
  }

  const subtotal = products.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0)
  const settings = getSettings()
  const shipping = subtotal >= settings.shippingThreshold ? 0 : settings.flatShipping
  const campaign = couponCode ? getCampaignByCode(couponCode, subtotal) : null
  const discountAmount = campaign
    ? campaign.discountType === "percentage"
      ? Math.round(subtotal * campaign.discountValue / 100)
      : Math.min(subtotal, campaign.discountValue)
    : 0
  const total = Math.max(0, subtotal + shipping - discountAmount)
  const stamp = new Date().toISOString().slice(2, 10).replaceAll("-", "")
  const orderNumber = `TL-${stamp}-${randomInt(1000, 9999)}`
  let orderId = 0

  db.exec("BEGIN IMMEDIATE")
  try {
    const result = db.prepare(`
      INSERT INTO orders (
        user_id, order_number, customer_name, email, phone, address, city, payment_method,
        subtotal, shipping, discount_code, discount_amount, total, payment_gateway, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer?.id || null, orderNumber, name, email, phone, address, city, paymentMethod,
      subtotal, shipping, campaign?.code || null, discountAmount, total,
      paymentMethod === "UddoktaPay" ? "uddoktapay" : paymentMethod === "SSLCommerz" ? "sslcommerz" : "manual", notes,
    )
    orderId = Number(result.lastInsertRowid)
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, sku, price, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const updateStock = db.prepare("UPDATE products SET inventory = inventory - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    for (const item of products) {
      const product = item.product!
      insertItem.run(orderId, product.id, product.name, product.sku, product.price, item.quantity, product.image)
      updateStock.run(item.quantity, product.id)
    }
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }

  revalidatePath("/admin")
  revalidatePath("/admin/orders")
  revalidatePath("/account")
  if (paymentMethod === "Cash on delivery") {
    redirect(`/order-success?order=${encodeURIComponent(orderNumber)}`)
  }
  const gateway = paymentMethod === "UddoktaPay" ? "uddoktapay" : "sslcommerz"
  const attempt = db.prepare(`
    INSERT INTO payment_attempts (order_id, gateway, invoice_id, amount, status)
    VALUES (?, ?, ?, ?, 'initiated')
  `).run(orderId, gateway, paymentMethod === "SSLCommerz" ? orderNumber : null, total)
  try {
    if (paymentMethod === "UddoktaPay") {
      const paymentUrl = await createUddoktaCharge({
        orderId,
        orderNumber,
        userId: customer?.id || null,
        name,
        email,
        amount: total,
      })
      redirect(paymentUrl)
    }
    const session = await createSSLCommerzSession({
      orderId,
      orderNumber,
      name,
      email,
      phone,
      address,
      city,
      amount: total,
    })
    db.prepare(`
      UPDATE payment_attempts SET invoice_id=?, raw_payload=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(session.transactionId, JSON.stringify({ sessionKey: session.sessionKey }), Number(attempt.lastInsertRowid))
    redirect(session.paymentUrl)
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) {
      throw error
    }
    db.prepare("UPDATE payment_attempts SET status='failed', raw_payload=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(error instanceof Error ? error.message : "Gateway error", Number(attempt.lastInsertRowid))
    redirect("/checkout?error=gateway")
  }
}

export async function customerRegisterAction(formData: FormData) {
  const name = clean(formData.get("name"))
  const email = clean(formData.get("email")).toLowerCase()
  const phone = clean(formData.get("phone"))
  const password = clean(formData.get("password"))
  const confirm = clean(formData.get("confirmPassword"))
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password !== confirm) {
    redirect("/account/register?error=invalid")
  }
  const result = await registerCustomer({ name, email, phone, password })
  if (!result.ok) redirect("/account/login?error=exists")
  redirect("/account")
}

export async function customerLoginAction(formData: FormData) {
  const email = clean(formData.get("email"))
  const password = clean(formData.get("password"))
  const next = clean(formData.get("next"))
  if (!await createCustomerSession(email, password)) redirect("/account/login?error=invalid")
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account")
}

export async function customerLogoutAction() {
  await destroyCustomerSession()
  redirect("/")
}

export async function updateCustomerProfileAction(formData: FormData) {
  const customer = await requireCustomer()
  const name = clean(formData.get("name"))
  const phone = clean(formData.get("phone"))
  const company = clean(formData.get("company"))
  const address = clean(formData.get("address"))
  const city = clean(formData.get("city"))
  if (!name) redirect("/account/profile?error=missing")
  db.prepare(`
    UPDATE customer_users SET name=?, phone=?, company=?, address=?, city=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, phone, company, address, city, customer.id)
  revalidatePath("/account")
  redirect("/account/profile?saved=1")
}

export async function createTicketAction(formData: FormData) {
  const customer = await requireCustomer()
  const subject = clean(formData.get("subject"))
  const department = clean(formData.get("department")) || "General"
  const priority = clean(formData.get("priority")) || "medium"
  const message = clean(formData.get("message"))
  if (!subject || message.length < 10) redirect("/account/tickets/new?error=missing")
  const ticketNumber = `TKT-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${randomInt(1000, 9999)}`
  const result = db.prepare(`
    INSERT INTO support_tickets (ticket_number, user_id, subject, department, priority, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(ticketNumber, customer.id, subject, department, priority, message)
  db.prepare("INSERT INTO ticket_replies (ticket_id, author_type, author_name, message) VALUES (?, 'customer', ?, ?)")
    .run(Number(result.lastInsertRowid), customer.name, message)
  revalidatePath("/account/tickets")
  revalidatePath("/admin/tickets")
  redirect(`/account/tickets/${Number(result.lastInsertRowid)}`)
}

export async function replyTicketAction(formData: FormData) {
  const customer = await requireCustomer()
  const ticketId = Number(formData.get("ticketId"))
  const message = clean(formData.get("message"))
  const owns = db.prepare("SELECT id FROM support_tickets WHERE id=? AND user_id=?").get(ticketId, customer.id)
  if (!owns || message.length < 2) redirect(`/account/tickets/${ticketId}?error=reply`)
  db.prepare("INSERT INTO ticket_replies (ticket_id, author_type, author_name, message) VALUES (?, 'customer', ?, ?)")
    .run(ticketId, customer.name, message)
  db.prepare("UPDATE support_tickets SET status='customer-reply', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(ticketId)
  revalidatePath(`/account/tickets/${ticketId}`)
  revalidatePath("/admin/tickets")
  redirect(`/account/tickets/${ticketId}`)
}

export async function adminLoginAction(formData: FormData) {
  const email = clean(formData.get("email"))
  const password = clean(formData.get("password"))
  const success = await createAdminSession(email, password)
  if (!success) redirect("/admin/login?error=invalid")
  redirect("/admin")
}

export async function adminLogoutAction() {
  await destroyAdminSession()
  redirect("/admin/login")
}

export async function saveProductAction(formData: FormData) {
  await requireLegacyAdminAction(formData, "products.manage")
  const id = Number(formData.get("id") || 0)
  const name = clean(formData.get("name"))
  const slug = slugify(clean(formData.get("slug")) || name)
  const category = clean(formData.get("category"))
  const description = clean(formData.get("description"))
  const price = Math.max(0, Number(formData.get("price") || 0))
  const comparePriceValue = Number(formData.get("comparePrice") || 0)
  const comparePrice = comparePriceValue > 0 ? comparePriceValue : null
  const sku = clean(formData.get("sku")).toUpperCase()
  const inventory = Math.max(0, Math.floor(Number(formData.get("inventory") || 0)))
  const status = clean(formData.get("status")) || "draft"
  const featured = formData.get("featured") ? 1 : 0
  const badge = clean(formData.get("badge")) || null
  const image = clean(formData.get("image"))
  const secondImage = clean(formData.get("secondImage")) || image

  if (!name || !slug || !category || !sku || !image || !description) {
    redirect(id ? `/admin/products/${id}?error=missing` : "/admin/products/new?error=missing")
  }

  if (id) {
    db.prepare(`
      UPDATE products SET slug=?, name=?, category=?, description=?, price=?, compare_price=?, sku=?,
        inventory=?, status=?, featured=?, badge=?, image=?, second_image=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(slug, name, category, description, price, comparePrice, sku, inventory, status, featured, badge, image, secondImage, id)
  } else {
    db.prepare(`
      INSERT INTO products (slug, name, category, description, price, compare_price, sku, inventory, status, featured, badge, image, second_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug, name, category, description, price, comparePrice, sku, inventory, status, featured, badge, image, secondImage)
  }
  revalidatePath("/")
  revalidatePath("/shop")
  revalidatePath("/admin/products")
  redirect("/admin/products?saved=1")
}

export async function archiveProductAction(formData: FormData) {
  await requireLegacyAdminAction(formData, "products.manage")
  const id = Number(formData.get("id"))
  db.prepare("UPDATE products SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id)
  revalidatePath("/shop")
  revalidatePath("/admin/products")
  redirect("/admin/products?archived=1")
}

export async function updateOrderAction(formData: FormData) {
  await requireLegacyAdminAction(formData, "orders.edit")
  const id = Number(formData.get("id"))
  const status = clean(formData.get("status"))
  const paymentStatus = clean(formData.get("paymentStatus"))
  db.prepare("UPDATE orders SET status=?, payment_status=? WHERE id=?").run(status, paymentStatus, id)
  revalidatePath("/admin")
  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${id}`)
  redirect(`/admin/orders/${id}?saved=1`)
}

export async function saveContentAction(formData: FormData) {
  await requireLegacyAdminAction(formData, "content.manage")
  const keys = ["announcement", "heroEyebrow", "heroTitle", "heroAccent", "heroDescription", "heroImage"]
  const update = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
  for (const key of keys) update.run(key, clean(formData.get(key)))
  revalidatePath("/")
  redirect("/admin/content?saved=1")
}

export async function saveSettingsAction(formData: FormData) {
  await requireLegacyAdminAction(formData, "settings.manage")
  const keys = ["storeName", "supportEmail", "supportPhone", "address", "shippingThreshold", "flatShipping", "currency"]
  const update = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
  for (const key of keys) update.run(key, clean(formData.get(key)))
  revalidatePath("/")
  revalidatePath("/checkout")
  redirect("/admin/settings?saved=1")
}

export async function markMessageReadAction(formData: FormData) {
  await requireLegacyAdminAction(formData, "support.manage")
  db.prepare("UPDATE messages SET status='read' WHERE id=?").run(Number(formData.get("id")))
  revalidatePath("/admin/inbox")
}

export async function saveCampaignAction(formData: FormData) {
  await requireLegacyAdminAction(formData, "marketing.manage")
  const id = Number(formData.get("id") || 0)
  const name = clean(formData.get("name"))
  const code = clean(formData.get("code")).toUpperCase()
  const title = clean(formData.get("title"))
  const description = clean(formData.get("description"))
  const discountType = clean(formData.get("discountType")) === "fixed" ? "fixed" : "percentage"
  const discountValue = Math.max(0, Number(formData.get("discountValue") || 0))
  const minOrder = Math.max(0, Number(formData.get("minOrder") || 0))
  const startsAt = new Date(clean(formData.get("startsAt"))).toISOString()
  const endsAt = new Date(clean(formData.get("endsAt"))).toISOString()
  const active = formData.get("active") ? 1 : 0
  const popupEnabled = formData.get("popupEnabled") ? 1 : 0
  const popupTitle = clean(formData.get("popupTitle"))
  const popupCopy = clean(formData.get("popupCopy"))
  const popupCta = clean(formData.get("popupCta")) || "Shop now"
  const popupImage = clean(formData.get("popupImage"))
  if (!name || !code || !title || !popupTitle) redirect("/admin/campaigns?error=missing")
  if (id) {
    db.prepare(`
      UPDATE campaigns SET name=?, code=?, title=?, description=?, discount_type=?,
        discount_value=?, min_order=?, starts_at=?, ends_at=?, active=?, popup_enabled=?,
        popup_title=?, popup_copy=?, popup_cta=?, popup_image=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, code, title, description, discountType, discountValue, minOrder, startsAt, endsAt, active, popupEnabled, popupTitle, popupCopy, popupCta, popupImage, id)
  } else {
    db.prepare(`
      INSERT INTO campaigns (name, code, title, description, discount_type, discount_value,
        min_order, starts_at, ends_at, active, popup_enabled, popup_title, popup_copy, popup_cta, popup_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, code, title, description, discountType, discountValue, minOrder, startsAt, endsAt, active, popupEnabled, popupTitle, popupCopy, popupCta, popupImage)
  }
  revalidatePath("/")
  revalidatePath("/admin/campaigns")
  redirect("/admin/campaigns?saved=1")
}

export async function adminReplyTicketAction(formData: FormData) {
  const admin = await requireLegacyAdminAction(formData, "support.reply")
  const ticketId = Number(formData.get("ticketId"))
  const message = clean(formData.get("message"))
  const status = clean(formData.get("status")) || "answered"
  if (!ticketId || message.length < 2) redirect("/admin/tickets?error=reply")
  db.prepare("INSERT INTO ticket_replies (ticket_id, author_type, author_name, message) VALUES (?, 'admin', ?, ?)")
    .run(ticketId, admin.name, message)
  db.prepare("UPDATE support_tickets SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status, ticketId)
  revalidatePath("/admin/tickets")
  revalidatePath(`/account/tickets/${ticketId}`)
  redirect(`/admin/tickets?ticket=${ticketId}`)
}
