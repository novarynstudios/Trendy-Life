export const PERMISSIONS = [
  "customers.view", "customers.create", "customers.edit", "customers.delete", "customers.impersonate", "customers.export",
  "orders.view", "orders.create", "orders.edit", "orders.cancel", "orders.refund", "orders.export",
  "payments.view", "payments.capture", "payments.refund", "payments.reconcile",
  "products.view", "products.manage", "products.import", "products.export",
  "inventory.view", "inventory.adjust", "inventory.transfer", "inventory.export",
  "marketing.view", "marketing.manage",
  "support.view", "support.reply", "support.manage",
  "content.view", "content.manage",
  "reports.view", "reports.export",
  "staff.view", "staff.manage",
  "settings.view", "settings.manage",
  "audit.view", "jobs.manage", "system.health", "api.manage",
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]

export const ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  "Super Administrator": PERMISSIONS,
  Administrator: PERMISSIONS.filter((permission) => !["customers.delete"].includes(permission)),
  "Store Manager": PERMISSIONS.filter((permission) => !permission.startsWith("staff.") && !permission.startsWith("api.") && permission !== "customers.delete"),
  "Order Manager": ["orders.view", "orders.create", "orders.edit", "orders.cancel", "customers.view", "payments.view", "support.view"],
  "Product Manager": ["products.view", "products.manage", "products.import", "products.export", "inventory.view"],
  "Inventory Manager": ["products.view", "inventory.view", "inventory.adjust", "inventory.transfer", "inventory.export"],
  "Support Agent": ["customers.view", "orders.view", "support.view", "support.reply"],
  "Finance Manager": ["orders.view", "orders.refund", "payments.view", "payments.capture", "payments.refund", "payments.reconcile", "reports.view", "reports.export"],
  "Marketing Manager": ["products.view", "marketing.view", "marketing.manage", "reports.view"],
  "Content Editor": ["products.view", "content.view", "content.manage"],
  Analyst: ["customers.view", "orders.view", "payments.view", "products.view", "inventory.view", "reports.view", "reports.export"],
  "Read-only Auditor": ["customers.view", "orders.view", "payments.view", "products.view", "inventory.view", "marketing.view", "support.view", "content.view", "reports.view", "staff.view", "settings.view", "audit.view", "system.health"],
}

export function evaluatePermissions(rolePermissions: string[], overrides: { key: string; allowed: boolean }[]) {
  const permissions = new Set(rolePermissions)
  for (const override of overrides) {
    if (override.allowed) permissions.add(override.key)
    else permissions.delete(override.key)
  }
  return permissions
}

export function can(permissions: ReadonlySet<string> | readonly string[], required: string | readonly string[]) {
  const values = permissions instanceof Set ? permissions : new Set(permissions)
  const checks = typeof required === "string" ? [required] : required
  return checks.every((permission) => values.has(permission))
}
