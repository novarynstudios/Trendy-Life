import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { db, getOrderItems } from "@/lib/db"

export type ClientAddress = {
  id: number
  userId: number
  type: "billing" | "shipping" | "other"
  label: string
  fullName: string
  company: string
  phone: string
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  country: string
  defaultBilling: boolean
  defaultShipping: boolean
  createdAt: string
}

export type ClientInvoice = {
  id: number
  userId: number
  orderId: number
  invoiceNumber: string
  status: string
  currency: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  shippingTotal: number
  creditTotal: number
  total: number
  paidAmount: number
  balanceDue: number
  issueDate: string
  dueDate: string
  paidDate: string | null
  notes: string
  terms: string
  sellerSnapshot: string
  customerSnapshot: string
  billingSnapshot: string
  orderNumber: string
}

function columns(table: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
}

function ensureColumn(table: string, name: string, definition: string) {
  if (!columns(table).some((column) => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
  }
}

function initializeClientSchema() {
  ensureColumn("customer_users", "email_verified_at", "TEXT")
  ensureColumn("customer_users", "pending_email", "TEXT")
  ensureColumn("customer_users", "tax_id", "TEXT NOT NULL DEFAULT ''")
  ensureColumn("customer_users", "locale", "TEXT NOT NULL DEFAULT 'en-BD'")
  ensureColumn("customer_users", "currency", "TEXT NOT NULL DEFAULT 'BDT'")
  ensureColumn("customer_users", "timezone", "TEXT NOT NULL DEFAULT 'Asia/Dhaka'")
  ensureColumn("customer_users", "avatar_url", "TEXT NOT NULL DEFAULT ''")
  ensureColumn("customer_users", "last_login_at", "TEXT")
  ensureColumn("customer_users", "failed_login_count", "INTEGER NOT NULL DEFAULT 0")
  ensureColumn("customer_users", "protected_until", "TEXT")
  ensureColumn("customer_sessions", "last_active_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")
  ensureColumn("customer_sessions", "ip_address", "TEXT")
  ensureColumn("customer_sessions", "user_agent", "TEXT")
  ensureColumn("customer_sessions", "device_name", "TEXT")
  ensureColumn("customer_sessions", "revoked_at", "TEXT")
  ensureColumn("customer_sessions", "revoke_reason", "TEXT")
  ensureColumn("support_tickets", "related_order_id", "INTEGER")
  ensureColumn("support_tickets", "assigned_staff_name", "TEXT")
  ensureColumn("support_tickets", "resolved_at", "TEXT")
  ensureColumn("support_tickets", "closed_at", "TEXT")
  ensureColumn("support_tickets", "last_customer_reply_at", "TEXT")
  ensureColumn("support_tickets", "last_staff_reply_at", "TEXT")
  ensureColumn("ticket_replies", "is_internal", "INTEGER NOT NULL DEFAULT 0")

  db.exec(`
    CREATE TABLE IF NOT EXISTS client_sequences (
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      value INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (name, year)
    );
    CREATE TABLE IF NOT EXISTS customer_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL DEFAULT '{}',
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_customer_tokens_lookup ON customer_tokens(token_hash, purpose, expires_at, used_at);
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('billing','shipping','other')),
      label TEXT NOT NULL DEFAULT '',
      full_name TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      line1 TEXT NOT NULL,
      line2 TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT '',
      postal_code TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'BD',
      default_billing INTEGER NOT NULL DEFAULT 0 CHECK(default_billing IN (0,1)),
      default_shipping INTEGER NOT NULL DEFAULT 0 CHECK(default_shipping IN (0,1)),
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_customer_addresses_user ON customer_addresses(user_id, deleted_at, type);
    CREATE TABLE IF NOT EXISTS order_status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      customer_visible INTEGER NOT NULL DEFAULT 1 CHECK(customer_visible IN (0,1)),
      actor_type TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_order_status_events_order ON order_status_events(order_id, customer_visible, created_at);
    CREATE TABLE IF NOT EXISTS client_shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      shipment_number TEXT NOT NULL UNIQUE,
      courier TEXT NOT NULL DEFAULT '',
      tracking_number TEXT NOT NULL DEFAULT '',
      tracking_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'preparing',
      estimated_delivery_at TEXT,
      dispatched_at TEXT,
      delivered_at TEXT,
      customer_note TEXT NOT NULL DEFAULT '',
      internal_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_client_shipments_order ON client_shipments(order_id, created_at);
    CREATE TABLE IF NOT EXISTS client_shipment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      customer_visible INTEGER NOT NULL DEFAULT 1 CHECK(customer_visible IN (0,1)),
      location TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shipment_id) REFERENCES client_shipments(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_client_shipment_events ON client_shipment_events(shipment_id, customer_visible, created_at);
    CREATE TABLE IF NOT EXISTS client_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL UNIQUE,
      invoice_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('draft','issued','unpaid','partially-paid','paid','overdue','void','refunded')),
      currency TEXT NOT NULL DEFAULT 'BDT',
      subtotal INTEGER NOT NULL,
      discount_total INTEGER NOT NULL DEFAULT 0,
      tax_total INTEGER NOT NULL DEFAULT 0,
      shipping_total INTEGER NOT NULL DEFAULT 0,
      credit_total INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      balance_due INTEGER NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      paid_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      terms TEXT NOT NULL DEFAULT '',
      seller_snapshot TEXT NOT NULL,
      customer_snapshot TEXT NOT NULL,
      billing_snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE RESTRICT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_client_invoices_user ON client_invoices(user_id, status, issue_date);
    CREATE TABLE IF NOT EXISTS client_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      tax INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (invoice_id) REFERENCES client_invoices(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_client_invoice_items ON client_invoice_items(invoice_id);
    CREATE TABLE IF NOT EXISTS client_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      href TEXT NOT NULL DEFAULT '',
      read_at TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_client_notifications_user ON client_notifications(user_id, archived_at, read_at, created_at);
    CREATE TABLE IF NOT EXISTS client_notification_preferences (
      user_id INTEGER PRIMARY KEY,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      order_updates INTEGER NOT NULL DEFAULT 1,
      payment_updates INTEGER NOT NULL DEFAULT 1,
      ticket_updates INTEGER NOT NULL DEFAULT 1,
      security_updates INTEGER NOT NULL DEFAULT 1,
      marketing_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS client_security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_client_security_events ON client_security_events(user_id, created_at);
    CREATE TABLE IF NOT EXISTS client_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      request_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_client_audit_entity ON client_audit_logs(entity_type, entity_id, created_at);
    CREATE TABLE IF NOT EXISTS client_email_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      template TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      html_body TEXT NOT NULL,
      text_body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      provider_id TEXT,
      failure_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at TEXT,
      FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_client_email_outbox ON client_email_outbox(status, created_at);
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reply_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      scan_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reply_id) REFERENCES ticket_replies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ticket_attachments_reply ON ticket_attachments(reply_id);
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS prevent_client_audit_update
    BEFORE UPDATE ON client_audit_logs BEGIN SELECT RAISE(ABORT, 'audit logs are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS prevent_client_audit_delete
    BEFORE DELETE ON client_audit_logs BEGIN SELECT RAISE(ABORT, 'audit logs are append-only'); END;
  `)
}

initializeClientSchema()

export function allocateNumber(sequence: "invoice" | "ticket" | "shipment", prefix: string) {
  const year = new Date().getUTCFullYear()
  db.prepare(`
    INSERT INTO client_sequences(name, year, value) VALUES (?, ?, 1)
    ON CONFLICT(name, year) DO UPDATE SET value=value+1
  `).run(sequence, year)
  const row = db.prepare("SELECT value FROM client_sequences WHERE name=? AND year=?").get(sequence, year) as { value: number }
  return `${prefix}-${year}-${String(row.value).padStart(6, "0")}`
}

export function auditClient(input: {
  actorType: "customer" | "staff" | "system"
  actorId?: string | number
  action: string
  entityType: string
  entityId?: string | number
  requestId?: string
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, string | number | boolean | null>
}) {
  db.prepare(`
    INSERT INTO client_audit_logs(actor_type, actor_id, action, entity_type, entity_id, request_id, ip_address, user_agent, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(input.actorType, input.actorId == null ? null : String(input.actorId), input.action, input.entityType,
    input.entityId == null ? null : String(input.entityId), input.requestId ?? crypto.randomUUID(),
    input.ipAddress ?? null, input.userAgent ?? null, JSON.stringify(input.metadata ?? {}))
}

export function securityEvent(userId: number, type: string, description: string, ipAddress?: string | null, userAgent?: string | null) {
  db.prepare("INSERT INTO client_security_events(user_id,type,description,ip_address,user_agent) VALUES (?,?,?,?,?)")
    .run(userId, type, description, ipAddress ?? null, userAgent ?? null)
}

export function notify(userId: number, type: string, title: string, body: string, href = "") {
  const preference = db.prepare("SELECT in_app_enabled AS enabled FROM client_notification_preferences WHERE user_id=?")
    .get(userId) as { enabled: number } | undefined
  if (preference?.enabled === 0 && type !== "security") return
  db.prepare("INSERT INTO client_notifications(user_id,type,title,body,href) VALUES (?,?,?,?,?)")
    .run(userId, type, title, body, href)
}

function invoicePrefix() {
  const setting = db.prepare("SELECT value FROM settings WHERE key='invoicePrefix'").get() as { value: string } | undefined
  return (setting?.value || process.env.INVOICE_PREFIX || "INV").replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "INV"
}

export function ensureInvoiceForOrder(userId: number, orderId: number) {
  const current = db.prepare("SELECT id FROM client_invoices WHERE user_id=? AND order_id=?").get(userId, orderId) as { id: number } | undefined
  if (current) return current.id
  const order = db.prepare(`
    SELECT id,order_number AS orderNumber,customer_name AS customerName,email,phone,address,city,
      subtotal,shipping,discount_amount AS discountAmount,total,payment_status AS paymentStatus,
      payment_method AS paymentMethod,created_at AS createdAt
    FROM orders WHERE id=? AND user_id=?
  `).get(orderId, userId) as {
    id: number; orderNumber: string; customerName: string; email: string; phone: string; address: string; city: string
    subtotal: number; shipping: number; discountAmount: number; total: number; paymentStatus: string; paymentMethod: string; createdAt: string
  } | undefined
  if (!order) throw new Error("Order not found")
  const settings = Object.fromEntries((db.prepare("SELECT key,value FROM settings").all() as { key: string; value: string }[]).map((row) => [row.key, row.value]))
  const issue = new Date(order.createdAt)
  const due = new Date(issue.getTime() + 7 * 86400000)
  const paid = order.paymentStatus === "paid"
  db.exec("BEGIN IMMEDIATE")
  try {
    const invoiceNumber = allocateNumber("invoice", invoicePrefix())
    const result = db.prepare(`
      INSERT INTO client_invoices(user_id,order_id,invoice_number,status,currency,subtotal,discount_total,tax_total,
        shipping_total,credit_total,total,paid_amount,balance_due,issue_date,due_date,paid_date,notes,terms,
        seller_snapshot,customer_snapshot,billing_snapshot)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(userId, order.id, invoiceNumber, paid ? "paid" : "unpaid", settings.currency || "BDT",
      order.subtotal, order.discountAmount, 0, order.shipping, 0, order.total, paid ? order.total : 0,
      paid ? 0 : order.total, issue.toISOString(), due.toISOString(), paid ? new Date().toISOString() : null,
      "", "Payment is due by the date shown. Please quote the invoice number with any offline payment.",
      JSON.stringify({ name: settings.storeName || "Trendy Life", email: settings.supportEmail || "", phone: settings.supportPhone || "", address: settings.address || "" }),
      JSON.stringify({ name: order.customerName, email: order.email, phone: order.phone }),
      JSON.stringify({ name: order.customerName, line1: order.address, city: order.city, country: "BD" }))
    const invoiceId = Number(result.lastInsertRowid)
    const insert = db.prepare(`
      INSERT INTO client_invoice_items(invoice_id,description,sku,quantity,unit_price,discount,tax,total,image)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    for (const item of getOrderItems(order.id)) {
      insert.run(invoiceId, item.name, item.sku, item.quantity, item.price, 0, 0, item.price * item.quantity, item.image)
    }
    db.exec("COMMIT")
    return invoiceId
  } catch (error) {
    db.exec("ROLLBACK")
    const raced = db.prepare("SELECT id FROM client_invoices WHERE user_id=? AND order_id=?").get(userId, orderId) as { id: number } | undefined
    if (raced) return raced.id
    throw error
  }
}

export function backfillClientOrderData(userId: number) {
  const orders = db.prepare("SELECT id,status,created_at AS createdAt FROM orders WHERE user_id=?").all(userId) as { id: number; status: string; createdAt: string }[]
  for (const order of orders) {
    const event = db.prepare("SELECT id FROM order_status_events WHERE order_id=? LIMIT 1").get(order.id)
    if (!event) db.prepare("INSERT INTO order_status_events(order_id,status,message,created_at) VALUES (?,?,?,?)")
      .run(order.id, order.status, "Order received by Trendy Life.", order.createdAt)
    ensureInvoiceForOrder(userId, order.id)
  }
}

export function getClientInvoices(userId: number, input: { q?: string; status?: string; page?: number; pageSize?: number } = {}) {
  backfillClientOrderData(userId)
  const conditions = ["i.user_id=?"]
  const values: (string | number)[] = [userId]
  if (input.q) {
    conditions.push("(i.invoice_number LIKE ? OR o.order_number LIKE ?)")
    values.push(`%${input.q}%`, `%${input.q}%`)
  }
  if (input.status && ["unpaid", "paid", "overdue", "partially-paid", "refunded", "void"].includes(input.status)) {
    conditions.push("i.status=?")
    values.push(input.status)
  }
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 10))
  const page = Math.max(1, input.page ?? 1)
  const total = Number((db.prepare(`SELECT COUNT(*) AS count FROM client_invoices i JOIN orders o ON o.id=i.order_id WHERE ${conditions.join(" AND ")}`)
    .get(...values) as { count: number }).count)
  const rows = db.prepare(`
    SELECT i.id,i.user_id AS userId,i.order_id AS orderId,i.invoice_number AS invoiceNumber,i.status,i.currency,
      i.subtotal,i.discount_total AS discountTotal,i.tax_total AS taxTotal,i.shipping_total AS shippingTotal,
      i.credit_total AS creditTotal,i.total,i.paid_amount AS paidAmount,i.balance_due AS balanceDue,
      i.issue_date AS issueDate,i.due_date AS dueDate,i.paid_date AS paidDate,i.notes,i.terms,
      i.seller_snapshot AS sellerSnapshot,i.customer_snapshot AS customerSnapshot,i.billing_snapshot AS billingSnapshot,
      o.order_number AS orderNumber
    FROM client_invoices i JOIN orders o ON o.id=i.order_id
    WHERE ${conditions.join(" AND ")} ORDER BY i.issue_date DESC LIMIT ? OFFSET ?
  `).all(...values, pageSize, (page - 1) * pageSize) as unknown as ClientInvoice[]
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

export function getClientInvoice(userId: number, invoiceId: number) {
  const row = db.prepare(`
    SELECT i.id,i.user_id AS userId,i.order_id AS orderId,i.invoice_number AS invoiceNumber,i.status,i.currency,
      i.subtotal,i.discount_total AS discountTotal,i.tax_total AS taxTotal,i.shipping_total AS shippingTotal,
      i.credit_total AS creditTotal,i.total,i.paid_amount AS paidAmount,i.balance_due AS balanceDue,
      i.issue_date AS issueDate,i.due_date AS dueDate,i.paid_date AS paidDate,i.notes,i.terms,
      i.seller_snapshot AS sellerSnapshot,i.customer_snapshot AS customerSnapshot,i.billing_snapshot AS billingSnapshot,
      o.order_number AS orderNumber
    FROM client_invoices i JOIN orders o ON o.id=i.order_id WHERE i.id=? AND i.user_id=?
  `).get(invoiceId, userId) as unknown as ClientInvoice | undefined
  if (!row) return null
  const items = db.prepare(`
    SELECT id,description,sku,quantity,unit_price AS unitPrice,discount,tax,total,image
    FROM client_invoice_items WHERE invoice_id=? ORDER BY id
  `).all(invoiceId) as { id: number; description: string; sku: string; quantity: number; unitPrice: number; discount: number; tax: number; total: number; image: string }[]
  const attempts = db.prepare(`
    SELECT id,gateway,status,payment_method AS paymentMethod,transaction_id AS transactionId,amount,created_at AS createdAt
    FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC
  `).all(row.orderId) as { id: number; gateway: string; status: string; paymentMethod: string; transactionId: string | null; amount: number; createdAt: string }[]
  return { ...row, items, attempts }
}

export function getAddresses(userId: number) {
  const rows = db.prepare(`
    SELECT id,user_id AS userId,type,label,full_name AS fullName,company,phone,line1,line2,city,region,
      postal_code AS postalCode,country,default_billing AS defaultBilling,default_shipping AS defaultShipping,
      created_at AS createdAt FROM customer_addresses WHERE user_id=? AND deleted_at IS NULL ORDER BY default_shipping DESC,created_at DESC
  `).all(userId) as unknown as (Omit<ClientAddress, "defaultBilling" | "defaultShipping"> & { defaultBilling: number; defaultShipping: number })[]
  return rows.map((row) => ({ ...row, defaultBilling: Boolean(row.defaultBilling), defaultShipping: Boolean(row.defaultShipping) }))
}

export function getOrderTimeline(userId: number, orderId: number) {
  const owns = db.prepare("SELECT id FROM orders WHERE id=? AND user_id=?").get(orderId, userId)
  if (!owns) return null
  return db.prepare(`
    SELECT id,status,message,actor_type AS actorType,created_at AS createdAt
    FROM order_status_events WHERE order_id=? AND customer_visible=1 ORDER BY created_at ASC,id ASC
  `).all(orderId) as { id: number; status: string; message: string; actorType: string; createdAt: string }[]
}

export function getShipments(userId: number, orderId: number) {
  const owns = db.prepare("SELECT id FROM orders WHERE id=? AND user_id=?").get(orderId, userId)
  if (!owns) return []
  const shipments = db.prepare(`
    SELECT id,shipment_number AS shipmentNumber,courier,tracking_number AS trackingNumber,tracking_url AS trackingUrl,
      status,estimated_delivery_at AS estimatedDeliveryAt,dispatched_at AS dispatchedAt,delivered_at AS deliveredAt,
      customer_note AS customerNote,created_at AS createdAt FROM client_shipments WHERE order_id=? ORDER BY created_at
  `).all(orderId) as { id: number; shipmentNumber: string; courier: string; trackingNumber: string; trackingUrl: string; status: string; estimatedDeliveryAt: string | null; dispatchedAt: string | null; deliveredAt: string | null; customerNote: string; createdAt: string }[]
  return shipments.map((shipment) => ({
    ...shipment,
    events: db.prepare(`
      SELECT id,status,message,location,created_at AS createdAt FROM client_shipment_events
      WHERE shipment_id=? AND customer_visible=1 ORDER BY created_at,id
    `).all(shipment.id) as { id: number; status: string; message: string; location: string; createdAt: string }[],
  }))
}

export function notificationData(userId: number, input: { q?: string; unread?: boolean; page?: number } = {}) {
  const conditions = ["user_id=?", "archived_at IS NULL"]
  const values: (string | number)[] = [userId]
  if (input.q) {
    conditions.push("(title LIKE ? OR body LIKE ?)")
    values.push(`%${input.q}%`, `%${input.q}%`)
  }
  if (input.unread) conditions.push("read_at IS NULL")
  const page = Math.max(1, input.page ?? 1)
  const pageSize = 15
  const total = Number((db.prepare(`SELECT COUNT(*) AS count FROM client_notifications WHERE ${conditions.join(" AND ")}`).get(...values) as { count: number }).count)
  const rows = db.prepare(`
    SELECT id,type,title,body,href,read_at AS readAt,created_at AS createdAt FROM client_notifications
    WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...values, pageSize, (page - 1) * pageSize) as { id: number; type: string; title: string; body: string; href: string; readAt: string | null; createdAt: string }[]
  const unread = Number((db.prepare("SELECT COUNT(*) AS count FROM client_notifications WHERE user_id=? AND read_at IS NULL AND archived_at IS NULL").get(userId) as { count: number }).count)
  return { rows, unread, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

export function getPaymentHistory(userId: number, input: { q?: string; status?: string; page?: number } = {}) {
  const conditions = ["o.user_id=?"]
  const values: (string | number)[] = [userId]
  if (input.q) {
    conditions.push("(o.order_number LIKE ? OR p.transaction_id LIKE ? OR p.invoice_id LIKE ?)")
    values.push(`%${input.q}%`, `%${input.q}%`, `%${input.q}%`)
  }
  if (input.status && ["initiated", "completed", "failed", "cancelled"].includes(input.status)) {
    conditions.push("p.status=?")
    values.push(input.status)
  }
  const page = Math.max(1, input.page ?? 1)
  const pageSize = 15
  const total = Number((db.prepare(`SELECT COUNT(*) AS count FROM payment_attempts p JOIN orders o ON o.id=p.order_id WHERE ${conditions.join(" AND ")}`).get(...values) as { count: number }).count)
  const rows = db.prepare(`
    SELECT p.id,p.order_id AS orderId,o.order_number AS orderNumber,p.gateway,p.invoice_id AS providerReference,
      p.amount,p.status,p.payment_method AS paymentMethod,p.transaction_id AS transactionId,p.created_at AS createdAt
    FROM payment_attempts p JOIN orders o ON o.id=p.order_id WHERE ${conditions.join(" AND ")}
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(...values, pageSize, (page - 1) * pageSize) as { id: number; orderId: number; orderNumber: string; gateway: string; providerReference: string | null; amount: number; status: string; paymentMethod: string; transactionId: string | null; createdAt: string }[]
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

export function savePrivateAttachment(replyId: number, file: File) {
  const allowed: Record<string, string[]> = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "text/plain": [".txt"],
  }
  const extension = path.extname(file.name).toLowerCase()
  if (!allowed[file.type]?.includes(extension)) throw new Error("Unsupported attachment type")
  if (file.size < 1 || file.size > 2 * 1024 * 1024) throw new Error("Attachment must be between 1 byte and 2 MB")
  return file.arrayBuffer().then((buffer) => {
    const bytes = Buffer.from(buffer)
    const checksum = createHash("sha256").update(bytes).digest("hex")
    const key = `${randomBytes(24).toString("hex")}${extension}`
    const root = path.resolve(process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), "storage"), "tickets")
    mkdirSync(root, { recursive: true, mode: 0o700 })
    const target = path.resolve(root, key)
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Unsafe storage path")
    writeFileSync(target, bytes, { mode: 0o600, flag: "wx" })
    db.prepare(`
      INSERT INTO ticket_attachments(reply_id,original_name,storage_key,mime_type,size_bytes,checksum,scan_status)
      VALUES (?,?,?,?,?,?,'pending')
    `).run(replyId, path.basename(file.name).slice(0, 180), key, file.type, file.size, checksum)
    return key
  })
}

export function readPrivateAttachment(storageKey: string) {
  const root = path.resolve(process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), "storage"), "tickets")
  const target = path.resolve(root, path.basename(storageKey))
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Unsafe storage path")
  return readFileSync(target)
}

