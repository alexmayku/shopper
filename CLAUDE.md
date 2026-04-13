# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kart is a shared grocery list app that turns freeform items into a ready-to-checkout Tesco basket. It's a Rails 8 app with a Node.js sidecar for browser automation.

## Architecture

```
Browser ──> Rails (Puma :3000) ──> Solid Queue ──> BuildBasketJob ──> Node sidecar (Fastify :4001)
  ^              |                                                         |
  |              |                                                    Playwright + stealth
  └──Turbo Streams (Solid Cable)──┘                                        |
                                                                     tesco.com (via proxy)
```

**Rails app** — Hotwire (Turbo + Stimulus), Tailwind CSS, PostgreSQL, importmap (no bundler). Auth is `has_secure_password` (no Devise). Tesco credentials are encrypted at rest via Rails `encrypts`. Billing via Stripe (Checkout + webhooks). Email via Resend.

**Node sidecar** (`sidecar/`) — Fastify server that orchestrates Tesco automation: login, search products, match items via Claude Haiku API, add to basket, checkout. Uses Playwright with stealth plugins through a residential proxy. All requests are HMAC-SHA256 signed.

**Communication** — Rails enqueues `BuildBasketJob` which calls sidecar's `POST /build`. Sidecar posts progress back to Rails via `/internal/builds/:id/*` callback endpoints. Real-time UI updates flow through Turbo Streams over Solid Cable (Postgres-backed ActionCable).

**Database** — Single PostgreSQL 16 instance backs everything: app data, Solid Queue, Solid Cable, and Solid Cache.

## Development Workflow

Always use red/green/refactor TDD: write a failing test first (red), make it pass with the simplest change (green), then refactor. Do not write implementation code without a failing test driving it.

Commit after every meaningful change — don't batch up large sets of changes across multiple features. Each commit should be a coherent, self-contained unit of work.

## Development Commands

```bash
bin/setup                  # First-time setup (gems, DB, migrations)
bin/dev                    # Start all 5 processes (Rails, worker, CSS, sidecar, mock Tesco)
```

### Rails
```bash
bin/rails test                                    # All tests (parallel)
bin/rails test test/models/user_test.rb           # Single file
bin/rails test test/models/user_test.rb:42        # Single test by line
bin/rails test:system                             # System tests (Capybara + Selenium)
bin/rubocop                                       # Lint
bin/rubocop --fix                                 # Auto-fix
bin/rails console                                 # REPL
bin/rails db:prepare                              # Create + migrate (idempotent)
```

### Sidecar
```bash
cd sidecar && npm test                            # Vitest
cd sidecar && PORT=4001 npm run dev               # Dev server with --watch
cd sidecar && PORT=4002 npm run mock-tesco        # Mock Tesco server
```

### Deployment (Kamal 2)
```bash
kamal deploy                    # Staging
kamal -d production deploy      # Production
```

## Key Architectural Details

- **Basket build lifecycle**: `POST /basket_builds` -> `BuildBasketJob` -> `SidecarClient` -> sidecar `runBuild()` -> callbacks to `/internal/builds/:id/{progress,completed,failed,existing_basket_detected,verification_required}`
- **Product matching**: sidecar searches Tesco, sends results to Claude Haiku for structured matching, caches matches per-user in `product_matches` table via Rails `/internal/users/:user_id/product_matches`
- **Shared lists**: anonymous collaborators access via `/s/:share_token` routes; tracked by `CollaboratorSession`
- **Subscription gating**: `User#can_build_basket?` checks subscription status or trial eligibility before allowing builds
- **Chrome attach mode**: In dev, `bin/chrome-tesco` launches Chrome with debugger on port 9222; sidecar attaches via CDP (`CHROME_CDP_URL`) to use a human-logged-in session that bypasses Akamai bot detection
- **Recurring jobs**: Solid Queue runs `config/recurring.yml` — currently just hourly cleanup of finished queue jobs in production

## Docs

- `docs/prd.md` — Product spec
- `docs/trd.md` — Technical spec
- `docs/build-plan.md` — Build plan
- `docs/runbook.md` — Operational runbook
