export type MinorMoney = bigint

export type OrderLineInput = {
  unitPrice: MinorMoney
  quantity: number
  discount: MinorMoney
  taxRateBasisPoints: number
}

export function calculateLineTotal(line: OrderLineInput) {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error("Quantity must be a positive integer")
  if (line.unitPrice < 0n || line.discount < 0n) throw new Error("Money values cannot be negative")
  if (!Number.isInteger(line.taxRateBasisPoints) || line.taxRateBasisPoints < 0) throw new Error("Tax rate is invalid")
  const gross = line.unitPrice * BigInt(line.quantity)
  const discount = line.discount > gross ? gross : line.discount
  const taxable = gross - discount
  const tax = (taxable * BigInt(line.taxRateBasisPoints) + 5000n) / 10000n
  return { gross, discount, taxable, tax, total: taxable + tax }
}

export function calculateOrderTotals(lines: OrderLineInput[], shipping: MinorMoney, orderDiscount: MinorMoney = 0n) {
  if (shipping < 0n || orderDiscount < 0n) throw new Error("Money values cannot be negative")
  const calculated = lines.map(calculateLineTotal)
  const subtotal = calculated.reduce((sum, line) => sum + line.gross, 0n)
  const lineDiscount = calculated.reduce((sum, line) => sum + line.discount, 0n)
  const tax = calculated.reduce((sum, line) => sum + line.tax, 0n)
  const maximumOrderDiscount = subtotal - lineDiscount
  const safeOrderDiscount = orderDiscount > maximumOrderDiscount ? maximumOrderDiscount : orderDiscount
  return {
    subtotal,
    discount: lineDiscount + safeOrderDiscount,
    tax,
    shipping,
    total: subtotal - lineDiscount - safeOrderDiscount + tax + shipping,
  }
}

export function calculatePercentageDiscount(subtotal: MinorMoney, basisPoints: number, maximum?: MinorMoney) {
  if (subtotal < 0n || !Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) throw new Error("Discount input is invalid")
  const calculated = (subtotal * BigInt(basisPoints) + 5000n) / 10000n
  return maximum !== undefined && calculated > maximum ? maximum : calculated
}

export function validateRefund(requested: MinorMoney, paid: MinorMoney, alreadyRefunded: MinorMoney) {
  if (requested <= 0n) return { valid: false as const, reason: "Refund must be greater than zero." }
  const available = paid - alreadyRefunded
  if (requested > available) return { valid: false as const, reason: "Refund exceeds the remaining captured amount." }
  return { valid: true as const, available }
}

export function validateInventoryMutation(onHand: number, delta: number, allowBackorder: boolean) {
  if (!Number.isInteger(onHand) || !Number.isInteger(delta)) return { valid: false as const, reason: "Inventory quantities must be integers." }
  const next = onHand + delta
  if (!allowBackorder && next < 0) return { valid: false as const, reason: "This adjustment would make inventory negative." }
  return { valid: true as const, next }
}

const orderTransitions: Record<string, readonly string[]> = {
  DRAFT: ["PENDING_PAYMENT", "PAID", "CANCELLED"],
  PENDING_PAYMENT: ["PAYMENT_FAILED", "PAID", "CANCELLED", "ON_HOLD", "FRAUD_REVIEW"],
  PAYMENT_FAILED: ["PENDING_PAYMENT", "PAID", "CANCELLED", "ON_HOLD"],
  PAID: ["CONFIRMED", "PROCESSING", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED", "ON_HOLD", "FRAUD_REVIEW"],
  CONFIRMED: ["PROCESSING", "READY_TO_SHIP", "CANCELLED", "ON_HOLD"],
  PROCESSING: ["READY_TO_SHIP", "SHIPPED", "CANCELLED", "ON_HOLD"],
  READY_TO_SHIP: ["SHIPPED", "PROCESSING", "CANCELLED", "ON_HOLD"],
  SHIPPED: ["DELIVERED", "ON_HOLD"],
  DELIVERED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  CANCELLED: [],
  PARTIALLY_REFUNDED: ["REFUNDED"],
  REFUNDED: [],
  ON_HOLD: ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PROCESSING", "CANCELLED"],
  FRAUD_REVIEW: ["PENDING_PAYMENT", "PAID", "CANCELLED", "ON_HOLD"],
}

export function canTransitionOrder(from: string, to: string) {
  return from === to || (orderTransitions[from]?.includes(to) ?? false)
}
