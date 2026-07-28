import { describe, expect, it } from "vitest"
import { createWebhookSignature, verifyWebhookSignature } from "../../src/server/security/webhook"
import { evaluatePermissions, can } from "../../src/server/permissions"
import { hashPassword, validatePassword, verifyPassword } from "../../src/server/security/password"
import { generateTotpSecret, totpUri } from "../../src/server/security/totp"

describe("permission evaluation", () => {
  it("applies explicit grants and denials after role permissions", () => {
    const permissions = evaluatePermissions(["orders.view", "orders.edit"], [
      { key: "orders.edit", allowed: false },
      { key: "payments.view", allowed: true },
    ])
    expect(can(permissions, "orders.view")).toBe(true)
    expect(can(permissions, "orders.edit")).toBe(false)
    expect(can(permissions, ["orders.view", "payments.view"])).toBe(true)
  })
})

describe("password policy and hashing", () => {
  it("rejects weak and identity-derived passwords", () => {
    expect(validatePassword("short").valid).toBe(false)
    expect(validatePassword("Farid-Strong-2026!", ["Farid"]).valid).toBe(false)
    expect(validatePassword("Secure-River-2026!").valid).toBe(true)
  })

  it("stores and verifies Argon2id hashes", async () => {
    const hash = await hashPassword("Secure-River-2026!")
    expect(hash.startsWith("$argon2id$")).toBe(true)
    await expect(verifyPassword(hash, "Secure-River-2026!")).resolves.toBe(true)
    await expect(verifyPassword(hash, "incorrect")).resolves.toBe(false)
  })
})

describe("webhook verification", () => {
  it("accepts authentic current payloads and rejects tampering and stale timestamps", () => {
    const now = Date.now()
    const timestamp = Math.floor(now / 1_000)
    const rawBody = JSON.stringify({ transactionId: "BKASH-123", status: "completed" })
    const signature = createWebhookSignature("development-secret", timestamp, rawBody)
    expect(verifyWebhookSignature({ secret: "development-secret", timestamp, rawBody, signature, now })).toBe(true)
    expect(verifyWebhookSignature({ secret: "development-secret", timestamp, rawBody: `${rawBody}x`, signature, now })).toBe(false)
    expect(verifyWebhookSignature({ secret: "development-secret", timestamp: timestamp - 900, rawBody, signature, now })).toBe(false)
  })
})

describe("two-factor setup", () => {
  it("creates valid Base32 secrets and issuer-bound enrollment URIs", () => {
    const secret = generateTotpSecret()
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(totpUri(secret, "admin@example.test")).toContain(`secret=${secret}`)
    expect(totpUri(secret, "admin@example.test")).toContain("Trendy%20Life%20Admin")
  })
})
