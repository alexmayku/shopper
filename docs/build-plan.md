# Kart — Build Plan v1.0

A sequence of Claude Code prompts that takes the project from an empty directory to a deployed, paid, working application. Run them in order. Do not skip ahead.

---

## Overview

- **Total prompts:** 27
- **Estimated build time:** 3–5 focused days for a competent developer working alongside Claude Code; longer if you're learning Rails 8 / Hotwire as you go.
- **Prerequisites before Prompt 1:**
  - Ruby 3.3+, Node 20+, Postgres 16 installed locally
  - A GitHub repo created (empty)
  - Accounts created (free/dev keys only): Anthropic, Stripe (test mode), Resend (free tier)
  - The PRD and TRD saved at `./docs/prd.md` and `./docs/trd.md`
- **Cost during development:** effectively £0. Stripe runs in test mode, Tesco runs against a local mock, Resend is on the free tier, Anthropic is pay-per-use and will cost pennies. Hetzner + residential proxies + live keys only come in at Prompt 26.

## Recovery Protocol

**When a prompt fails:** do not move to the next prompt. Re-run the failed prompt with additional context about what went wrong (paste the error, describe what you saw). If it fails twice, simplify — split the prompt into two smaller prompts. Never skip a failing prompt and hope the next one fixes it. If a prompt produces partial output (some files correct, others broken), revert the broken files via `git checkout` and re-run with the working files as context.

**Test discipline:** every prompt ends with "all tests pass." If they don't, stop. Don't proceed with red tests.

**Commit discipline:** commit after every successful prompt. One prompt = one commit minimum. Makes recovery trivial.

## Dependency Map

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27
```

Mostly linear. Specifically:

- Prompts 1–5 are foundation (Rails scaffold, DB, auth, layout). Strict order.
- Prompts 6–10 are the list + real-time sync feature. Depend on 1–5.
- Prompts 11–13 are the sidecar (Node + Playwright + mock Tesco). Can be built in parallel with 6–10 if two developers, but plan is linear.
- Prompts 14–19 are the basket build flow. Depend on 1–13.
- Prompts 20–22 are paywall + Stripe. Depend on 1–5.
- Prompts 23–25 are polish, edge cases, PWA.
- Prompts 26–27 are deployment and live-key switch.

---

# The Prompt Sequence

---

## Prompt 1 of 27: Project Initialisation

### Context
You are building Kart, a shared grocery list that turns freeform items into a ready-to-checkout Tesco basket in one click. The PRD is at `./docs/prd.md`. The Technical Requirements are at `./docs/trd.md`.

### What Already Exists
An empty directory with `./docs/prd.md` and `./docs/trd.md` already present. A GitHub repo exists but is empty.

### What This Prompt Builds
A fresh Rails 8 project with Postgres, Tailwind, Hotwire, Solid Queue, Solid Cable, and the PWA defaults. Initial commit. CI skeleton.

### Files to Create or Modify
- Standard Rails 8 scaffold (Gemfile, config/, app/, etc.)
- `.github/workflows/ci.yml`
- `README.md` (one paragraph + setup steps)
- `.env.example`

### Detailed Requirements
- Run `rails new . --database=postgresql --css=tailwind --javascript=importmap --skip-jbuilder` (or equivalent Rails 8 invocation).
- Confirm Rails 8 is installed — Solid Queue, Solid Cable, and Solid Cache should be enabled in `config/environments/production.rb`.
- Enable Rails 8 PWA defaults (`config/initializers/pwa.rb` or default manifest/service worker files).
- Add these gems: `bcrypt` (for auth), `resend` (for email later), `stripe` (for billing later), `anthropic` or `ruby-openai`-equivalent Anthropic client (pick a maintained gem; if none, plan to use `Faraday` directly — state the choice in the commit message).
- Set up GitHub Actions CI: one job that runs `bin/rails db:prepare && bin/rails test`.
- `.env.example` lists every env var from the TRD's "Environment & Configuration" section.
- `README.md` contains only: what the app is (one line), prerequisites, and `bin/setup && bin/dev` to run locally.
- Initial git commit: "Initial Rails 8 scaffold."

### TDD Workflow
1. Rails scaffold ships with a placeholder test. Make sure `bin/rails test` passes.
2. No new tests in this prompt — it's pure scaffolding.

### Acceptance Criteria
- [ ] `bin/rails server` starts without error
- [ ] `bin/rails test` passes (Rails default tests)
- [ ] `bin/rails db:prepare` creates dev and test databases
- [ ] `.env.example` lists all env vars from TRD
- [ ] GitHub Actions CI runs green on the first push
- [ ] PWA manifest and service worker exist in `public/`

---

## Prompt 2 of 27: Database Schema — Full Migration Set

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`.

### What Already Exists
A fresh Rails 8 scaffold from Prompt 1. No domain models yet.

### What This Prompt Builds
Every table from the TRD's Data Schema section, as a single coherent set of migrations. No models yet — just tables and indices.

### Files to Create or Modify
- `db/migrate/*_create_users.rb`
- `db/migrate/*_create_lists.rb`
- `db/migrate/*_create_list_items.rb`
- `db/migrate/*_create_product_matches.rb`
- `db/migrate/*_create_basket_builds.rb`
- `db/migrate/*_create_subscriptions.rb`
- `db/migrate/*_create_collaborator_sessions.rb`
- `db/schema.rb` (generated)

### Detailed Requirements
Copy the schema exactly from the TRD's "Data Schema" section. Every table, every column, every index. Use Rails 8 enum syntax where enums are specified. Use `jsonb` for jsonb columns. Use `t.encrypts` or plain `string` columns that will be encrypted at the model level (encrypted attribute config comes in Prompt 3).

Add foreign key constraints at the database level for every `fk` noted in the TRD.

### TDD Workflow
1. No tests in this prompt — migrations are verified by running them.
2. Run `bin/rails db:migrate` in dev and test environments.
3. Run `bin/rails db:rollback` on each migration to confirm they're reversible.

### Acceptance Criteria
- [ ] All migrations run cleanly in dev and test
- [ ] All migrations are reversible (`db:rollback` works)
- [ ] `db/schema.rb` matches the TRD schema spec
- [ ] All foreign keys enforced at DB level
- [ ] `bin/rails test` still passes

---

