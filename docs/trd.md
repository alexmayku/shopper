# Kart — Technical Requirements v1.0

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| Web framework | Rails 8 + Hotwire (Turbo + Stimulus) | Real-time list sync is a one-line Turbo Stream broadcast. Solo-dev friendly. Batteries-included. |
| Database | PostgreSQL 16 | Single store for app data, jobs, cache, and cable pub/sub via Rails 8's Solid* adapters. |
| Background jobs | Solid Queue (Rails 8 native) | No Redis/Sidekiq needed. Postgres-backed, ships with Rails 8. |
| Real-time | Solid Cable (Rails 8 native) over Turbo Streams | Postgres-backed ActionCable. Powers both list sync and build progress streaming. |
| Browser automation | Node sidecar running Playwright + `playwright-extra` + `puppeteer-extra-plugin-stealth` | Best-in-class stealth tooling only exists in Node. Rails workers call the sidecar over internal HTTP. |
| Proxy layer | Residential proxy pool (IPRoyal or Bright Data), UK-geotargeted, sticky session per user | Mitigates single-IP bot-detection risk. Each user's Tesco session routes through a stable UK residential IP. |
| Item matching | Anthropic Claude Haiku via API with structured JSON output | Fast, cheap, structured outputs, good at fuzzy product resolution. One call per uncached item. |
| Auth | Rails 8 built-in `has_secure_password` + sessions | No Devise. No OAuth. Email + password is enough for v1. |
| Credentials encryption | Rails 8 encrypted attributes (`encrypts :tesco_password, deterministic: false`) | Built-in. Key held in env var. Decrypted only inside the worker at build time. |
| Payments | Stripe (Checkout Session + Customer Portal + webhooks) | Standard. Zero custom billing UI. |
| Email | Resend via `resend-ruby` gem | Simple DX, one template in v1. |
| CSS | Tailwind CSS (via `tailwindcss-rails`) | Default. Fast to build clean mobile-first UI. |
| PWA | Rails 8 built-in PWA scaffolding (manifest + service worker) | Ships with Rails 8. No extra tooling. |
| Testing | Minitest + Capybara system tests (driven by Playwright) + request specs | TDD discipline. System tests cover the core flow end-to-end against a mocked Tesco. |
| Hosting | Single Hetzner CX32 VPS (~£12/mo), Ubuntu 24.04 | Runs Rails, Postgres, Solid Queue, and Node sidecar. Scale out when it hurts. |
| Deployment | Kamal 2 | Zero-downtime deploys to the VPS. |
| Monitoring | Rails 8 built-in logs + Appsignal (free tier) | Minimal. Enough to catch build failures. |

## Architecture Overview

Kart is a Rails 8 monolith running on a single VPS alongside a small Node sidecar for browser automation. Requests from the browser hit Rails, which serves Hotwire-driven HTML and pushes real-time updates via Solid Cable.

List editing is pure Rails: a `ListItem` create/update broadcasts a Turbo Stream to all subscribers on that list's channel, giving sub-second sync between collaborators without any custom JavaScript.

The basket build is a long-running background job. When a user clicks "Add to Basket," Rails enqueues a `BuildBasketJob` via Solid Queue. The job creates a `BasketBuild` record (status: matching), resolves each list item to a Tesco product via Claude Haiku (checking the `ProductMatch` cache first), then transitions to status: building and calls out to the Node sidecar over HTTP to drive the Tesco session. The sidecar posts progress back to a Rails internal endpoint, which updates the `BasketBuild` record and broadcasts a Turbo Stream to the user's progress channel. When the build completes (or fails, or hits a verification challenge), the same mechanism updates the UI. If the user closed the tab, a completion webhook dispatches a Resend email with a deep link back into the handoff screen.

```
Browser ──HTTP──> Rails (Puma)
   ^                │
   │                ├── Solid Queue ──> BuildBasketJob ──HTTP──> Node sidecar
   │                │                          │                      │
   │                │                          │                      ├─> Playwright + stealth
   │                │                          │                      └─> Residential proxy ──> tesco.com
   │                │                          │
   │                │                          └──> Anthropic API (Claude Haiku)
   │                │
   └──Solid Cable───┤
   (Turbo Streams)  │
                    └── Postgres (app data + jobs + cable)
```

