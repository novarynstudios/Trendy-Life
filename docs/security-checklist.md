# Production security checklist

- Replace Compose, SMTP, gateway, courier, database, Redis, and administrator bootstrap credentials.
- Store secrets in a manager; use TLS for databases, queues, SMTP, storage, and APIs.
- Require TOTP for privileged roles and review named-account access.
- Verify trusted proxy headers, canonical `APP_URL`, CSRF origins, secure cookies, and HSTS.
- Configure nonce/hash CSP if policy requires removing Next.js bootstrap `unsafe-inline`.
- Restrict exports/audit, define PII retention, and verify gateway algorithms against current vendor documentation.
- Run `npm audit`, SAST, DAST, licensing, penetration tests, and human review.
- Before uploads, require private storage, signed access, MIME/signature/size validation, metadata stripping, and malware scanning.
- Test encrypted backups; alert on login failures, refunds, permissions, webhooks, jobs, and readiness.
