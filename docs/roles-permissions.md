# Roles and permissions

Defaults: Super Administrator, Administrator, Store Manager, Order Manager, Product Manager, Inventory Manager, Support Agent, Finance Manager, Marketing Manager, Content Editor, Analyst, and Read-only Auditor.

Capabilities include `customers.edit`, `orders.cancel`, `payments.refund`, `products.manage`, `inventory.adjust`, `reports.export`, `staff.manage`, `settings.manage`, and `audit.view`. Roles provide baselines; `StaffPermission` can explicitly grant or deny.

Protected operations resolve a valid active database session, calculate effective permissions, validate targets, and audit sensitive outcomes. Hidden UI is never the authorization boundary.

Review high-risk grants quarterly and after job changes. Finance/refund, staff, export, API, impersonation, and security access should be minimal and recently authenticated.
