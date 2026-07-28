# Docker and production deployment

Use immutable images, managed PostgreSQL, private Redis, and private object storage where possible.

```bash
docker compose build
docker compose run --rm app npm run db:migrate:deploy
docker compose up -d app worker scheduler
```

Enforce HTTPS at a reverse proxy and preserve `Host`, `X-Forwarded-Proto`, and trusted client-IP headers. Limit request bodies; never expose database or Redis ports.

Run web, worker, and scheduler processes. Health-check `/api/health`; gate traffic on `/api/readiness`. Centralize JSON logs and alert on failed jobs, webhooks, and readiness.

Rollout order: backup, migration, worker, web, readiness, staff-login and sandbox-gateway smoke tests, then traffic. Only roll back application images when the schema is backward compatible.
