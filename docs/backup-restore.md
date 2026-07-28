# Backup and restoration

Use encrypted PostgreSQL snapshots plus periodic logical dumps. Back up private media separately. Redis work can be reconstructed from `BackgroundJob`, though Redis persistence remains enabled.

```bash
pg_dump --format=custom --no-owner --file=trendy-life.dump "$DATABASE_URL"
createdb trendy_life_restore
pg_restore --clean --if-exists --no-owner --dbname=trendy_life_restore trendy-life.dump
```

Restore into isolation first. Validate counts, order/payment totals, migrations, authentication, invoice access, and recent audit records. Document RPO/RTO, run recovery drills, and restrict backup access.
