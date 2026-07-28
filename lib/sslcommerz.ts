import "server-only"

import { db, getOrderById } from "@/lib/db"
import {
  assertValidSSLCommerzPayment,
  type SSLCommerzValidation,
} from "@/src/server/payments/sslcommerz-validation"

type SessionResponse = {
  status?: string
  failedreason?: string
  sessionkey?: string
  GatewayPageURL?: string
}

function gatewayConfig() {
  const storeId = process.env.SSLCOMMERZ_STORE_ID ?? ""
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD ?? ""
  if (!storeId || !storePassword) throw new Error("SSLCommerz is not configured")
  const live = process.env.SSLCOMMERZ_IS_LIVE === "true"
  const baseUrl = live ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com"
  return { storeId, storePassword, baseUrl }
}

function siteUrl() {
  const value = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "")
  const url = new URL(value)
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS in production")
  }
  return url.toString().replace(/\/+$/, "")
}

async function parseGatewayJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) throw new Error("SSLCommerz returned an invalid response")
  const value = await response.json() as T
  if (!response.ok) throw new Error(`SSLCommerz request failed (${response.status})`)
  return value
}

export async function createSSLCommerzSession(input: {
  orderId: number
  orderNumber: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  amount: number
}) {
  const { storeId, storePassword, baseUrl } = gatewayConfig()
  const returnBase = siteUrl()
  const fields = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: input.amount.toFixed(2),
    currency: "BDT",
    tran_id: input.orderNumber,
    success_url: `${returnBase}/api/payments/sslcommerz/success`,
    fail_url: `${returnBase}/api/payments/sslcommerz/fail`,
    cancel_url: `${returnBase}/api/payments/sslcommerz/cancel`,
    ipn_url: `${returnBase}/api/payments/sslcommerz/ipn`,
    cus_name: input.name.slice(0, 100),
    cus_email: input.email.slice(0, 100),
    cus_add1: input.address.slice(0, 250),
    cus_city: input.city.slice(0, 50),
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: input.phone.slice(0, 20),
    shipping_method: "YES",
    ship_name: input.name.slice(0, 100),
    ship_add1: input.address.slice(0, 250),
    ship_city: input.city.slice(0, 50),
    ship_postcode: "1000",
    ship_country: "Bangladesh",
    product_name: `Trendy Life order ${input.orderNumber}`,
    product_category: "Ecommerce",
    product_profile: "general",
    value_a: String(input.orderId),
    value_b: input.orderNumber,
  })
  const response = await fetch(`${baseUrl}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: fields,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  })
  const result = await parseGatewayJson<SessionResponse>(response)
  if (result.status !== "SUCCESS" || !result.GatewayPageURL) {
    throw new Error(result.failedreason || "Unable to create SSLCommerz session")
  }
  const paymentUrl = new URL(result.GatewayPageURL)
  const gatewayHost = paymentUrl.hostname.toLowerCase()
  if (
    paymentUrl.protocol !== "https:"
    || (gatewayHost !== "sslcommerz.com" && !gatewayHost.endsWith(".sslcommerz.com"))
  ) {
    throw new Error("SSLCommerz returned an unsafe payment URL")
  }
  return {
    paymentUrl: paymentUrl.toString(),
    transactionId: input.orderNumber,
    sessionKey: result.sessionkey ?? "",
  }
}

export async function verifySSLCommerzPayment(validationId: string) {
  const { storeId, storePassword, baseUrl } = gatewayConfig()
  const query = new URLSearchParams({
    val_id: validationId,
    store_id: storeId,
    store_passwd: storePassword,
    format: "json",
  })
  const response = await fetch(`${baseUrl}/validator/api/validationserverAPI.php?${query}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  })
  return parseGatewayJson<SSLCommerzValidation>(response)
}

function safePayload(payment: SSLCommerzValidation) {
  return JSON.stringify({
    status: payment.status,
    transactionId: payment.tran_id,
    validationId: payment.val_id,
    bankTransactionId: payment.bank_tran_id,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.card_type,
    riskLevel: payment.risk_level,
    riskTitle: payment.risk_title,
  })
}

export function applyVerifiedSSLCommerzPayment(payment: SSLCommerzValidation) {
  const transactionId = String(payment.tran_id ?? "")
  const attempt = db.prepare(`
    SELECT id, order_id AS orderId FROM payment_attempts
    WHERE gateway='sslcommerz' AND invoice_id=?
  `).get(transactionId) as { id: number; orderId: number } | undefined
  const metadataOrderId = Number(payment.value_a)
  const orderId = attempt?.orderId ?? (Number.isInteger(metadataOrderId) ? metadataOrderId : 0)
  const order = orderId ? getOrderById(orderId) : undefined
  if (!order || order.paymentGateway !== "sslcommerz") throw new Error("Payment order was not found")

  assertValidSSLCommerzPayment(payment, {
    transactionId: order.orderNumber,
    amount: order.total,
    currency: "BDT",
  })

  db.exec("BEGIN IMMEDIATE")
  try {
    db.prepare(`
      UPDATE orders SET payment_status='paid', payment_gateway='sslcommerz',
        payment_invoice_id=?, payment_transaction_id=?,
        status=CASE WHEN status='pending' THEN 'confirmed' ELSE status END
      WHERE id=?
    `).run(payment.val_id || transactionId, payment.bank_tran_id || transactionId, order.id)
    const payload = safePayload(payment)
    if (attempt) {
      db.prepare(`
        UPDATE payment_attempts SET status='completed', payment_method=?, transaction_id=?,
          raw_payload=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
      `).run(payment.card_type || "SSLCommerz", payment.bank_tran_id || transactionId, payload, attempt.id)
    } else {
      db.prepare(`
        INSERT INTO payment_attempts (
          order_id, gateway, invoice_id, amount, status, payment_method, transaction_id, raw_payload
        ) VALUES (?, 'sslcommerz', ?, ?, 'completed', ?, ?, ?)
      `).run(order.id, transactionId, order.total, payment.card_type || "SSLCommerz", payment.bank_tran_id || transactionId, payload)
    }
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
  return { orderId: order.id, orderNumber: order.orderNumber }
}
