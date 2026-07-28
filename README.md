# Trendy Life Admin

Trendy Life Admin is a dense, responsive commerce operations console for Trendy Life, a Trendy Group company. It uses an original navy-and-blue administrative system inspired by the information architecture and fast workflows of established hosting and commerce back offices. No proprietary WHMCS code, assets, copy, or branding are used.

## Included

- Secure staff authentication with Argon2id, revocable database sessions, idle and absolute expiry, progressive login protection, one-time password resets, session locking, TOTP, and recovery codes.
- Server-enforced granular roles and permissions for customers, orders, payments, catalog, inventory, support, reports, staff, settings, jobs, health, and audit operations.
- Real database dashboard statistics, comparison periods, revenue analytics, recent orders, operations widgets, and per-staff widget preferences.
- Categorized global search across customers, orders, products/SKUs, categories, transactions, coupons, tickets, invoices, staff, and email logs.
- Customers, products/variants, taxonomy, immutable inventory movements, orders, payments/refunds, invoices/PDFs, shipments, returns, reviews, promotions, support, content, communications, reports, staff, settings, health, jobs, and audit modules.
- Storefront checkout with SSLCommerz, UddoktaPay, and Cash on Delivery. SSLCommerz and UddoktaPay are the two online gateways; offline payment recording remains permission-protected in administration.
- PostgreSQL/Prisma 7, Redis/BullMQ, SMTP worker, scheduler, replay-resistant payment webhook intake, Docker image, health/readiness endpoints, and migrations.
- Strict TypeScript, ESLint, Vitest unit coverage, and Playwright critical-flow specifications.

## Quick start

Requires Node.js 22+, npm 10+, Docker, and Docker Compose.

```bash
cp .env.example .env
# Set secure values for AUTH_SECRET, APP_ENCRYPTION_KEY, ADMIN_NAME,
# ADMIN_EMAIL, and ADMIN_PASSWORD.
docker compose up -d postgres redis
npm ci
npm run db:setup
npm run dev
```

In separate terminals:

```bash
npm run worker
npm run scheduler
```

Open `http://localhost:3000/admin/login`.

`npm run db:setup` creates only the configured administrator, roles, and permissions. It does not create customers, products, orders, payments, reviews, tickets, campaigns, or other demo records. The configured administrator must enroll TOTP before using the system.

## Commands

```bash
npm run dev
npm run build
npm start
npm run worker
npm run scheduler
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:setup
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run check
```

## Environment

At minimum configure `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, and `APP_URL`. SMTP is required for delivery. Configure SSLCommerz and UddoktaPay credentials for checkout; all gateway and courier credentials remain server-only.

```bash
openssl rand -base64 48  # AUTH_SECRET
openssl rand -hex 32     # APP_ENCRYPTION_KEY
```

See [Environment variables](docs/environment.md).

## Production

```bash
docker compose build
docker compose run --rm app npm run db:migrate:deploy
docker compose up -d app worker scheduler
```

Terminate TLS at a trusted reverse proxy, forward the original host/protocol/client IP, restrict PostgreSQL and Redis to private networks, mount persistent private storage, configure SMTP, monitor `/api/health` and `/api/readiness`, and run encrypted tested backups.

Documentation:

- [Installation and local development](docs/installation.md)
- [Environment variables](docs/environment.md)
- [Docker and production deployment](docs/deployment.md)
- [Migrations and administrator bootstrap](docs/database.md)
- [Testing](docs/testing.md)
- [Backup and restoration](docs/backup-restore.md)
- [Security checklist](docs/security-checklist.md)
- [Roles and permissions](docs/roles-permissions.md)
- [Payment gateway integration](docs/payment-gateways.md)
- [Courier integration](docs/courier-integrations.md)

## Architecture

```text
app/                         App Router pages, route handlers, server actions
components/admin/            tables, charts, editors, security and utility UI
src/server/auth/             sessions, login, CSRF and principals
src/server/permissions/      capability definitions and evaluation
src/server/domain/           money, inventory, refunds, transitions
src/server/services/         dashboard, lists, search, orders and health
src/server/security/         hashing, encryption, TOTP, limits, webhooks
src/server/jobs/             BullMQ worker, scheduler, Redis
src/server/audit/            immutable sensitive-operation logging
prisma/                      schema, migration, administrator bootstrap
tests/                       unit and browser workflow tests
```

Financial and stock mutations use serializable Prisma transactions. Inventory paths lock selected rows before availability checks. Money uses PostgreSQL `Decimal`; pure domain tests use integer minor units.

## Launch requirements

Do not launch with development or Compose credentials. Require TOTP for privileged roles; configure SMTP and gateway signature secrets; use private object storage or a protected persistent volume; configure CSP nonces if policy requires removing the minimal Next.js inline bootstrap allowance; run penetration and dependency reviews; and establish log retention, recovery drills, alerting, malware scanning for future upload extensions, and least-privilege infrastructure accounts.
