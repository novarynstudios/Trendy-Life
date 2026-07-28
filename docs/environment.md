# Environment variables

Core:

- `DATABASE_URL`: PostgreSQL URI for a least-privilege application account.
- `REDIS_URL`: private Redis URI used by limits and BullMQ.
- `AUTH_SECRET`: at least 32 unpredictable characters.
- `APP_ENCRYPTION_KEY`: exactly 64 hexadecimal characters for AES-256-GCM secrets.
- `APP_URL`: canonical HTTPS origin in production.
- `NODE_ENV`, `LOG_LEVEL`: runtime mode and structured logging.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: one-time local administrator bootstrap values used by `npm run db:setup`; they are never generated or supplied by the application.

Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, and `SMTP_FROM_NAME`.

Storage: `STORAGE_DRIVER`, `STORAGE_LOCAL_PATH`, and `STORAGE_S3_*`. Keep storage private and issue signed, authorized access.

Payments:

- SSLCommerz: `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, and `SSLCOMMERZ_IS_LIVE`. Keep live mode `false` until sandbox certification is complete.
- UddoktaPay: `UDDOKTAPAY_BASE_URL` and `UDDOKTAPAY_API_KEY`.
- `SSLCOMMERZ_WEBHOOK_SECRET` and `UDDOKTAPAY_WEBHOOK_SECRET` secure the optional normalized adapter intake route; vendor checkout callbacks use direct server verification.
- `PAYMENT_WEBHOOK_ENCRYPTION_KEY` protects future encrypted gateway webhook material.

These are the only two storefront gateways. Courier placeholders are also server-only.

Monitoring: `MONITORING_DSN`, `MONITORING_ENVIRONMENT`, and `LOG_LEVEL`.

Never prefix secrets with `NEXT_PUBLIC_`. Validate production secrets in the deployment secret manager and rotate them on suspected exposure.
