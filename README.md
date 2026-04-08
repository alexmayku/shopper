# Kart

A shared grocery list that turns freeform items into a ready-to-checkout Tesco basket in one click.

## Prerequisites

- Ruby 3.3+
- Node 20+
- PostgreSQL 16+

## Local development

```
bin/setup
bin/dev
```

`bin/dev` runs Rails, the Solid Queue worker, the Tailwind watcher, the Node sidecar (`localhost:4001`), and the mock Tesco server (`localhost:4002`) together.

## Deployment (staging)

Staging is deployed via Kamal 2 to a single Hetzner box. It runs four services on one host:

- `kart-web` — the Rails app behind kamal-proxy with Let's Encrypt SSL
- `kart-worker` — `bin/jobs` Solid Queue process
- `kart-sidecar` — Node Fastify build/search/mock-tesco container (Playwright base image)
- `kart-db` — Postgres 16 accessory

Staging still runs against mock Tesco (`TESCO_MODE=mock`) and Stripe test mode. The live switch is the next prompt.

### One-time provisioning

```
kamal setup
```

Required environment variables (set them locally before running `kamal deploy`; `.kamal/secrets` interpolates them):

- `KAMAL_REGISTRY_USERNAME`, `KAMAL_REGISTRY_PASSWORD` — GHCR creds
- `KART_WEB_HOST` — Hetzner IP
- `KART_HOST` — staging hostname (e.g. `staging.kart.app`)
- `DATABASE_URL`, `SECRET_KEY_BASE`, `POSTGRES_PASSWORD`
- `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`,
  `RESEND_API_KEY`, `SIDECAR_HMAC_SECRET`

### Deploying

```
kamal deploy
```

The post-deploy hook runs `bin/rails db:prepare`. Useful aliases:

- `bin/kamal logs` — tail web logs
- `bin/kamal logs -r sidecar` — tail sidecar logs
- `bin/kamal console` — Rails console on the live container
- `bin/kamal migrate` — run migrations on demand

## Production

```
kamal -d production deploy
```

Production runs against real tesco.com via a residential proxy and live Stripe. Required extra env vars: `KART_PROD_WEB_HOST`, `KART_PROD_HOST`, `PROXY_PROVIDER_USER`, `PROXY_PROVIDER_PASS`, `PROXY_PROVIDER_HOST`, plus the `KART_PROD_*`-prefixed equivalents of every secret in `.kamal/secrets.production`.

Full operational reference, runbook, and the pre-launch checklist are in [`docs/runbook.md`](docs/runbook.md).

### Stripe webhooks in dev

```
stripe listen --forward-to localhost:3000/webhooks/stripe
```
