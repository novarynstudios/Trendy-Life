import "server-only"

import { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import path from "node:path"
import type { Campaign, Category, Customer, Order, OrderItem, PaymentAttempt, Product, SiteSettings, SupportTicket } from "@/lib/types"

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "trendy-life.db")
mkdirSync(path.dirname(databasePath), { recursive: true })

const globalDatabase = globalThis as typeof globalThis & { trendyLifeDatabase?: DatabaseSync }
export const db = globalDatabase.trendyLifeDatabase ?? new DatabaseSync(databasePath, { timeout: 5000 })
globalDatabase.trendyLifeDatabase = db

db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL,
    compare_price INTEGER,
    sku TEXT NOT NULL UNIQUE,
    inventory INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    featured INTEGER NOT NULL DEFAULT 0,
    badge TEXT,
    image TEXT NOT NULL,
    second_image TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customer_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customer_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    shipping INTEGER NOT NULL,
    discount_code TEXT,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    payment_gateway TEXT NOT NULL DEFAULT 'manual',
    payment_invoice_id TEXT,
    payment_transaction_id TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    image TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    discount_type TEXT NOT NULL DEFAULT 'percentage',
    discount_value INTEGER NOT NULL DEFAULT 0,
    min_order INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    popup_enabled INTEGER NOT NULL DEFAULT 1,
    popup_title TEXT NOT NULL DEFAULT '',
    popup_copy TEXT NOT NULL DEFAULT '',
    popup_cta TEXT NOT NULL DEFAULT 'Shop now',
    popup_image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payment_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    gateway TEXT NOT NULL,
    invoice_id TEXT UNIQUE,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'initiated',
    payment_method TEXT NOT NULL DEFAULT '',
    transaction_id TEXT,
    raw_payload TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'General',
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES customer_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ticket_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author_type TEXT NOT NULL,
    author_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
  );
`)

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

ensureColumn("orders", "user_id", "INTEGER")
ensureColumn("orders", "discount_code", "TEXT")
ensureColumn("orders", "discount_amount", "INTEGER NOT NULL DEFAULT 0")
ensureColumn("orders", "payment_gateway", "TEXT NOT NULL DEFAULT 'manual'")
ensureColumn("orders", "payment_invoice_id", "TEXT")
ensureColumn("orders", "payment_transaction_id", "TEXT")

const defaultSettings: Record<string, string> = {
  storeName: "Trendy Life",
  supportEmail: "hello@trendylife.com.bd",
  supportPhone: "+880 1700-000000",
  address: "Dhaka, Bangladesh",
  announcement: "Furniture, workspace planning & interior solutions · Delivery across Bangladesh",
  heroEyebrow: "Workplace furniture & interiors",
  heroTitle: "Furniture that",
  heroAccent: "means business.",
  heroDescription: "Purposeful desks, seating, storage and interior finishes for offices that need to look sharp and work even harder.",
  heroImage: "/editorial/hero-executive-desk.webp",
  shippingThreshold: "100000",
  flatShipping: "1500",
  currency: "BDT",
}
const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
for (const [key, value] of Object.entries(defaultSettings)) insertSetting.run(key, value)

const productColumns = `
  id, slug, name, category, description, price, compare_price AS comparePrice,
  sku, inventory, status, featured, badge, image, second_image AS secondImage,
  created_at AS createdAt, updated_at AS updatedAt
`

function normalizeProduct(row: Record<string, unknown>): Product {
  return {
    ...(row as unknown as Product),
    featured: Boolean(row.featured),
    comparePrice: row.comparePrice === null ? null : Number(row.comparePrice),
  }
}

export function getProducts(options: { category?: string; search?: string; status?: string; featured?: boolean; limit?: number } = {}) {
  const conditions: string[] = []
  const values: (string | number)[] = []
  if (options.category) {
    conditions.push("LOWER(category) = LOWER(?)")
    values.push(options.category)
  }
  if (options.search) {
    conditions.push("(name LIKE ? OR sku LIKE ? OR category LIKE ?)")
    const query = `%${options.search}%`
    values.push(query, query, query)
  }
  if (options.status) {
    conditions.push("status = ?")
    values.push(options.status)
  }
  if (options.featured) conditions.push("featured = 1")
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  const limit = options.limit ? `LIMIT ${Math.max(1, Math.floor(options.limit))}` : ""
  return (db.prepare(`SELECT ${productColumns} FROM products ${where} ORDER BY featured DESC, created_at DESC ${limit}`).all(...values) as Record<string, unknown>[]).map(normalizeProduct)
}

export function getProductBySlug(slug: string) {
  const row = db.prepare(`SELECT ${productColumns} FROM products WHERE slug = ?`).get(slug) as Record<string, unknown> | undefined
  return row ? normalizeProduct(row) : null
}

export function getProductById(id: number) {
  const row = db.prepare(`SELECT ${productColumns} FROM products WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  return row ? normalizeProduct(row) : null
}

