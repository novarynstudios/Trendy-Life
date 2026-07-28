# Testing

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Unit tests cover permissions, money/tax calculations, discounts, inventory, refunds, status transitions, password policy/Argon2id, webhook signatures/timestamps, and TOTP enrollment.

For browser tests, run a disposable environment and configure an administrator through `.env`:

```bash
E2E_ADMIN_EMAIL="$ADMIN_EMAIL"
E2E_ADMIN_PASSWORD="$ADMIN_PASSWORD"
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
npm run test:e2e
```

Never point tests or bootstrap commands at production.
