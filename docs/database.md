# Database migrations and administrator bootstrap

The PostgreSQL schema is in `prisma/schema.prisma`; the initial SQL migration is under `prisma/migrations`.

```bash
npm run db:migrate          # development only
npm run db:generate
npm run db:migrate:deploy   # deployment
```

Never run `migrate dev` in production. Review generated SQL, back up before destructive changes, and use expand/migrate/contract for zero-downtime transitions.

`npm run db:setup` creates the permission catalog, system roles, and exactly one administrator from `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. It intentionally does not create placeholder customers, products, orders, payments, coupons, reviews, tickets, content, or analytics. Create operational records through the admin workflows or an approved import process.