Everything except the Anthropic API, Stripe, Resend, the proxy, and Tesco lives on one box.

## Data Schema

Migration-style. All tables get `id bigint pk`, `created_at`, `updated_at` unless noted.

**users**
- `email` string, not null, unique index
- `password_digest` string, not null
- `stripe_customer_id` string, nullable, unique index
- `subscription_status` enum (`none`, `trialing`, `active`, `past_due`, `cancelled`), default `none`
- `trial_used` boolean, default false
- `tesco_email` string, encrypted, nullable
- `tesco_password` string, encrypted, nullable
- `price_range` enum (`budget`, `mid`, `premium`), default `mid`
- `organic_preference` boolean, default false

**lists**
- `owner_user_id` bigint fk users, not null, unique (one list per owner in v1)
- `name` string, default "Shopping"
- `share_token` string, not null, unique index (unguessable, rotatable)

**list_items**
- `list_id` bigint fk lists, not null, index
- `freeform_text` string, not null
- `quantity` integer, not null, default 1
- `position` integer, not null
- `added_by_user_id` bigint fk users, nullable (null = anonymous collaborator)
- `added_by_session_id` string, nullable (for anonymous collaborators)

**product_matches**
- `user_id` bigint fk users, not null
- `freeform_text` string, not null
- `tesco_product_id` string, not null
- `tesco_product_name` string, not null
- `tesco_product_url` string
- `price_pence` integer
- `confidence` float
- `last_used_at` datetime
- unique index on (`user_id`, `freeform_text`)

**basket_builds**
- `user_id` bigint fk users, not null, index
- `list_snapshot` jsonb, not null (frozen copy of list items at build start)
- `status` enum (`matching`, `building`, `paused_verification`, `ready`, `failed`, `cancelled`), index
- `progress_log` jsonb, default `[]` (append-only list of status events)
- `unmatched_items` jsonb, default `[]`
- `tesco_checkout_url` string, nullable
- `total_pence` integer, nullable
- `error_message` string, nullable
- `completed_at` datetime, nullable

**subscriptions**
- `user_id` bigint fk users, not null, unique
- `stripe_subscription_id` string, unique
- `status` string
- `current_period_end` datetime

**collaborator_sessions** (for anonymous list access)
- `list_id` bigint fk lists, not null
- `session_id` string, not null
- `display_name` string, nullable
- `last_seen_at` datetime
- unique index on (`list_id`, `session_id`)

## API / Route Design

Conventional Rails resourceful routes. Scoped to what the PRD needs — no speculative endpoints.

**Auth**
- `GET /signup`, `POST /signup` → creates user, signs in, redirects to list
- `GET /login`, `POST /login`, `DELETE /logout`

**List (owner)**
- `GET /list` → renders owner's list
- `POST /list/items` → creates item, broadcasts Turbo Stream
- `PATCH /list/items/:id` → updates quantity/text, broadcasts
- `DELETE /list/items/:id` → removes item, broadcasts
- `POST /list/clear` → clears all items
- `POST /list/share_token/rotate` → regenerates share token

**List (collaborator via share link)**
- `GET /s/:share_token` → sets collaborator session cookie, renders list
- `POST /s/:share_token/items`, `PATCH`, `DELETE` → same as owner endpoints but scoped via share token

**Preferences**
- `GET /preferences`, `PATCH /preferences` → price range, organic toggle, Tesco credentials

**Basket build (owner only)**
- `POST /builds` → creates BasketBuild, enqueues BuildBasketJob, redirects to build show
- `GET /builds/:id` → matching / building / ready / failed UI, subscribes to progress channel
- `POST /builds/:id/resume` → resumes a paused_verification build
- `POST /builds/:id/existing_basket_decision` → body: `{action: "replace" | "merge" | "cancel"}`
- `POST /builds/:id/corrections` → body: `{freeform_text, tesco_product_id}` — updates ProductMatch

