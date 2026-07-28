import { expect, test } from "@playwright/test"

const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

test.describe("Trendy Life administration", () => {
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD against a configured test environment.")

  test("administrator can authenticate and reach protected commerce workflows", async ({ page }) => {
    await page.goto("/admin/login")
    await page.getByLabel("Email address").fill(email!)
    await page.getByLabel("Password").fill(password!)
    await page.getByRole("button", { name: /sign in/i }).click()
    if (page.url().includes("/admin/verify")) {
      const totp = process.env.E2E_ADMIN_TOTP
      test.skip(!totp, "This account requires E2E_ADMIN_TOTP.")
      await page.getByLabel(/verification code/i).fill(totp!)
      await page.getByRole("button", { name: /verify/i }).click()
    }
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByRole("heading", { name: /operations dashboard/i })).toBeVisible()
    await page.getByRole("link", { name: /^orders$/i }).first().click()
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible()
    await expect(page.getByRole("link", { name: /create manual order/i })).toBeVisible()
  })

  test("unauthenticated users cannot open protected administration", async ({ page }) => {
    await page.goto("/admin/orders")
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
