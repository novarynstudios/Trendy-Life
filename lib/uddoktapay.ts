import "server-only"

import { db, getOrderById } from "@/lib/db"

type CheckoutResponse = { status: boolean; message: string; payment_url?: string }
export type UddoktaPayment = {
  full_name?: string
  email?: string
  amount?: string
  charged_amount?: string
  invoice_id: string
  metadata?: { order_id?: string | number; user_id?: string | number }
  payment_method?: string
  transaction_id?: string
  status?: string
  [key: string]: unknown
}

function gatewayConfig() {
  const baseUrl = (process.env.UDDOKTAPAY_BASE_URL || "").replace(/\/+$/, "")
  const apiKey = process.env.UDDOKTAPAY_API_KEY || ""
  if (!baseUrl || !apiKey) throw new Error("UddoktaPay is not configured")
  return { baseUrl, apiKey }
}

async function gatewayRequest<T>(path: string, body: Record<string, unknown>) {
  const { baseUrl, apiKey } = gatewayConfig()
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "RT-UDDOKTAPAY-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  })
  const data = await response.json() as T
  if (!response.ok) throw new Error(`UddoktaPay request failed (${response.status})`)
  return data
}

export async function createUddoktaCharge(input: {
  orderId: number
  orderNumber: string
  userId: number | null
  name: string
  email: string
  amount: number
}) {
  const siteUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "")
  const result = await gatewayRequest<CheckoutResponse>("/api/checkout-v2", {
    full_name: input.name,
    email: input.email,
    amount: input.amount.toFixed(2),
    metadata: {
      order_id: String(input.orderId),
      order_number: input.orderNumber,
      user_id: input.userId ? String(input.userId) : "",
    },
    redirect_url: `${siteUrl}/api/payments/uddoktapay/callback`,
    return_type: "GET",
    cancel_url: `${siteUrl}/payment-cancelled?order=${encodeURIComponent(input.orderNumber)}`,
    webhook_url: `${siteUrl}/api/payments/uddoktapay/webhook`,
  })
  if (!result.status || !result.payment_url) throw new Error(result.message || "Unable to create payment")
  const paymentUrl = new URL(result.payment_url)
  const configuredHost = new URL(gatewayConfig().baseUrl).hostname.toLowerCase()
  const paymentHost = paymentUrl.hostname.toLowerCase()
  if (paymentUrl.protocol !== "https:" || (paymentHost !== configuredHost && !paymentHost.endsWith(".uddoktapay.com"))) {
    throw new Error("UddoktaPay returned an unsafe payment URL")
  }
  return paymentUrl.toString()
}

export async function verifyUddoktaPayment(invoiceId: string) {
  return gatewayRequest<UddoktaPayment>("/api/verify-payment", { invoice_id: invoiceId })
}

function safePaymentPayload(payment: UddoktaPayment) {
  return JSON.stringify({
    invoiceId: payment.invoice_id,
    transactionId: payment.transaction_id,
    amount: payment.amount,
    chargedAmount: payment.charged_amount,
    paymentMethod: payment.payment_method,
    status: payment.status,
    orderId: payment.metadata?.order_id,
  })
}

export function applyVerifiedPayment(payment: UddoktaPayment) {
  const orderId = Number(payment.metadata?.order_id)
  const order = Number.isInteger(orderId) ? getOrderById(orderId) : undefined
  if (!order) throw new Error("Payment order was not found")
  const paidAmount = Number(payment.amount ?? payment.charged_amount ?? 0)
  if (Math.abs(paidAmount - order.total) > 0.01) throw new Error("Payment amount does not match order total")
  if (String(payment.status || "").toUpperCase() !== "COMPLETED") throw new Error("Payment is not completed")

  db.exec("BEGIN IMMEDIATE")
  try {
    db.prepare(`
      UPDATE orders SET payment_status='paid', payment_gateway='uddoktapay',
        payment_invoice_id=?, payment_transaction_id=?,
        status=CASE WHEN status='pending' THEN 'confirmed' ELSE status END
      WHERE id=?
    `).run(payment.invoice_id, payment.transaction_id || null, order.id)
    const payload = safePaymentPayload(payment)
    const existing = db.prepare("SELECT id FROM payment_attempts WHERE invoice_id = ?").get(payment.invoice_id) as { id: number } | undefined
    if (existing) {
      db.prepare(`
        UPDATE payment_attempts SET status='completed', payment_method=?, transaction_id=?,
          raw_payload=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
      `).run(payment.payment_method || "", payment.transaction_id || null, payload, existing.id)
    } else {
      const pending = db.prepare(`
        SELECT id FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 1
      `).get(order.id) as { id: number } | undefined
      if (pending) {
        db.prepare(`
          UPDATE payment_attempts SET invoice_id=?, status='completed', payment_method=?,
            transaction_id=?, raw_payload=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
        `).run(payment.invoice_id, payment.payment_method || "", payment.transaction_id || null, payload, pending.id)
      } else {
        db.prepare(`
          INSERT INTO payment_attempts (order_id, gateway, invoice_id, amount, status, payment_method, transaction_id, raw_payload)
          VALUES (?, 'uddoktapay', ?, ?, 'completed', ?, ?, ?)
        `).run(order.id, payment.invoice_id, order.total, payment.payment_method || "", payment.transaction_id || null, payload)
      }
    }
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
  return { orderId: order.id, orderNumber: order.orderNumber }
}
