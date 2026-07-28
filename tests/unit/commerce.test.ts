import { describe, expect, it } from "vitest"
import {
  calculateLineTotal,
  calculateOrderTotals,
  calculatePercentageDiscount,
  canTransitionOrder,
  validateInventoryMutation,
  validateRefund,
} from "../../src/server/domain/commerce"

describe("commerce calculations", () => {
  it("calculates precise line totals in minor units", () => {
    expect(calculateLineTotal({ unitPrice: 1_250n, quantity: 2, discount: 200n, taxRateBasisPoints: 750 }))
      .toEqual({ gross: 2_500n, discount: 200n, taxable: 2_300n, tax: 173n, total: 2_473n })
  })

  it("combines discounts, tax, and shipping without floating point arithmetic", () => {
    const totals = calculateOrderTotals([
      { unitPrice: 1_000n, quantity: 3, discount: 100n, taxRateBasisPoints: 500 },
      { unitPrice: 750n, quantity: 2, discount: 0n, taxRateBasisPoints: 0 },
    ], 120n, 300n)
    expect(totals).toEqual({ subtotal: 4_500n, discount: 400n, tax: 145n, shipping: 120n, total: 4_365n })
  })

  it("caps percentage discounts and rounds half-up", () => {
    expect(calculatePercentageDiscount(9_999n, 1_250)).toBe(1_250n)
    expect(calculatePercentageDiscount(9_999n, 1_250, 1_000n)).toBe(1_000n)
  })
})

describe("commerce invariants", () => {
  it("prevents negative inventory unless backorders are enabled", () => {
    expect(validateInventoryMutation(2, -3, false)).toMatchObject({ valid: false })
    expect(validateInventoryMutation(2, -3, true)).toEqual({ valid: true, next: -1 })
  })

  it("rejects refunds above the captured remainder", () => {
    expect(validateRefund(6_001n, 10_000n, 4_000n)).toMatchObject({ valid: false })
    expect(validateRefund(6_000n, 10_000n, 4_000n)).toEqual({ valid: true, available: 6_000n })
  })

  it("enforces allowed order status transitions", () => {
    expect(canTransitionOrder("PENDING_PAYMENT", "PAID")).toBe(true)
    expect(canTransitionOrder("DELIVERED", "PROCESSING")).toBe(false)
    expect(canTransitionOrder("REFUNDED", "PAID")).toBe(false)
  })
})
