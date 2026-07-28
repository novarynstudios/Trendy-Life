# Installation and local development

1. Install Node.js 22+, npm, Docker, and Docker Compose.
2. Copy `.env.example` to `.env`; generate `AUTH_SECRET` and `APP_ENCRYPTION_KEY`, and set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. Start dependencies: `docker compose up -d postgres redis`.
4. Run `npm ci` and `npm run db:setup`. This creates only configured roles, permissions, and the administrator account; it intentionally creates no demo records.
5. Start `npm run dev`, `npm run worker`, and `npm run scheduler` in separate terminals.
6. Visit `http://localhost:3000/admin/login`.

The legacy public storefront remains available while the new admin uses PostgreSQL. `DATABASE_PATH` is transitional storefront-only configuration.

For a clean local reset, stop the application, explicitly remove only the development Docker volumes, restart the services, and run `npm run db:setup` again. Never use a volume-reset procedure against production.
