export type SSLCommerzValidation = {
  status?: string
  tran_id?: string
  val_id?: string
  bank_tran_id?: string
  amount?: string
  currency?: string
  card_type?: string
  risk_level?: string
  risk_title?: string
  value_a?: string
  value_b?: string
}

export type ExpectedSSLCommerzPayment = {
  transactionId: string
  amount: number
  currency: string
}

export function assertValidSSLCommerzPayment(
  payment: SSLCommerzValidation,
  expected: ExpectedSSLCommerzPayment,
) {
  const status = String(payment.status ?? "").toUpperCase()
  if (status !== "VALID" && status !== "VALIDATED") {
    throw new Error("SSLCommerz payment is not valid")
  }
  if (payment.tran_id !== expected.transactionId) {
    throw new Error("SSLCommerz transaction does not match the order")
  }
  const paidAmount = Number(payment.amount)
  if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - expected.amount) > 0.01) {
    throw new Error("SSLCommerz amount does not match the order total")
  }
  if (String(payment.currency ?? "").toUpperCase() !== expected.currency.toUpperCase()) {
    throw new Error("SSLCommerz currency does not match the order")
  }
  if (String(payment.risk_level ?? "0") === "1") {
    throw new Error("SSLCommerz marked this transaction as risky")
  }
}