## Prompt 3 of 27: Core Models with Validations and Encryption

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`.

### What Already Exists
Schema from Prompt 2. No models yet (or only Rails-generated skeletons).

### What This Prompt Builds
ActiveRecord models for every table, with validations, associations, enums, and Rails 8 encrypted attributes for Tesco credentials. Comprehensive model tests.

### Files to Create or Modify
- `app/models/user.rb`
- `app/models/list.rb`
- `app/models/list_item.rb`
- `app/models/product_match.rb`
- `app/models/basket_build.rb`
- `app/models/subscription.rb`
- `app/models/collaborator_session.rb`
- `test/models/*_test.rb` for each
- `test/fixtures/*.yml` for each
- `config/initializers/inflections.rb` if needed

### Detailed Requirements
- `User` uses `has_secure_password`. `encrypts :tesco_email, :tesco_password` (non-deterministic). Enums for `subscription_status` and `price_range`. Email format validation. Unique email.
- `List` belongs to `:owner, class_name: "User"`. Has many `list_items`. Auto-generates `share_token` on create (SecureRandom.urlsafe_base64(24)). Method `rotate_share_token!`.
- `ListItem` belongs to `:list`, optional `added_by_user`. Validates `quantity >= 1`. Default scope ordered by `position`.
- `ProductMatch` belongs to `:user`. Unique on (`user_id`, `freeform_text`). Class method `ProductMatch.cached_for(user, freeform)`.
- `BasketBuild` belongs to `:user`. Enum `status`. Method `append_progress(event_hash)` that appends to `progress_log` and saves.
- `Subscription` belongs to `:user`. Method `active?` returns true if status in `["active", "trialing"]`.
- `CollaboratorSession` belongs to `:list`. Unique on (`list_id`, `session_id`).
- Each model test covers: validations, associations, any instance methods, encryption round-trip for User.

### TDD Workflow
1. Write the failing tests for every model first.
2. Implement models one at a time until each test passes.
3. Run the full test suite — must be green.

### Acceptance Criteria
- [ ] All seven models exist with associations and validations per TRD
- [ ] Tesco credentials encrypt/decrypt correctly (test round-trip)
- [ ] `ProductMatch.cached_for` returns nil when no cache, record when cached
- [ ] `List#rotate_share_token!` generates a new token and persists
- [ ] All model tests pass
- [ ] No Rubocop / linting errors (if linter installed)

---

## Prompt 4 of 27: Auth — Signup, Login, Logout, Session Management

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`.

### What Already Exists
Models from Prompt 3, including `User` with `has_secure_password`. No auth UI yet.

### What This Prompt Builds
Email/password signup, login, logout. Session stored server-side in a `sessions` table (Rails 8 default pattern). `current_user` helper. Auth helpers for controllers and views. No email verification. No password reset (deferred).

### Files to Create or Modify
- `db/migrate/*_create_sessions.rb` (if not already created)
- `app/models/session.rb`
- `app/controllers/sessions_controller.rb`
- `app/controllers/registrations_controller.rb`
- `app/controllers/concerns/authentication.rb`
- `app/views/sessions/new.html.erb`
- `app/views/registrations/new.html.erb`
- `config/routes.rb` (add auth routes)
- `test/controllers/sessions_controller_test.rb`
- `test/controllers/registrations_controller_test.rb`
- `test/system/authentication_test.rb`

### Detailed Requirements
- Follow Rails 8's built-in authentication generator pattern (`bin/rails g authentication`) if it gives you what you need; otherwise implement by hand per TRD.
- `Authentication` concern provides `current_user`, `require_login`, `signed_in?` methods. Included in `ApplicationController`.
- Signup form: email + password + password_confirmation. On success, signs user in and redirects to `/list` (stub route — returns a placeholder for now).
- Login form: email + password. On success, redirects to `/list`.
- Logout: `DELETE /logout`. Destroys session, redirects to `/login`.
- Sessions table stores signed cookie → session row mapping. Invalidation possible.
- Signup validates email format and password length (min 8).

### TDD Workflow
1. Write request tests for sign up, log in, log out, wrong password, duplicate email.
2. Write one system test for the happy path (sign up → redirected to list).
3. Implement controllers and views until all tests pass.

### Acceptance Criteria
- [ ] Can sign up with valid email + password, lands on `/list` stub
- [ ] Can log out and log back in
- [ ] Cannot log in with wrong password
- [ ] Duplicate email rejected with clear error
- [ ] `current_user` works in controllers and views
- [ ] All auth tests pass

---

## Prompt 5 of 27: Application Layout, Navigation, and Tailwind Baseline

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`. Design direction: iOS-inspired, mobile-first, clean, generous whitespace, large tap targets.

### What Already Exists
Working auth from Prompt 4. Signup/login pages exist but use default Rails styling.

### What This Prompt Builds
The base application layout: minimal header with Kart wordmark and account menu, mobile-first Tailwind styles, shared components for buttons, inputs, and cards, empty-state partial. Signup/login pages restyled to match.

### Files to Create or Modify
- `app/views/layouts/application.html.erb`
- `app/views/shared/_header.html.erb`
- `app/views/shared/_flash.html.erb`
- `app/views/shared/_empty_state.html.erb`
- `app/helpers/ui_helper.rb` (helpers for consistent buttons/inputs)
- `app/assets/stylesheets/application.tailwind.css` (base styles, custom CSS variables for colours/spacing if needed)
- Restyle `app/views/sessions/new.html.erb` and `app/views/registrations/new.html.erb`
- `test/system/layout_test.rb`

### Detailed Requirements
- Mobile-first. Max width container at `max-w-md` for list/auth screens, `max-w-2xl` for preferences.
- Button component: primary (dark, rounded-full, large tap target `py-4`), secondary (outline), tertiary (text only).
- Input component: large, rounded, generous padding, clear focus state.
- Flash messages: absolute-positioned toast at top, auto-dismiss via Stimulus controller (create `app/javascript/controllers/flash_controller.js`).
- Header: Kart wordmark left, account dropdown right (when signed in), hidden on signup/login.
- Use Inter or system font stack. No custom font loading in v1.
- Colour palette: neutral greys + one accent. Keep it calm.

### TDD Workflow
1. System test verifies: signed-in user sees header with account menu; signed-out user sees Kart wordmark only; flash messages appear and dismiss.
2. Implement layout + partials.
3. Verify with `bin/rails server` visually on a mobile viewport.

### Acceptance Criteria
- [ ] Mobile-first layout works at 375px, 768px, 1024px widths
- [ ] Header conditionally renders based on auth state
- [ ] Flash messages appear and auto-dismiss
- [ ] Signup and login pages use the new styles
- [ ] All tests pass

---

## Prompt 6 of 27: List Model Behaviour and List Controller

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`.

### What Already Exists
Auth, models, layout. Each new user has no list yet.

### What This Prompt Builds
Automatic list creation for every new user, the `/list` page showing the owner's list, and the controller actions for CRUD on list items. No real-time sync yet (comes in Prompt 8). No sharing yet (comes in Prompt 9).

### Files to Create or Modify
- `app/models/user.rb` (add `after_create :create_default_list`)
- `app/models/list.rb` (ensure share_token generated on create)
- `app/controllers/lists_controller.rb`
- `app/controllers/list_items_controller.rb`
- `app/views/lists/show.html.erb`
- `app/views/list_items/_list_item.html.erb`
- `app/views/list_items/_form.html.erb`
- `config/routes.rb`
- `test/controllers/list_items_controller_test.rb`
- `test/system/list_management_test.rb`

### Detailed Requirements
- `User` auto-creates a `List` on signup (named "Shopping").
- Route `GET /list` → `ListsController#show` → renders owner's list.
- `POST /list/items` creates an item. `PATCH /list/items/:id` updates. `DELETE /list/items/:id` destroys. `POST /list/clear` destroys all.
- List show page: header with list name, item input at top (sticky), list of items with quantity steppers (+/-), delete button per item, "Clear list" button in a menu.
- Items ordered by `position`. New items appended to end.
- Empty state: "Add your first item" with a subtle hint.
- All list routes require login.

### TDD Workflow
1. Write request tests for each list_items action.
2. Write a system test: log in → add 3 items → adjust quantity → delete one → clear list.
3. Implement controllers and views.

### Acceptance Criteria
- [ ] New user automatically has a list on signup
- [ ] Can add, edit quantity, delete, and clear items
- [ ] Empty state shows when list is empty
- [ ] All list tests pass

---

## Prompt 7 of 27: Preferences Page

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`.

### What Already Exists
Working list screen from Prompt 6. Users have preferences columns but no UI.

### What This Prompt Builds
The Preferences page — price range, organic toggle, Tesco credentials entry with trust-building copy, and account info.

### Files to Create or Modify
- `app/controllers/preferences_controller.rb`
- `app/views/preferences/edit.html.erb`
- `app/views/preferences/_tesco_credentials.html.erb`
- `config/routes.rb` (`resource :preferences, only: [:edit, :update]`)
- `test/controllers/preferences_controller_test.rb`
- `test/system/preferences_test.rb`

### Detailed Requirements
- `GET /preferences` → shows current preferences, Tesco credential status (set/not set — never show the actual password), and account email.
- `PATCH /preferences` → updates preferences. Supermarket field is present but disabled — shows "Tesco" with "Waitrose · coming soon" and "Sainsbury's · coming soon" beneath.
- Price range: three-button segmented control (Budget / Mid / Premium).
- Organic toggle: large iOS-style switch.
- Tesco credentials form: dedicated section with heading "Tesco sign-in". Plain, confident copy: "We use these to log in on your behalf when you tap Add to Basket. Your password is encrypted and only decrypted inside the worker that builds your basket. We never see it. We never log it."
- Saving credentials shows success flash.
- Clearing credentials (separate button) sets both fields to nil.
- Link to preferences from the list screen header menu.

### TDD Workflow
1. Request tests: update preferences, set credentials, clear credentials.
2. System test: change price range, toggle organic, enter credentials, verify persisted.
3. Implement.

### Acceptance Criteria
- [ ] Preferences page renders with all controls
- [ ] Preferences persist correctly
- [ ] Tesco credentials save encrypted (verify by inspecting DB in test)
- [ ] Clear credentials sets both to nil
- [ ] Trust-building copy present on credentials section
- [ ] All tests pass

---

## Prompt 8 of 27: Real-Time List Sync via Turbo Streams

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`. Target: collaborator edits visible on other devices within 1 second at p95.

### What Already Exists
Working list CRUD from Prompt 6. No real-time sync.

### What This Prompt Builds
Real-time sync so that when one user adds/edits/removes an item, every other connected session on the same list sees the change within 1 second. Uses Turbo Streams broadcast over Solid Cable.

### Files to Create or Modify
- `app/models/list_item.rb` (add `broadcasts_to :list`)
- `app/views/lists/show.html.erb` (wrap the items list in `turbo_stream_from @list`)
- `app/views/list_items/_list_item.html.erb` (ensure DOM id)
- `test/system/realtime_sync_test.rb`

### Detailed Requirements
- Use `broadcasts_to :list` in `ListItem` so create/update/destroy automatically broadcast.
- The list show page subscribes to the list's Turbo Stream channel.
- Items render via the partial so updates replace cleanly.
- System test uses two browser sessions to verify sync.

### TDD Workflow
1. Write a system test that opens two Capybara sessions on the same list (using `Capybara.using_session`), adds an item in session A, asserts it appears in session B within 2 seconds.
2. Implement the broadcast.
3. Verify manually by opening two browser tabs.

### Acceptance Criteria
- [ ] Two browser sessions on the same list see each other's changes within 1s
- [ ] Item create, update, and delete all sync
- [ ] System test passes reliably
- [ ] All tests pass

---

## Prompt 9 of 27: Share Link and Collaborator Access

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`.

### What Already Exists
Real-time sync between signed-in owners from Prompt 8. No share link or anonymous access yet.

### What This Prompt Builds
Share modal on the list page, `/s/:share_token` route for anonymous collaborators (no signup required), collaborator session management via signed cookie, and the owner-only restriction logic (applied later at Prompt 16 when the Add to Basket CTA is built — in this prompt, mark the groundwork).

### Files to Create or Modify
- `app/controllers/shared_lists_controller.rb`
- `app/views/shared_lists/show.html.erb` (or shares the same view with conditional rendering)
- `app/controllers/concerns/collaborator_session.rb`
- `app/views/lists/_share_modal.html.erb`
- `config/routes.rb`
- `test/controllers/shared_lists_controller_test.rb`
- `test/system/share_link_test.rb`

### Detailed Requirements
- `GET /s/:share_token` → finds the list, sets a signed `collaborator_session_id` cookie if not present, creates a `CollaboratorSession` row, renders the list.
- Collaborators can create/update/delete list items (scoped via share token in the URL).
- The share modal on `/list` shows the full URL (`#{APP_HOST}/s/#{share_token}`), a Copy button (Stimulus controller), and a "Regenerate link" button.
- Regenerating the link invalidates the old one (collaborator sessions on the old token are broken — acceptable in v1).
- Presence of `current_user` is NOT required on `/s/:share_token` routes.
- The view should show a subtle indicator when in "collaborator mode" so the user knows they're on a shared list.

### TDD Workflow
1. Request tests: anonymous user can GET `/s/:token` and add an item.
2. System test: owner creates list, copies link, opens link in a second session (incognito-equivalent), both see real-time sync.
3. Implement.

### Acceptance Criteria
- [ ] Share modal shows and copies the URL
- [ ] Anonymous user can access and edit via share link
- [ ] Collaborator session cookie persists
- [ ] Regenerate link works and invalidates old token
- [ ] Real-time sync works between owner and anonymous collaborator
- [ ] All tests pass

---

## Prompt 10 of 27: "Added by" Attribution and Collaborator Presence (Light Touch)

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`.

### What Already Exists
Sharing + anonymous collaborators from Prompt 9.

### What This Prompt Builds
A lightweight "added by" indicator on list items (owner avatar or a small coloured dot for anonymous collaborator). No full presence system — just attribution.

### Files to Create or Modify
- `app/models/list_item.rb` (ensure `added_by_user_id` / `added_by_session_id` set on create)
- `app/controllers/list_items_controller.rb` (set attribution based on auth state)
- `app/views/list_items/_list_item.html.erb` (render attribution dot)
- `app/helpers/attribution_helper.rb`
- `test/helpers/attribution_helper_test.rb`
- `test/system/attribution_test.rb`

### Detailed Requirements
- On item create: if `current_user`, set `added_by_user_id`. Else set `added_by_session_id` from the collaborator session cookie.
- Each `ListItem` gets a deterministic colour based on either the user ID or session ID hashed to a small palette (e.g., 6 colours).
- Render a small coloured dot next to each item. Tooltip on hover: "Added by you" or "Added by partner."
- Owner always sees their own items with one fixed colour; collaborators get other palette colours.

### TDD Workflow
1. Helper test for deterministic colour mapping.
2. System test: owner and collaborator each add items, verify dots are different colours.
3. Implement.

### Acceptance Criteria
- [ ] Every item shows an attribution dot
- [ ] Colours are deterministic per user/session
- [ ] All tests pass

---

## Prompt 11 of 27: Node Sidecar Scaffold (No Playwright Yet)

### Context
You are building Kart. The TRD specifies a Node sidecar running Playwright for Tesco browser automation. Sidecar ↔ Rails communication is HMAC-signed HTTP.

### What Already Exists
Rails app is functional through Prompt 10. No sidecar exists.

### What This Prompt Builds
A `sidecar/` subdirectory with a Fastify-based Node service. One endpoint (`POST /build`) that accepts the payload and returns 202. No Playwright yet — just the scaffolding, HMAC signing, and health check.

### Files to Create or Modify
- `sidecar/package.json`
- `sidecar/src/server.js`
- `sidecar/src/auth.js` (HMAC verification)
- `sidecar/src/routes/build.js`
- `sidecar/src/routes/health.js`
- `sidecar/.env.example`
- `sidecar/test/server.test.js` (Vitest)
- `Procfile.dev` (run rails + sidecar + tailwind together)
- `bin/dev` (ensure it starts the sidecar too)

### Detailed Requirements
- Node 20, Fastify, Vitest. `package.json` scripts: `start`, `dev`, `test`.
- `POST /build` verifies HMAC from `X-Signature` header against request body using `SIDECAR_HMAC_SECRET`. Returns 202 if valid, 401 if invalid. Does nothing else yet.
- `GET /health` returns `{status: "ok"}`.
- Server runs on `localhost:4001` by default.
- `Procfile.dev`: `web: bin/rails server`, `worker: bin/jobs`, `css: bin/rails tailwindcss:watch`, `sidecar: cd sidecar && npm run dev`.
- Sidecar test suite verifies HMAC check and health endpoint.

### TDD Workflow
1. Vitest: HMAC accept, HMAC reject, health check.
2. Implement.

### Acceptance Criteria
- [ ] `cd sidecar && npm install && npm test` passes
- [ ] `bin/dev` starts Rails + sidecar together
- [ ] Sidecar health check responds at localhost:4001/health
- [ ] HMAC verification works both ways
- [ ] Rails test suite still passes

---

## Prompt 12 of 27: Mock Tesco HTML Server (for Development and Tests)

### Context
You are building Kart. Testing against real Tesco is expensive and risky. The TRD specifies a `TESCO_MODE=mock` where the sidecar points at a local mock Tesco HTTP server that serves fake HTML resembling real Tesco pages.

### What Already Exists
Sidecar scaffold from Prompt 11. No mock Tesco.

### What This Prompt Builds
A tiny mock Tesco server (another Node HTTP server) that serves fake HTML for: login page, homepage, product search results page, product detail page, basket page, and checkout page. Product data is hardcoded (~30 products).

### Files to Create or Modify
- `sidecar/mock-tesco/server.js`
- `sidecar/mock-tesco/products.json`
- `sidecar/mock-tesco/pages/login.html`
- `sidecar/mock-tesco/pages/search.html`
- `sidecar/mock-tesco/pages/product.html`
- `sidecar/mock-tesco/pages/basket.html`
- `sidecar/mock-tesco/pages/checkout.html`
- `sidecar/package.json` (add script `mock-tesco`)
- `Procfile.dev` (run mock-tesco in dev)
- `sidecar/test/mock-tesco.test.js`

### Detailed Requirements
- Mock server runs on `localhost:4002`.
- Login page has email + password inputs and a submit button. Submit with any credentials → redirect to homepage.
- Search page accepts `?q=` param and returns a results page filtered from `products.json`.
- Product page shows product details and an "Add to basket" button. Clicking it updates an in-memory basket (per session cookie).
- Basket page shows items, total, and a "Go to checkout" button that returns a URL like `http://localhost:4002/checkout/{basket_id}`.
- Session state is in-memory, keyed by a cookie set on login.
- Optional `?challenge=1` query param on login simulates a verification challenge (renders a "verify your identity" interstitial).
- Products.json has ~30 items across categories (produce, bakery, dairy, pantry), each with id, name, price, category, organic flag, price tier (budget/mid/premium).

### TDD Workflow
1. Vitest: login flow, search returns results, add-to-basket, basket total, challenge param.
2. Implement.

### Acceptance Criteria
- [ ] Mock Tesco starts on :4002
- [ ] Can simulate full login → search → add → checkout flow via curl/fetch
- [ ] Challenge mode works
- [ ] All mock-tesco tests pass
- [ ] `bin/dev` starts it alongside Rails and sidecar

---

## Prompt 13 of 27: Playwright Integration in Sidecar (Against Mock Tesco)

### Context
You are building Kart. Sidecar scaffold exists (Prompt 11), mock Tesco exists (Prompt 12). Now wire up Playwright with stealth plugin inside the sidecar and drive a full basket build against the mock.

### What Already Exists
Fastify sidecar with a stub `POST /build` endpoint. Mock Tesco serving on :4002.

### What This Prompt Builds
The real Playwright implementation of the build flow, targeting mock Tesco. Progress callbacks back to Rails (stubbed by a local test receiver during tests).

### Files to Create or Modify
- `sidecar/src/tesco/browser.js` (launch Chromium with playwright-extra + stealth)
- `sidecar/src/tesco/login.js`
- `sidecar/src/tesco/search.js`
- `sidecar/src/tesco/add_to_basket.js`
- `sidecar/src/tesco/checkout.js`
- `sidecar/src/build-runner.js` (orchestrates the full flow)
- `sidecar/src/rails-callback.js` (HMAC-signs progress posts back to Rails)
- `sidecar/src/routes/build.js` (wire up build-runner)
- `sidecar/package.json` (add playwright, playwright-extra, puppeteer-extra-plugin-stealth)
- `sidecar/test/build-runner.test.js`

### Detailed Requirements
- `TESCO_BASE_URL` env var points at either mock Tesco or real tesco.com. Default: `http://localhost:4002`.
- `TESCO_MODE=mock|live`, default `mock`.
- Build runner flow: launch browser → navigate to login → fill credentials → detect success or challenge → if challenge, POST `verification_required` to Rails and pause (sleep-loop checking a Redis/file flag for resume — simpler v1: just fail, user retries) → search each item → for each, use the LLM matching call (stub for now, real integration in Prompt 14) → navigate to product → add to basket → POST progress → repeat → scrape basket total + checkout URL → POST completed.
- Stealth plugin loaded via `playwright-extra`.
- Proxy support: if `PROXY_HOST` env var set, pass to browser launch. Not used in mock mode.
- HMAC-sign every callback to Rails.
- All Playwright calls wrapped with `try/catch` and reasonable timeouts.

### TDD Workflow
1. Vitest: against mock Tesco, run build-runner with a fake list of 3 items and a mock Rails callback server. Assert progress events received, final completion event includes checkout URL.
2. Iterate on selectors until the flow is reliable.

### Acceptance Criteria
- [ ] `sidecar` tests pass end-to-end against mock Tesco
- [ ] Progress events posted to mock Rails callback in the right order
- [ ] Completion event includes checkout URL and total
- [ ] Failure events fire on simulated error
- [ ] Rails test suite still passes

---

## Prompt 14 of 27: Anthropic Claude Haiku — Item Matching Service

### Context
You are building Kart. PRD: `./docs/prd.md`. TRD: `./docs/trd.md`. Matching resolves freeform text ("apples") to a specific Tesco product, respecting user preferences. The sidecar does the Tesco search; Claude Haiku picks from the results.

### What Already Exists
Sidecar with Playwright driving mock Tesco (Prompt 13). No LLM matching — build-runner has a stub.

### What This Prompt Builds
A matching service (in the sidecar, since the sidecar already has the Tesco search results in hand). Calls Claude Haiku with the search results and user preferences, parses the structured response, writes back to the Rails `product_matches` cache via an internal endpoint.

### Files to Create or Modify
- `sidecar/src/matching/match.js` (core match function)
- `sidecar/src/matching/anthropic-client.js`
- `sidecar/src/matching/cache-client.js` (reads/writes Rails ProductMatch via internal HTTP)
- `sidecar/src/build-runner.js` (replace stub matching with real matching)
- `app/controllers/internal/product_matches_controller.rb` (GET cached match, POST new match)
- `config/routes.rb`
- `sidecar/test/matching.test.js` (mocks Anthropic API)
- `test/controllers/internal/product_matches_controller_test.rb`

### Detailed Requirements
- Build runner for each item: first call Rails internal `GET /internal/users/:user_id/product_matches?freeform_text=apples`. If cache hit → use cached Tesco product ID, skip LLM and search. If cache miss → Tesco search → Claude Haiku picks best match → POST new match to Rails to cache it → use that product ID.
- Claude prompt: system message describes the task and injects user's `price_range` and `organic_preference`. User message contains the freeform text and top-5 search results (id, name, price, organic flag, category). Expect structured JSON response via tool use: `{tesco_product_id, confidence, reasoning}`.
- Rate limit: max 1 concurrent LLM call per user.
- Failure modes: if Claude errors, mark item as unmatched and continue. If confidence < 0.5, add to unmatched list for user review.
- Rails internal endpoint HMAC-authenticated same way as build callbacks.

### TDD Workflow
1. Vitest: matching with a mocked Anthropic client returns the expected product id. Cache hit path skips the Anthropic call entirely. Low confidence returns unmatched.
2. Rails request test: POST to internal endpoint creates ProductMatch, GET returns it.
3. Implement.

### Acceptance Criteria
- [ ] Matching against mock Tesco + mocked Claude works end-to-end
- [ ] Cache hit path skips LLM call
- [ ] Low confidence routes to unmatched
- [ ] Rails internal endpoint returns/creates matches correctly
- [ ] All tests pass

---

## Prompt 15 of 27: Rails BuildBasketJob and Sidecar Invocation

### Context
You are building Kart. PRD/TRD as before. Sidecar can run a full build (Prompts 11–14). Now Rails kicks off the build via a Solid Queue job.

### What Already Exists
Working sidecar. No Rails job that invokes it yet.

### What This Prompt Builds
`BuildBasketJob`, Rails service that POSTs to the sidecar's `/build` endpoint with HMAC, and the `BasketBuildsController#create` action that creates a BasketBuild and enqueues the job.

### Files to Create or Modify
- `app/jobs/build_basket_job.rb`
- `app/services/sidecar_client.rb`
- `app/controllers/basket_builds_controller.rb`
- `app/controllers/internal/basket_build_callbacks_controller.rb`
- `config/routes.rb`
- `test/jobs/build_basket_job_test.rb`
- `test/controllers/basket_builds_controller_test.rb`
- `test/controllers/internal/basket_build_callbacks_controller_test.rb`

### Detailed Requirements
- `POST /builds` (authenticated, owner-only): creates a BasketBuild with `list_snapshot` frozen from current list items, status `matching`, enqueues BuildBasketJob, redirects to `/builds/:id`.
- `BuildBasketJob.perform(basket_build_id)`: loads BasketBuild, calls `SidecarClient.start_build(basket_build)` which POSTs to the sidecar. Job returns immediately (fire-and-forget); sidecar reports back via callbacks.
- `SidecarClient.start_build`: HMAC-signed POST with payload `{buildId, userId, tescoEmail (decrypted), tescoPassword (decrypted), items, preferences, existingBasketAction (from params or default "warn"), railsCallbackBaseUrl}`.
- Internal callback controller handles `/internal/builds/:id/progress`, `/completed`, `/failed`, `/verification_required`. Verifies HMAC. Updates the BasketBuild record, broadcasts a Turbo Stream to the build's channel.
- Skip the existing-basket check and paywall for now — they come in Prompts 17 and 20.

### TDD Workflow
1. Job test: enqueues correctly, calls SidecarClient.
2. Controller test for POST /builds: creates BasketBuild, enqueues job.
3. Callback controller tests: HMAC valid/invalid, status transitions, broadcasts fire.
4. Implement.

### Acceptance Criteria
- [ ] Clicking "Add to Basket" creates a BasketBuild and enqueues a job
- [ ] Sidecar receives the request (verify in a test with a fake sidecar server)
- [ ] Callback endpoints update BasketBuild status correctly
- [ ] All tests pass

---

## Prompt 16 of 27: Build Progress UI — Matching, Building, Ready, Failed Screens

### Context
You are building Kart. PRD/TRD as before. Design: "the building screen should feel calm and trustworthy — this is the magic moment and also the moment users are most anxious." Copy should be plain, confident, honest.

### What Already Exists
Backend machinery for builds (Prompt 15). No build UI yet.

### What This Prompt Builds
The `/builds/:id` page with four visual states driven by Turbo Stream updates: matching, building, ready, failed. Plus the "Add to Basket" CTA on the list page (owner-only) that creates a build.

### Files to Create or Modify
- `app/views/basket_builds/show.html.erb`
- `app/views/basket_builds/_matching.html.erb`
- `app/views/basket_builds/_building.html.erb`
- `app/views/basket_builds/_ready.html.erb`
- `app/views/basket_builds/_failed.html.erb`
- `app/models/basket_build.rb` (add `broadcasts_to :self` for real-time UI updates)
- `app/views/lists/_add_to_basket_cta.html.erb` (owner-only CTA button)
- `test/system/basket_build_flow_test.rb`

### Detailed Requirements
- Add to Basket CTA: large primary button at bottom of list screen, sticky, owner-only. Collaborators see a disabled tooltip button: "Only [owner email] can checkout."
- Clicking CTA submits to `POST /builds` and redirects to `/builds/:id`.
- `/builds/:id`: single page that renders the partial matching the current status. Subscribes to the build's Turbo Stream channel. Each status change swaps the partial.
- Matching partial: calm animation, "Matching your items… 7 of 12" progress text pulled from `progress_log`.
- Building partial: status log showing each item as it's added. "Keep this page open — or close it and we'll email you when it's ready." Small reassurance copy about security below.
- Ready partial: big tick, "Your Tesco basket is ready", total + item count, prominent "Go to Tesco checkout" button linking to `tesco_checkout_url`, unmatched items listed below with "couldn't find:" copy.
- Failed partial: friendly error, Retry button (POST /builds again with same list snapshot).
- Every partial is mobile-first and feels iOS-clean.

### TDD Workflow
1. System test: use the sidecar in mock mode end-to-end. Log in → add items → click Add to Basket → see matching screen → see building screen → see ready screen with checkout URL. Takes real time (a few seconds per item in mock). This is the highest-value test in the whole suite.
2. Implement UI partials.

### Acceptance Criteria
- [ ] Full happy-path system test passes (list → matching → building → ready)
- [ ] Each partial renders correctly in isolation
- [ ] Retry button re-triggers a build
- [ ] Collaborators cannot click Add to Basket
- [ ] All tests pass

---

## Prompt 17 of 27: Existing Tesco Basket Warning (Replace/Merge/Cancel)

### Context
You are building Kart. PRD specifies: if the user has items already in their Tesco basket when a build starts, show a warning with Replace (default), Merge, or Cancel options.

### What Already Exists
Build flow works end-to-end on an empty Tesco basket (Prompt 16).

### What This Prompt Builds
Detection of an existing Tesco basket by the sidecar before starting the build, pausing with a `paused_existing_basket` status, Rails UI for the user to pick an action, and sidecar resume with the chosen action.

### Files to Create or Modify
- `sidecar/src/tesco/check_existing_basket.js`
- `sidecar/src/build-runner.js` (add pre-build check step)
- `app/models/basket_build.rb` (add enum value `paused_existing_basket`)
- `db/migrate/*_add_paused_existing_basket_to_builds.rb` (may need to update check constraint; enum additions in Rails 8 are model-level, no migration needed unless constrained)
- `app/controllers/basket_builds_controller.rb` (add `existing_basket_decision` action)
- `app/views/basket_builds/_paused_existing_basket.html.erb`
- `test/system/existing_basket_test.rb`
- `sidecar/test/check-existing-basket.test.js`

### Detailed Requirements
- Before matching starts, sidecar logs in and checks the basket page. If items found, POSTs `existing_basket_detected` to Rails with count of items.
- Rails sets status to `paused_existing_basket`, broadcasts a Turbo Stream showing the decision modal.
- Modal: "You've got N items in your Tesco basket already. What should we do?" Buttons: Replace (default, highlighted), Merge, Cancel.
- User picks → POST `/builds/:id/existing_basket_decision` with `action`. Rails calls sidecar's `/build/:id/resume` endpoint with the decision.
- Sidecar resumes: if replace, empties basket first; if merge, just proceeds; if cancel, aborts cleanly.

### TDD Workflow
1. Sidecar test: mock Tesco with a pre-populated basket. Verify detection, Rails callback fires, resume works for each of the three actions.
2. Rails system test: simulate the full pause/resume flow.
3. Implement.

### Acceptance Criteria
- [ ] Build pauses when existing basket detected
- [ ] User sees decision modal
- [ ] Each of the three actions works correctly
- [ ] All tests pass

---

## Prompt 18 of 27: Verification Interrupt Pause and Resume

### Context
You are building Kart. PRD specifies Tesco may challenge a login with a verification step, in which case the build pauses and the user resumes after verifying out-of-band.

### What Already Exists
Build flow with existing-basket pause (Prompt 17).

### What This Prompt Builds
Detection of a Tesco verification challenge in the sidecar, pausing the build with `paused_verification` status, Rails UI with a Resume button, and cleanup of builds that stay paused too long.

### Files to Create or Modify
- `sidecar/src/tesco/login.js` (detect challenge)
- `app/views/basket_builds/_paused_verification.html.erb`
- `app/controllers/basket_builds_controller.rb` (add `resume` action)
- `app/jobs/cleanup_stale_paused_builds_job.rb`
- `config/recurring.yml` (Solid Queue recurring config — run every 5 min)
- `sidecar/test/verification-pause.test.js`
- `test/jobs/cleanup_stale_paused_builds_job_test.rb`
- `test/system/verification_pause_test.rb`

### Detailed Requirements
- Sidecar login logic: after submitting credentials, check for verification indicators (challenge page selectors). If present → POST `verification_required` to Rails → poll a sidecar-local flag or wait on an in-memory promise for resume signal.
- Rails sets status to `paused_verification`, broadcasts the pause screen.
- Pause screen: clear icon, copy: "Tesco needs you to verify this login. Open the Tesco app or website, confirm it's you, then tap Resume." Resume button posts to `/builds/:id/resume`.
- Rails resume calls sidecar `/build/:id/resume` endpoint. Sidecar proceeds.
- `CleanupStalePausedBuildsJob`: every 5 minutes, finds `paused_verification` builds older than 30 min, marks `cancelled`, posts cancel to sidecar which cleanly abandons the session.
- Use mock Tesco's `?challenge=1` mode (Prompt 12) to test this.

### TDD Workflow
1. Sidecar test: login with challenge, verify pause event fires.
2. Rails job test: stale paused build gets cancelled after 30 min.
3. System test: trigger challenge, see pause screen, click Resume (after satisfying mock challenge), build proceeds.
4. Implement.

### Acceptance Criteria
- [ ] Verification challenge pauses the build
- [ ] Pause screen shows with clear copy
- [ ] Resume button re-engages the build
- [ ] Stale paused builds cleaned up by recurring job
- [ ] All tests pass

---

## Prompt 19 of 27: Email Notification When Build Completes in the Background

### Context
You are building Kart. PRD specifies users can close the tab during a build and receive an email when it's ready.

### What Already Exists
Build flow that updates the UI via Turbo Streams (Prompts 16–18). No email yet.

### What This Prompt Builds
Detection of whether the user's browser is still connected to the build's progress channel. If not, dispatch a Resend email with a deep link.

### Files to Create or Modify
- `app/jobs/send_basket_ready_email_job.rb`
- `app/mailers/basket_mailer.rb`
- `app/views/basket_mailer/ready.html.erb`
- `app/channels/basket_build_channel.rb` (track connection state via cache keys)
- `app/controllers/internal/basket_build_callbacks_controller.rb` (on completed, check presence key, enqueue email job if absent)
- `config/initializers/resend.rb`
- `test/mailers/basket_mailer_test.rb`
- `test/jobs/send_basket_ready_email_job_test.rb`

### Detailed Requirements
- When user subscribes to build progress channel, write a Rails cache key `build:#{id}:connected:#{session_id}` with 60s TTL, refresh on each broadcast.
- When build completes, check if any connected key exists. If not → enqueue `SendBasketReadyEmailJob`.
- Email template: minimal, on-brand. Subject: "Your Tesco basket is ready." Body: short message with a big button linking to `/builds/:id`.
- Send via Resend using the `resend-ruby` gem.
- Use Letter Opener in dev so emails don't actually send.

### TDD Workflow
1. Mailer test: subject and body correct, link present.
2. Job test: enqueues correctly, calls Resend client.
3. Integration test: complete a build with no connected browser → email job enqueued.
4. Implement.

### Acceptance Criteria
- [ ] Email sends when user disconnected at completion time
- [ ] Email link deep-links to the build handoff screen
- [ ] Letter Opener works in dev
- [ ] All tests pass

---

## Prompt 20 of 27: Stripe Subscription — Checkout Session and Customer Portal

### Context
You are building Kart. PRD specifies subscription required after the first free basket. TRD specifies Stripe Checkout + Customer Portal. Dev runs against Stripe test mode.

### What Already Exists
User model has subscription fields. No payment flow yet.

### What This Prompt Builds
Stripe Checkout Session creation, Customer Portal redirect, and the billing controller. No paywall enforcement yet — that's Prompt 21.

### Files to Create or Modify
- `app/controllers/billing_controller.rb`
- `app/services/stripe_checkout.rb`
- `config/initializers/stripe.rb`
- `app/views/billing/show.html.erb` (subscription status page linking to portal)
- `config/routes.rb`
- `test/controllers/billing_controller_test.rb`

### Detailed Requirements
- `POST /billing/checkout`: creates a Stripe Checkout Session with `mode: subscription`, prefills customer email, uses `STRIPE_PRICE_ID_MONTHLY` or `STRIPE_PRICE_ID_ANNUAL` based on param, success URL back to `/billing`, cancel URL to `/billing`. Returns redirect to Stripe-hosted checkout.
- `GET /billing/portal`: creates a Customer Portal session and redirects.
- `GET /billing`: shows current subscription status (from local `subscriptions` table) with manage/upgrade buttons.
- Stripe initializer loads `STRIPE_SECRET_KEY` from env.
- Use Stripe test keys throughout. Test card `4242 4242 4242 4242`.

### TDD Workflow
1. Controller tests: checkout session creation, portal redirect. Stripe API stubbed via VCR or webmock.
2. Implement.

### Acceptance Criteria
- [ ] Can click through to Stripe-hosted checkout and complete a test-mode subscription
- [ ] Customer Portal opens correctly
- [ ] Billing page shows current status
- [ ] All tests pass

---

## Prompt 21 of 27: Stripe Webhooks and Subscription State Sync

### Context
You are building Kart. Stripe Checkout works (Prompt 20). The local `subscriptions` table needs to reflect Stripe state via webhooks.

### What Already Exists
Stripe Checkout + Portal wired up. No webhook handling.

### What This Prompt Builds
Webhook endpoint that verifies Stripe signatures and updates the local `subscriptions` table on `customer.subscription.created/updated/deleted` events. Also updates `users.subscription_status`.

### Files to Create or Modify
- `app/controllers/webhooks/stripe_controller.rb`
- `app/services/stripe_webhook_handler.rb`
- `config/routes.rb` (POST /webhooks/stripe, skip CSRF)
- `test/controllers/webhooks/stripe_controller_test.rb`
- `test/services/stripe_webhook_handler_test.rb`

### Detailed Requirements
- `POST /webhooks/stripe`: reads raw body, verifies signature with `STRIPE_WEBHOOK_SECRET`, dispatches to handler.
- Handler handles: `customer.subscription.created`, `.updated`, `.deleted`. Creates/updates local `Subscription` row. Syncs `user.subscription_status`.
- Idempotent: re-processing the same event does nothing harmful.
- Use Stripe CLI locally (`stripe listen --forward-to localhost:3000/webhooks/stripe`) for dev testing — document in README.

### TDD Workflow
1. Controller test: signed payload → 200. Unsigned → 400.
2. Handler tests: each event type updates state correctly. Idempotency.
3. Implement.

### Acceptance Criteria
- [ ] Webhook signature verification works
- [ ] Local state syncs on each event type
- [ ] Idempotent
- [ ] Stripe CLI round-trip works in dev
- [ ] All tests pass

---

## Prompt 22 of 27: Paywall Enforcement and First-Basket-Free Logic

### Context
You are building Kart. PRD specifies: first basket free, then paywall. Implemented via `user.trial_used` boolean.

### What Already Exists
Subscription flow works (Prompts 20–21). Build flow works without paywall check (Prompt 16).

### What This Prompt Builds
Paywall enforcement on `POST /builds`. If user is not subscribed and `trial_used` is true → render paywall. Otherwise allow. Mark `trial_used = true` on successful build completion.

### Files to Create or Modify
- `app/controllers/basket_builds_controller.rb` (add paywall check)
- `app/views/basket_builds/_paywall.html.erb`
- `app/controllers/internal/basket_build_callbacks_controller.rb` (mark trial_used on completion)
- `test/controllers/basket_builds_controller_test.rb` (add paywall cases)
- `test/system/paywall_test.rb`

### Detailed Requirements
- Before enqueuing a BuildBasketJob, check: `user.subscription_active? || !user.trial_used`. If neither → render paywall instead.
- Paywall partial: "Your first basket was on us. Upgrade to keep the magic." Two pricing tiers with buttons (monthly / annual). Buttons link to `POST /billing/checkout?plan=monthly|annual`.
- Pricing numbers pulled from a config file or env vars so they're easy to change (per PRD's TBD pricing note).
- On successful build completion, set `user.trial_used = true` if not already.

### TDD Workflow
1. System test: new user → first build works → tries second build → sees paywall → upgrades → third build works.
2. Implement.

### Acceptance Criteria
- [ ] First build is free for any user
- [ ] Second build triggers paywall for non-subscribers
- [ ] Subscribers always skip the paywall
- [ ] `trial_used` flips at the right moment
- [ ] All tests pass

---

## Prompt 23 of 27: Post-Shop Match Corrections

### Context
You are building Kart. PRD specifies: on the handoff screen, user can say "wrong product" on a matched item, pick the right one, and the system remembers for next time. This is the key to the "≥85% correct first time" match quality target.

### What Already Exists
Ready screen shows matched items (Prompt 16). ProductMatch cache exists (Prompt 14). No correction UI.

### What This Prompt Builds
Per-item correction UI on the ready screen. Clicking "wrong product" on an item opens a picker (search again + list of alternatives). Picking updates the user's ProductMatch for that freeform text.

### Files to Create or Modify
- `app/views/basket_builds/_ready.html.erb` (add correction affordance)
- `app/views/basket_builds/_correction_picker.html.erb`
- `app/controllers/basket_builds_controller.rb` (add `corrections` action)
- `app/controllers/internal/tesco_search_controller.rb` (proxy search to sidecar — the sidecar runs a quick search call and returns results)
- `sidecar/src/routes/search.js` (new endpoint, reuses tesco/search.js)
- `test/system/corrections_test.rb`

### Detailed Requirements
- Each matched item on the ready screen has a small "wrong?" link. Clicking opens an inline picker (Turbo Frame): shows current match + "Try another" button that fetches fresh search results from the sidecar. User picks → POST `/builds/:id/corrections` with `{freeform_text, tesco_product_id}`.
- Rails upserts the `ProductMatch` row.
- The user's next build will use the corrected match.
- This does NOT modify the current Tesco basket (it's already built — user can fix manually in Tesco if they want for this shop). Copy makes this clear: "Next time, 'milk' will mean this product."

### TDD Workflow
1. System test: complete a build, click "wrong" on an item, pick a different product, verify ProductMatch updated.
2. Implement.

### Acceptance Criteria
- [ ] Correction flow works from ready screen
- [ ] ProductMatch row upserts correctly
- [ ] Copy clear that correction applies next time
- [ ] All tests pass

---

## Prompt 24 of 27: Polish Pass — Empty States, Loading States, Error States, Copy

### Context
You are building Kart. Core flows all work. Time to polish the rough edges and get the app feeling iOS-clean.

### What Already Exists
All core functionality through Prompt 23. Some screens have placeholder copy or rough edges.

### What This Prompt Builds
A sweep across every screen to tighten copy, add missing empty states, improve loading indicators, handle error states gracefully, and ensure mobile-first layout works at all common widths.

### Files to Create or Modify
- Most view files — light edits.
- `app/views/shared/_loading.html.erb` (shared spinner)
- `app/views/shared/_error.html.erb`
- `app/helpers/copy_helper.rb` (if any repeated strings)
- `test/system/polish_test.rb`

### Detailed Requirements
Specific targets for this pass:

- **Empty list state**: friendly prompt with illustration or icon, clear CTA to add first item.
- **No Tesco credentials + Add to Basket clicked**: redirect to preferences with flash: "Let's get you signed into Tesco first."
- **Build failed**: error screen copy must be plain and honest. No "Oops something went wrong." Instead: "The build hit a snag. Nothing was left in your Tesco basket. Want to try again?"
- **Loading between list load and Turbo stream subscription**: subtle skeleton rows.
- **Mobile tap targets**: every button min 44px height.
- **Focus states**: visible on keyboard nav.
- **Copy review**: every CTA, flash message, and error message should be 1) plain, 2) confident, 3) honest.

### TDD Workflow
1. System test sweeps each flow and checks at least one empty/loading/error state per screen.
2. Implement edits.
3. Manually verify at 375, 768, 1024 widths.

### Acceptance Criteria
- [ ] Every screen has an empty state where applicable
- [ ] Every async action has a loading indicator
- [ ] Every error has a recovery path
- [ ] All copy reviewed against plain/confident/honest bar
- [ ] All tests pass

---

## Prompt 25 of 27: PWA Polish — Install Prompt, Offline Shell, App Icons

### Context
You are building Kart. PRD says "installable as a PWA for a near-native feel on mobile." Rails 8 ships PWA defaults — now customise them for Kart.

### What Already Exists
Rails 8 default PWA manifest and service worker from Prompt 1.

### What This Prompt Builds
Branded PWA manifest, app icons, offline fallback page, and an install prompt that appears when the user is engaged (not on first visit).

### Files to Create or Modify
- `app/views/pwa/manifest.json.erb`
- `app/views/pwa/service-worker.js.erb`
- `public/icons/*.png` (multiple sizes — 192, 512, maskable)
- `app/views/shared/_install_prompt.html.erb`
- `app/javascript/controllers/install_prompt_controller.js`
- `app/views/shared/_offline.html.erb`

### Detailed Requirements
- Manifest: name "Kart", short_name "Kart", theme color (neutral dark), background color (white or neutral), display "standalone", icons at 192 and 512 (regular + maskable).
- Service worker caches the app shell (layout + CSS + JS) and serves an offline page when no network.
- Install prompt (Stimulus controller): listens for `beforeinstallprompt`, shows a small banner after user has added at least 3 items (engagement signal), dismissible, remembers dismissal in localStorage.
- App icons: simple wordmark or emoji-based icon for v1 (replace with designed icons later).

### TDD Workflow
1. Manual verification on a real mobile device or Chrome devtools PWA section.
2. Request test: `GET /manifest.json` returns valid JSON with all required fields.

### Acceptance Criteria
- [ ] Lighthouse PWA score 90+
- [ ] Install prompt appears after 3 items added
- [ ] Offline page shows when network is down
- [ ] Icons render correctly on home screen
- [ ] All tests pass

---

## Prompt 26 of 27: Deployment — Kamal 2 to Hetzner

### Context
You are building Kart. App works fully in dev. Time to deploy to a real server. Still using mock Tesco and Stripe test mode — Prompt 27 is the live switch.

### What Already Exists
Full working app in dev. No deployment config.

### What This Prompt Builds
Kamal 2 config, Dockerfile for the Rails app, Dockerfile for the sidecar, Hetzner server provisioned (user runs the provisioning steps manually), deployed app accessible at a staging subdomain.

### Files to Create or Modify
- `config/deploy.yml`
- `Dockerfile` (Rails — Rails 8 ships with a default, customize if needed)
- `sidecar/Dockerfile` (Node + Playwright base image)
- `.kamal/secrets`
- `README.md` (deployment section)

### Detailed Requirements
- Kamal config runs three services on one host: `web` (Rails), `sidecar` (Node), `accessory postgres`.
- Rails Dockerfile uses the Rails 8 default multi-stage build.
- Sidecar Dockerfile based on `mcr.microsoft.com/playwright:v1.49.0-jammy` or current stable.
- Staging domain: `staging.kart.app` (or similar — user owns the domain).
- Kamal handles SSL via Let's Encrypt.
- Database migrations run as a Kamal post-deploy hook.
- Solid Queue workers run in the same container as web (via `bin/jobs` in a separate Kamal role), or in a dedicated container — prefer dedicated for clarity.
- Still pointing at mock Tesco in staging: `TESCO_MODE=mock`, mock-tesco Node service runs as a fourth container or inside the sidecar container (simpler).
- Stripe still in test mode.

### TDD Workflow
1. Run `kamal deploy` and verify staging app is reachable.
2. Smoke-test: sign up, add items, run a build end-to-end against mock Tesco on staging.
3. Check logs via `kamal app logs`.

### Acceptance Criteria
- [ ] `kamal deploy` succeeds
- [ ] Staging URL loads the app over HTTPS
- [ ] Signup, list, build flow all work on staging
- [ ] All tests pass (locally — no production test runs)

---

## Prompt 27 of 27: Live Switch — Real Tesco, Residential Proxy, Live Stripe, Launch

### Context
You are building Kart. Staging works end-to-end against mocks. Time to switch to live services and launch v1.

### What Already Exists
Deployed staging app. Mock Tesco. Stripe test mode. Free tier Resend.

### What This Prompt Builds
Production configuration pointing at real tesco.com, residential proxy wired up, Stripe live keys, real Resend domain, and the production environment. Also: the "Switch to production" runbook.

### Files to Create or Modify
- `config/deploy.yml` (add production environment)
- `.kamal/secrets.production`
- `README.md` (production runbook)
- `docs/runbook.md` (new file — ops runbook)

### Detailed Requirements
- Production Kamal env: `TESCO_MODE=live`, `TESCO_BASE_URL=https://www.tesco.com`, real `PROXY_*` env vars (IPRoyal or Bright Data account required — user sets up).
- Stripe live keys (user creates live products + prices in Stripe dashboard first, updates `STRIPE_PRICE_ID_*` env vars).
- Resend: verify sending domain, set `RESEND_API_KEY` production key.
- DNS: point production domain at the Hetzner box.
- Monitoring: Appsignal (free tier) or similar — minimal alerting on exceptions.
- Runbook covers: how to deploy, how to check logs, how to handle a stuck build, how to rotate Tesco test accounts, how to handle a user Tesco account lockout, how to process refunds via Stripe dashboard.
- Pre-launch checklist at the bottom of the runbook: Stripe live mode confirmed, DNS propagated, SSL cert valid, one real test build from a real Tesco test account, Resend email actually delivered, privacy policy page published, terms of service published.

### TDD Workflow
1. One real end-to-end test build against real Tesco from a throwaway test account. Watch it carefully. Verify nothing got stuck in the real Tesco basket after the test.
2. Verify the email actually arrives in a real inbox.
3. Verify a test subscription with a real card (then refund via Stripe dashboard).

### Acceptance Criteria
- [ ] Real Tesco login works through the residential proxy
- [ ] Real Stripe subscription works end-to-end
- [ ] Real email delivery works
- [ ] Runbook complete
- [ ] Pre-launch checklist fully ticked
- [ ] Production URL accessible over HTTPS

---

# After Launch

Not part of v1, but worth noting: the first real users will surface bugs that testing won't. Budget a week of hotfix time immediately post-launch before starting any new features. Watch match quality closely — if it falls below 85%, prioritise the correction UX and per-user memory improvements before anything else.

*End of build plan.*
