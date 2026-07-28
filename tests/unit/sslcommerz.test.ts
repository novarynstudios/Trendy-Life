import { describe, expect, it } from "vitest"
import { assertValidSSLCommerzPayment } from "../../src/server/payments/sslcommerz-validation"

const expected = { transactionId: "TL-260727-1234", amount: 2450, currency: "BDT" }

describe("SSLCommerz validation", () => {
  it("accepts a matching server-validated payment", () => {
    expect(() => assertValidSSLCommerzPayment({
      status: "VALID",
      tran_id: expected.transactionId,
      amount: "2450.00",
      currency: "BDT",
      risk_level: "0",
    }, expected)).not.toThrow()
  })

  it("rejects amount, transaction, currency, and risk mismatches", () => {
    expect(() => assertValidSSLCommerzPayment({
      status: "VALID",
      tran_id: expected.transactionId,
      amount: "2400.00",
      currency: "BDT",
    }, expected)).toThrow(/amount/)
    expect(() => assertValidSSLCommerzPayment({
      status: "VALID",
      tran_id: "TL-OTHER",
      amount: "2450.00",
      currency: "BDT",
    }, expected)).toThrow(/transaction/)
    expect(() => assertValidSSLCommerzPayment({
      status: "VALID",
      tran_id: expected.transactionId,
      amount: "2450.00",
      currency: "USD",
    }, expected)).toThrow(/currency/)
    expect(() => assertValidSSLCommerzPayment({
      status: "VALIDATED",
      tran_id: expected.transactionId,
      amount: "2450.00",
      currency: "BDT",
      risk_level: "1",
    }, expected)).toThrow(/risky/)
  })
})