export function syncStorefrontProduct(input: {
  slug: string
  name: string
  category: string
  description: string
  price: number
  comparePrice: number | null
  sku: string
  inventory: number
  status: "active" | "draft" | "archived"
  featured: boolean
  badge: string | null
  image: string
  secondImage: string
}) {
  const categorySlug = input.category.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "uncategorized"
  db.prepare(`
    INSERT INTO categories (slug, name, note, image, active)
    VALUES (?, ?, '', '', 1)
    ON CONFLICT(slug) DO UPDATE SET name=excluded.name, active=1
  `).run(categorySlug, input.category)
  const values = [input.slug, input.name, input.category, input.description, Math.max(0, Math.round(input.price)),
    input.comparePrice === null ? null : Math.max(0, Math.round(input.comparePrice)), input.sku,
    Math.max(0, Math.floor(input.inventory)), input.status, input.featured ? 1 : 0, input.badge,
    input.image, input.secondImage || input.image] as const
  const bySlug = db.prepare("SELECT id FROM products WHERE slug = ?").get(input.slug) as { id: number } | undefined
  const bySku = db.prepare("SELECT id FROM products WHERE sku = ?").get(input.sku) as { id: number } | undefined
  const existingId = bySlug?.id ?? bySku?.id
  if (existingId) {
    db.prepare(`UPDATE products SET slug=?, name=?, category=?, description=?, price=?, compare_price=?, sku=?, inventory=?, status=?, featured=?, badge=?, image=?, second_image=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(...values, existingId)
  } else {
    db.prepare(`INSERT INTO products (slug, name, category, description, price, compare_price, sku, inventory, status, featured, badge, image, second_image, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .run(...values)
  }
}

export function getCategories() {
  const rows = db.prepare("SELECT id, slug, name, note, image, active FROM categories ORDER BY id").all() as Record<string, unknown>[]
  return rows.map((row) => ({ ...(row as unknown as Category), active: Boolean(row.active) }))
}

export function getSettings(): SiteSettings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[]
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  return {
    storeName: settings.storeName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    address: settings.address,
    announcement: settings.announcement,
    heroEyebrow: settings.heroEyebrow,
    heroTitle: settings.heroTitle,
    heroAccent: settings.heroAccent,
    heroDescription: settings.heroDescription,
    heroImage: settings.heroImage,
    shippingThreshold: Number(settings.shippingThreshold),
    flatShipping: Number(settings.flatShipping),
    currency: settings.currency,
  }
}

const orderColumns = `
  id, user_id AS userId, order_number AS orderNumber, customer_name AS customerName,
  email, phone, address, city, payment_method AS paymentMethod, subtotal, shipping,
  discount_code AS discountCode, discount_amount AS discountAmount, total, status,
  payment_status AS paymentStatus, payment_gateway AS paymentGateway,
  payment_invoice_id AS paymentInvoiceId, payment_transaction_id AS paymentTransactionId,
  notes, created_at AS createdAt
`

export function getOrders(search = "") {
  const query = `%${search}%`
  return db.prepare(`
    SELECT ${orderColumns}
    FROM orders
    WHERE order_number LIKE ? OR customer_name LIKE ? OR email LIKE ? OR phone LIKE ?
    ORDER BY created_at DESC
  `).all(query, query, query, query) as unknown as Order[]
}

export function getOrderById(id: number) {
  return db.prepare(`
    SELECT ${orderColumns}
    FROM orders WHERE id = ?
  `).get(id) as unknown as Order | undefined
}

export function getOrderByNumber(orderNumber: string, phone?: string) {
  const sql = phone
    ? "SELECT id FROM orders WHERE UPPER(order_number) = UPPER(?) AND phone = ?"
    : "SELECT id FROM orders WHERE UPPER(order_number) = UPPER(?)"
  const row = db.prepare(sql).get(orderNumber, ...(phone ? [phone] : [])) as { id: number } | undefined
  return row ? getOrderById(row.id) : undefined
}

export function getOrderItems(orderId: number) {
  return db.prepare(`
    SELECT id, product_id AS productId, name, sku, price, quantity, image
    FROM order_items WHERE order_id = ? ORDER BY id
  `).all(orderId) as unknown as OrderItem[]
}

export function getCustomers() {
  return db.prepare(`
    SELECT customer_users.id, customer_users.name, customer_users.email, customer_users.phone,
      customer_users.city, customer_users.company, COUNT(orders.id) AS orders,
      COALESCE(SUM(orders.total), 0) AS spent,
      COALESCE(MAX(orders.created_at), customer_users.created_at) AS lastOrder
    FROM customer_users
    LEFT JOIN orders ON orders.user_id = customer_users.id
    GROUP BY customer_users.id ORDER BY lastOrder DESC
  `).all() as unknown as { name: string; email: string; phone: string; city: string; orders: number; spent: number; lastOrder: string }[]
}

export function getDashboardStats() {
  const totals = db.prepare(`
    SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue,
      COALESCE(SUM(CASE WHEN status IN ('pending','confirmed','processing') THEN 1 ELSE 0 END), 0) AS openOrders
    FROM orders
  `).get() as { orders: number; revenue: number; openOrders: number }
  const lowStock = db.prepare("SELECT COUNT(*) AS count FROM products WHERE status = 'active' AND inventory <= 10").get() as { count: number }
  const customers = db.prepare("SELECT COUNT(*) AS count FROM customer_users").get() as { count: number }
  return { ...totals, lowStock: Number(lowStock.count), customers: Number(customers.count) }
}

export function getCustomerById(id: number) {
  return db.prepare(`
    SELECT id, name, email, phone, company, address, city, created_at AS createdAt
    FROM customer_users WHERE id = ?
  `).get(id) as Customer | undefined
}

export function getCustomerOrders(userId: number) {
  return db.prepare(`SELECT ${orderColumns} FROM orders WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as unknown as Order[]
}

export function getCustomerOrderById(userId: number, orderId: number) {
  return db.prepare(`SELECT ${orderColumns} FROM orders WHERE user_id = ? AND id = ?`).get(userId, orderId) as unknown as Order | undefined
}

export function getCampaigns() {
  type CampaignRow = Omit<Campaign, "active" | "popupEnabled"> & { active: number; popupEnabled: number }
  return (db.prepare(`
    SELECT id, name, code, title, description, discount_type AS discountType,
      discount_value AS discountValue, min_order AS minOrder, starts_at AS startsAt,
      ends_at AS endsAt, active, popup_enabled AS popupEnabled, popup_title AS popupTitle,
      popup_copy AS popupCopy, popup_cta AS popupCta, popup_image AS popupImage
    FROM campaigns ORDER BY created_at DESC
  `).all() as unknown as CampaignRow[])
    .map((item) => ({ ...item, active: Boolean(item.active), popupEnabled: Boolean(item.popupEnabled) }))
}

export function getActivePopupCampaign() {
  const now = new Date().toISOString()
  return getCampaigns().find((campaign) => campaign.active && campaign.popupEnabled && campaign.startsAt <= now && campaign.endsAt >= now) || null
}

export function getCampaignByCode(code: string, subtotal: number) {
  type CampaignRow = Omit<Campaign, "active" | "popupEnabled"> & { active: number; popupEnabled: number }
  const now = new Date().toISOString()
  const row = db.prepare(`
    SELECT id, name, code, title, description, discount_type AS discountType,
      discount_value AS discountValue, min_order AS minOrder, starts_at AS startsAt,
      ends_at AS endsAt, active, popup_enabled AS popupEnabled, popup_title AS popupTitle,
      popup_copy AS popupCopy, popup_cta AS popupCta, popup_image AS popupImage
    FROM campaigns
    WHERE UPPER(code) = UPPER(?) AND active = 1 AND starts_at <= ? AND ends_at >= ?
  `).get(code, now, now) as CampaignRow | undefined
  if (!row || subtotal < Number(row.minOrder)) return null
  return { ...row, active: Boolean(row.active), popupEnabled: Boolean(row.popupEnabled) } as Campaign
}

export function getPaymentAttempts() {
  return db.prepare(`
    SELECT payment_attempts.id, payment_attempts.order_id AS orderId, orders.order_number AS orderNumber,
      payment_attempts.gateway, payment_attempts.invoice_id AS invoiceId, payment_attempts.amount,
      payment_attempts.status, payment_attempts.payment_method AS paymentMethod,
      payment_attempts.transaction_id AS transactionId, payment_attempts.created_at AS createdAt,
      payment_attempts.updated_at AS updatedAt
    FROM payment_attempts JOIN orders ON orders.id = payment_attempts.order_id
    ORDER BY payment_attempts.created_at DESC
  `).all() as unknown as PaymentAttempt[]
}

export function getTickets() {
  return db.prepare(`
    SELECT support_tickets.id, support_tickets.ticket_number AS ticketNumber,
      support_tickets.user_id AS userId, customer_users.name AS customerName, customer_users.email,
      support_tickets.subject, support_tickets.department, support_tickets.priority,
      support_tickets.status, support_tickets.message, support_tickets.created_at AS createdAt,
      support_tickets.updated_at AS updatedAt
    FROM support_tickets JOIN customer_users ON customer_users.id = support_tickets.user_id
    ORDER BY support_tickets.updated_at DESC
  `).all() as unknown as SupportTicket[]
}

export function getCustomerTickets(userId: number) {
  return getTickets().filter((ticket) => ticket.userId === userId)
}

export function getCustomerTicketById(userId: number, ticketId: number) {
  return getTickets().find((ticket) => ticket.userId === userId && ticket.id === ticketId)
}

export function getTicketReplies(ticketId: number) {
  return db.prepare(`
    SELECT id, author_type AS authorType, author_name AS authorName, message, created_at AS createdAt
    FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at
  `).all(ticketId) as { id: number; authorType: string; authorName: string; message: string; createdAt: string }[]
}

export function getSubscribers() {
  return db.prepare("SELECT id, email, created_at AS createdAt FROM subscribers ORDER BY created_at DESC").all() as { id: number; email: string; createdAt: string }[]
}

export function getMessages() {
  return db.prepare("SELECT id, name, email, phone, subject, message, status, created_at AS createdAt FROM messages ORDER BY created_at DESC").all() as {
    id: number; name: string; email: string; phone: string; subject: string; message: string; status: string; createdAt: string
  }[]
}