**Internal (Node sidecar → Rails)**
- `POST /internal/builds/:id/progress` → body: progress event; HMAC-signed with shared secret
- `POST /internal/builds/:id/verification_required`
- `POST /internal/builds/:id/completed` → body: tesco_checkout_url, total_pence, unmatched_items
- `POST /internal/builds/:id/failed` → body: error_message

**Stripe**
- `POST /billing/checkout` → creates Stripe Checkout Session, redirects
- `GET /billing/portal` → redirects to Customer Portal
- `POST /webhooks/stripe` → handles `customer.subscription.*` events

## External Integrations

### Tesco (headless browser via Node sidecar)

No public API. The sidecar exposes one endpoint:

`POST /build` body: `{buildId, tescoEmail, tescoPassword, items: [{freeform, tescoProductId, quantity}], existingBasketAction, rails_callback_url, hmac_secret}`

Inside the sidecar: launch Chromium via `playwright-extra` with stealth plugin, route through a sticky residential proxy keyed by `buildId`'s user, navigate to tesco.com, log in, detect any verification challenge (→ POST verification_required to Rails and pause), handle existing basket per `existingBasketAction`, add each product by navigating to its PDP and clicking add, post progress after each item, post completion with the checkout URL extracted from the basket page.

Error handling: every Playwright action wrapped with a timeout and retry-once policy. On unrecoverable failure, POST failed to Rails with the error. On captcha detection: POST verification_required and wait up to 30 minutes for a resume call; on timeout, cancel cleanly (don't leave items in the basket if possible — best effort).

Rate limits: one concurrent build per user. Global cap of 5 concurrent builds on the v1 box (tunable). Additional requests queue.

### Stripe

Standard subscription flow. Checkout Session created with `mode: subscription`, success URL back into the app, cancel URL to the paywall. Customer Portal for self-serve management. Webhook endpoint verifies signature and updates the local `subscriptions` record on `customer.subscription.created/updated/deleted`.

### Anthropic Claude Haiku

One `messages.create` call per uncached item. System prompt embeds the user's price range and organic preference. User message contains the freeform text and a shortlist of Tesco search results (scraped by the sidecar in a lightweight search-only pass before the main build, OR queried via a separate pre-build worker — see implementation note below). Tool use / structured output enforces a JSON response: `{tesco_product_id, confidence, reasoning}`.

Implementation note: the matching phase actually needs Tesco product data to pick from. Two options — (a) do a lightweight search pass inside the sidecar before the main basket build, returning top-5 search results per item for Claude to choose from, or (b) maintain a product catalogue. Option (a) for v1 — no catalogue to maintain, always fresh. This means matching runs inside the same sidecar session as the build, which is fine and actually simplifies session state.

### Resend

One transactional email in v1: "Your basket is ready." Triggered from the `BasketBuild` completion callback when the user's browser session is no longer connected to the progress channel.

## Background Jobs

**BuildBasketJob** (Solid Queue, queue: `builds`)
- Input: `basket_build_id`
- Flow: load BasketBuild, mark as `matching`, call sidecar's `/build` endpoint (the sidecar handles both matching and basket construction in one session). Job blocks on the HTTP call with a long timeout (10 min). Progress and terminal states flow back via the internal callbacks, not via this job's return value.
- Retries: none. Retry is user-initiated via the UI.

**CleanupStalePausedBuildsJob** (Solid Queue recurring, every 5 min)
- Finds BasketBuilds in `paused_verification` status older than 30 min, marks them `cancelled`.

**SendBasketReadyEmailJob** (Solid Queue, queue: `default`)
- Triggered when BasketBuild completes and the user's browser isn't connected to the progress channel (tracked via a Rails cache key set on progress page connect/disconnect).

## Auth Implementation

Rails 8 built-in. `User` model with `has_secure_password`. Sessions stored server-side in the `sessions` table (Rails 8 default) — not cookies — so we can invalidate sessions if needed. Login sets a signed `session_id` cookie.

Collaborator access: no user account. A signed `collaborator_session_id` cookie is set on first visit to `/s/:share_token` and maps to a `collaborator_sessions` row. This gives each anonymous user a stable identity for presence and "added by" attribution.

Role check: Add to Basket routes use a `before_action :require_owner` that checks `current_user.present? && current_user.lists.include?(@list)`. Collaborators get a 403.

Password hashing: bcrypt (Rails default).

No email verification in v1. No password reset in v1 (added early v1.1 if needed — low risk during beta).

## File / Asset Handling

No user-uploaded files in v1. Tailwind compiled at build time. PWA icons ship with the repo. No Active Storage needed.

## Environment & Configuration

Required env vars:
- `DATABASE_URL`
- `SECRET_KEY_BASE`
- `RAILS_MASTER_KEY` (for encrypted attributes)
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`
- `RESEND_API_KEY`
- `SIDECAR_URL` (e.g. `http://localhost:4001`)
- `SIDECAR_HMAC_SECRET` (shared secret for sidecar ↔ Rails callbacks)
- `PROXY_PROVIDER_USER`, `PROXY_PROVIDER_PASS`, `PROXY_PROVIDER_HOST`
- `APP_HOST` (for absolute URLs in emails)

Secrets managed via Rails encrypted credentials in production; env vars in dev.

## Deployment

**Initial provisioning** (one-off):
1. Hetzner CX32 with Ubuntu 24.04
2. Install Docker
3. Install Kamal 2 on local dev machine
4. Run `kamal setup`

**Kamal config** runs two services on the same host:
- `web` (Rails app, Puma, includes Solid Queue workers in the same container via `bin/jobs` or a separate role)
- `sidecar` (Node + Playwright Docker image — `mcr.microsoft.com/playwright:v1.x-jammy` base)
- `postgres` (accessory)

**Database migrations** via `kamal app exec 'bin/rails db:migrate'` as a post-deploy hook.

**Zero-downtime**: Kamal handles via rolling restart. Long-running basket builds are safe because the sidecar is a separate container and workers gracefully drain.

**CI/CD**: GitHub Actions runs tests on push. On merge to `main`, runs `kamal deploy`.

**No app store submission** — this is a PWA.

## Testing Strategy

**Unit tests** (Minitest): models, service objects, ProductMatch cache logic, Stripe webhook handlers.

**Request tests**: every controller action including the internal sidecar callback endpoints (with HMAC signature verification).

**System tests** (Capybara + Playwright driver): the critical flows —
1. Sign up, add items, share link, second session joins and sees edits in real time
2. Owner clicks Add to Basket, sees matching → building → ready screens, clicks through to Tesco handoff
3. Paywall triggers on second build attempt
4. Verification interrupt pause/resume

**Sidecar tests**: the Node sidecar has its own test suite (Vitest + a mock Tesco HTTP server). Rails tests mock the sidecar at the HTTP boundary.

**TDD workflow**: every feature starts with a failing test. Red → green → refactor. No feature merges without tests.

**Coverage target**: not enforced numerically, but every controller action, every job, and every service object has at least one test.

## Development Environment Setup

Zero-to-running steps:

1. `git clone` the repo
2. `bin/setup` (runs bundle install, yarn install in sidecar dir, db create + migrate + seed)
3. `cp .env.example .env` and fill in local API keys (Anthropic, Stripe test keys, Resend test key). Proxy vars can be blank in dev — sidecar detects and connects direct.
4. `bin/dev` — starts Rails, Solid Queue, Tailwind watcher, and the Node sidecar via Procfile.dev
5. Visit `http://localhost:3000`
6. To test the basket build without hitting real Tesco, set `TESCO_MODE=mock` — sidecar runs against a bundled mock Tesco HTML server.

Prerequisites: Ruby 3.3+, Node 20+, Postgres 16, Playwright browsers (`npx playwright install chromium` inside the sidecar dir).

---

*Sign-off: TRD v1.0 is ready for review. Phase 3 (Build Plan) begins only on explicit approval.*
