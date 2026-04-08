# Kart Runbook

Operational reference for running Kart in production. Pair with `README.md` for setup steps.

---

## Architecture at a glance

One Hetzner CX32 host runs four containers via Kamal 2:

- `kart-web` — Rails 8 + Solid Queue producer behind kamal-proxy (Let's Encrypt SSL)
- `kart-worker` — `bin/jobs` Solid Queue consumer
- `kart-sidecar` — Node 20 + Fastify + Playwright (real Chromium with stealth) for the Tesco build flow
- `kart-db` — Postgres 16 accessory

In production, `TESCO_MODE=live` and `TESCO_BASE_URL=https://www.tesco.com`. The sidecar routes Chromium through a residential proxy via `PROXY_PROVIDER_*`.

---

## Deploying

```
# Staging (mock Tesco, Stripe test mode)
kamal deploy

# Production (real Tesco, live Stripe)
kamal -d production deploy
```

The post-deploy hook runs `bin/rails db:prepare`, so migrations apply automatically.

To target a specific role:

```
kamal -d production app exec --reuse "bin/rails console"   # Rails console
kamal -d production logs                                    # tail web logs
kamal -d production logs -r sidecar                         # tail sidecar logs
kamal -d production logs -r worker                          # tail jobs
```

---

## Stripe webhooks (dev)

```
stripe listen --forward-to localhost:3000/webhooks/stripe
```

The CLI prints a `whsec_…` secret — copy it into `STRIPE_WEBHOOK_SECRET` for the dev shell.

---

## Common operational tasks

### Check the deploy status

```
kamal -d production app details
kamal -d production proxy details
```

### Tail recent build activity

```
kamal -d production logs | grep BasketBuild
kamal -d production logs -r sidecar | grep build_id
```

### A user's build is stuck

1. Find the build:
   ```
   kamal -d production console
   > BasketBuild.where(status: %w[matching building paused_verification paused_existing_basket]).order(created_at: :desc).limit(20)
   ```
2. Check the last `progress_log` event for context.
3. If stuck in `paused_verification` and the user can't satisfy the challenge, mark it cancelled:
   ```
   > build.update!(status: :cancelled, error_message: "stuck — manually cancelled")
   ```
4. The recurring `CleanupStalePausedBuildsJob` will eventually do this automatically after 30 minutes.
5. If stuck in `building`, the sidecar Chromium session is the most likely culprit. Check sidecar logs and restart the role if needed:
   ```
   kamal -d production app boot -r sidecar
   ```

### A user's Tesco account got locked out

1. The user must complete Tesco's recovery flow themselves — we cannot do this for them.
2. While they sort it out, clear their stored credentials so future builds don't keep tripping the lockout:
   ```
   > User.find_by(email: "...").update!(tesco_email: nil, tesco_password: nil)
   ```
3. Ask them to re-enter credentials in `/preferences/edit` once recovery is complete.

### Rotating the dev Tesco test account (live mode smoke tests)

We keep one or two throwaway Tesco test accounts for production smoke tests. Rotate them periodically:

1. Create a fresh tesco.com account with a unique email (e.g. `test+kart-yyyy-mm@…`).
2. Update the credentials stored on the dedicated test user:
   ```
   > User.find_by(email: "smoketest@kart.app").update!(tesco_email: "...", tesco_password: "...")
   ```
3. Run a smoke build through `/list → Add to Tesco basket` and verify the basket arrives.

### Refunds

We don't expose refund tooling in the app. Issue them via the Stripe dashboard:

1. Stripe Dashboard → Customers → search by email
2. Find the most recent invoice → Refund
3. The webhook fires `charge.refunded`; we don't process it (no-op). Subscription state on Kart is unaffected unless the customer also cancels.

### Cancelling a subscription

The user can self-serve via `/billing` → Manage subscription (Stripe Customer Portal). If you must do it for them:

1. Stripe Dashboard → Customer → Subscription → Cancel.
2. The `customer.subscription.deleted` webhook fires; `StripeWebhookHandler` flips the local `Subscription` row and `User#subscription_status` to `cancelled`.

---

## Pre-launch checklist

Tick everything before pointing real users at the production URL.

### Infrastructure
- [ ] DNS A/AAAA records for `kart.app` (or chosen domain) point at the Hetzner box
- [ ] DNS propagation verified (`dig +short kart.app` returns the right IP from multiple resolvers)
- [ ] `kamal -d production deploy` succeeds end-to-end
- [ ] HTTPS works — Let's Encrypt certificate issued and auto-renewing
- [ ] `/up` health check returns 200

### Tesco
- [ ] Residential proxy account credited and tested (`PROXY_PROVIDER_*` set)
- [ ] One real end-to-end build from a throwaway Tesco test account succeeds
- [ ] After the smoke test, the test Tesco basket is empty (no items left behind)
- [ ] Verification challenge interrupt path manually exercised at least once

### Stripe
- [ ] Stripe account out of test mode (live keys generated)
- [ ] Live products + prices created in the dashboard
- [ ] `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_ANNUAL` updated with live IDs
- [ ] Live webhook endpoint added in the Stripe dashboard pointing at `https://kart.app/webhooks/stripe`
- [ ] `STRIPE_WEBHOOK_SECRET` updated with the live signing secret
- [ ] One real subscription paid with a real card → confirmed local `Subscription` row appears → refunded via dashboard

### Email
- [ ] Resend sending domain verified (DKIM/SPF/DMARC records live)
- [ ] `RESEND_API_KEY` is the production key, not the dev key
- [ ] One real "Your Tesco basket is ready" email arrives in a real inbox

### Legal & content
- [ ] Privacy policy page published and linked from the footer
- [ ] Terms of service page published and linked from the footer
- [ ] Tesco credentials trust copy reviewed by a second pair of eyes

### Observability
- [ ] Exception monitoring wired up (Appsignal free tier or similar)
- [ ] Alerting on uncaught exceptions and failed builds
- [ ] Log retention configured (kamal app logs ships to host journald)

### Sanity sweep
- [ ] All tests green locally (`bin/rails test`, `bin/rails test:system`, `npm test` in `sidecar/`)
- [ ] One full happy-path manual test on production: signup → list → preferences → Add to basket → email → checkout link → Stripe upgrade

---

## Post-launch

The first real users will surface bugs that testing won't. Budget the first week for hotfix work before starting any new features. Watch match quality closely — if it falls below 85%, prioritise the correction UX and per-user memory improvements before anything else.
