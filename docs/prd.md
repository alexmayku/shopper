# Kart — PRD v1.0

*(working name — rename later if you like)*

## Problem Statement
UK households doing a weekly Tesco shop waste time assembling baskets from scratch every week, even though the list in their head barely changes. Existing shared-list apps (Apple Reminders, AnyList, etc.) stop at the list — you still have to open Tesco, search each item, pick the right variant, and add it by hand. Kart closes that gap: you brain-dump items across the week, and when it's time to shop, one click turns the list into a ready-to-pay Tesco basket, matched to your price range and organic preference.

## Users
UK households doing a weekly Tesco shop. The atomic unit is **two adults sharing a list** — typically a couple or flatmates who add items across the week and want the actual shopping done for them at checkout time. Secondary: solo shoppers who just want the one-click magic. Not targeted: power users managing multiple stores, meal planners, or budget optimisers hunting deals.

Estimated addressable market: Tesco has ~20M UK customers; ~9M shop online. A realistic early-wedge is tech-comfortable dual-income households (~1–2M).

## Jobs To Be Done
1. When I think of something I need during the week, I want to add it to our shared list from any device, so I don't forget it by shopping day.
2. When my partner adds something, I want to see it instantly, so we don't duplicate items or miss things.
3. When it's time to shop, I want one click to turn my list into a full Tesco basket, so I can just pay and be done.
4. When the system picks products for me, I want them to match my price range and organic preference automatically, so I don't have to babysit every choice.
5. When I correct a bad match once, I want the system to remember, so "milk" always means my milk from then on.

## Out of Scope
Explicit non-goals for v1:

- Supermarkets other than Tesco (Waitrose / Sainsbury's shown as "coming soon" only)
- Multiple lists, templates, or recipe import
- Price comparison across stores
- "What's in my cupboard" inventory tracking
- Native iOS/Android apps (mobile-responsive web + PWA install only)
- Comments, reactions, or chat on list items
- Meal planning or nutrition tracking
- Admin dashboard, analytics UI, audit logs
- Onboarding carousel / product tour
- Web push notifications (deferred to v1.1 — email only in v1)
- Pre-build match confirmation screen (corrections happen post-hoc)

## User Flows

### Flow 1: First-time setup (owner)
1. User lands on marketing page, clicks "Get started."
2. Signs up with email + password.
3. Lands on an empty list screen with a prompt: "Add your first item" and a secondary prompt: "Set up Tesco to enable one-click basket."
4. Adds a few items via the text input at the top of the list.
5. Taps "Preferences" → sets price range (Budget / Mid / Premium), organic toggle, enters Tesco email + password on a trust-building screen that explains encryption plainly.
6. Returns to list. Ready to shop.

### Flow 2: Adding and sharing items (ongoing)
1. Owner opens list from any device, sees current items with quantity steppers.
2. Types a new item in the input, presses enter — item appears immediately.
3. Owner taps "Share" → modal shows a link + copy button. Copies, sends to partner via WhatsApp.
4. Partner opens link on their phone. No sign-up needed. Sees the same list.
5. Partner adds "bread." Within 1 second, owner's device shows "bread" appearing on their screen.
6. Either user can adjust quantities or remove items. Changes sync in real time.

### Flow 3: The one-click basket (the core magic)
1. Owner taps "Add to Basket" CTA on the list screen. *(Collaborators don't see this CTA — see Auth & Permissions.)*
2. **Paywall check.** If free user and their first basket is already used → paywall screen. Otherwise continue.
3. **Existing-basket check.** System checks if Tesco account has items already. If yes → warning modal: "You've got N items already in your Tesco basket. Replace them or merge?" Default: Replace. User picks, continues.
4. **Matching screen.** Each freeform item resolves to a specific Tesco product, ticking off one by one. Cached items are instant; new ones take a few seconds each. User sees "Matching 7/12…"
5. **Building screen.** System logs into Tesco in the background and adds items to the basket. Live status log: "Logged in ✓ · Adding Braeburn apples ✓ · Adding sourdough…" Copy reassures the user: "Keep this page open, or close it — we'll email you when it's ready."
6. **Handoff screen.** When done: "Your Tesco basket is ready. £42.17 · 18 items." Prominent "Go to Tesco checkout" button. Any unmatched items listed: "Couldn't find: fresh dill, oat cream — grab these at Tesco." Clicking through lands the user on Tesco, logged in, basket full.
7. **Post-shop correction.** On the handoff screen, user can tap any matched item and say "wrong product" → pick the right one → system remembers for next time.

### Flow 4: Closing the tab during build
1. User taps "Add to Basket," sees matching screen, decides to close the tab.
2. Build continues on the server.
3. When done, user receives an email: "Your Tesco basket is ready" with a link back into Kart's handoff screen.
4. Clicks through, lands on handoff, clicks Go to Tesco checkout.

### Flow 5: Tesco verification interrupt
1. During build, Tesco challenges the login (email verification, captcha, etc.).
2. Build pauses. User sees a full-screen interrupt: "Tesco needs you to verify this login. Open Tesco, confirm it's you, then tap Resume."
3. User verifies out-of-band, returns to Kart, taps Resume.
4. Build resumes from where it stopped. (If user never resumes within 30 min, build is cleanly abandoned — nothing left half-built in Tesco.)

### Flow 6: Build failure
1. Build fails mid-way (Tesco down, network error, bot detection trip).
2. User sees an error screen: "Something went wrong building your basket. Nothing was left in your Tesco account." + Retry button.
3. Retry re-runs the build from scratch against a fresh snapshot of the list.

### Flow 7: Paywall
1. Free user taps Add to Basket for the second time (first basket was free).
2. Instead of matching, sees a paywall: "Your first basket was on us. Upgrade to keep the magic." Pricing options shown. Card entry inline.
3. On successful subscription → proceeds straight into the matching flow.

## Data Model

Conceptual entities only — full schema lives in the TRD.

- **User** — email, password hash, created_at, subscription_status, tesco_credentials (encrypted blob, nullable)
- **List** — owner_user_id, name, share_token, created_at. One list per owner in v1.
- **ListItem** — list_id, freeform_text ("apples"), quantity, position, added_by (user or anonymous collaborator), created_at
- **Collaborator** — list_id, session identifier (for anonymous access via share link). Tracks who's currently editing for presence/real-time sync.
- **Preference** — user_id, supermarket (Tesco only v1), price_range (budget/mid/premium), organic (bool)
- **ProductMatch** — user_id, freeform_text, tesco_product_id, tesco_product_name, confidence, last_used_at. The learned per-user mapping (`"milk" → Tesco Semi-Skimmed 2L`).
- **BasketBuild** — user_id, list_snapshot (JSON), status (matching / building / paused_verification / ready / failed), progress_log, unmatched_items, tesco_basket_url, created_at, completed_at
- **Subscription** — user_id, stripe_customer_id, stripe_subscription_id, status, trial_used (bool), current_period_end

Relationships: User 1—1 List (v1), List 1—N ListItem, User 1—N ProductMatch, User 1—N BasketBuild, User 1—1 Subscription.

## Integrations

- **Tesco (via headless browser)** — no public API. Stack must drive a real browser session per user against tesco.com. Flows: login, search, add-to-basket, detect verification challenges. Bot-detection resistance is a hard requirement. Credentials decrypted only inside the worker, never logged. See TRD for implementation approach.
- **Stripe** — subscription billing. Checkout Session for the paywall, Customer Portal for managing the sub, webhooks for status changes.
- **LLM provider (for item matching)** — resolves freeform text → Tesco product. Likely OpenAI or Anthropic API with a structured output call that includes user preferences (price range, organic) and any existing ProductMatch for that freeform text. One call per uncached item.
- **Transactional email** — Postmark or Resend. One template in v1: "Your basket is ready."

## Auth & Permissions

Deliberately minimal:

- **Owner** — signs up with email + password. Has one list. Owns the Tesco credentials and the subscription.
- **Collaborator** — accesses the list via share link. No account required. Identified by a session cookie (so presence and "added by" work across visits). Can add, edit, remove list items. **Cannot** trigger Add to Basket.
- **Add to Basket is owner-only in v1.** Rationale: a build runs against the owner's Tesco account and results in the owner's card being charged at Tesco checkout. Restricting the CTA to the owner prevents a collaborator from spending the owner's money without warning. Collaborators see a disabled CTA with tooltip: "Only [owner name] can checkout." This is a conscious v1 simplification; v2 could add owner-configurable permissions.
- Share links are unguessable tokens. Rotatable from the share modal ("regenerate link") — invalidates old link.
- No email verification on signup for v1 (reduces friction; revisit if spam becomes a problem).

## Success Criteria

1. **Time-to-checkout** — median time from "click Add to Basket" to "looking at Tesco checkout" under **2 minutes** for a 20-item list.
2. **Match quality** — ≥**85%** of matched items are "correct first time" (measured by absence of post-shop corrections).
3. **Build success rate** — ≥**95%** of builds complete successfully (excluding Tesco verification interrupts, which count as neither success nor failure).
4. **Real-time sync latency** — collaborator edits visible on other devices within **1 second** at p95.
5. **Paywall conversion** — ≥**5%** of weekly active free users convert to paid.
6. **Trial-to-paid** — ≥**30%** of users who use their free first basket go on to subscribe.

## MVP Definition

The absolute minimum that delivers the magic:

- Email/password signup for owner
- Single shared list per owner with add/edit/remove/quantity items
- Real-time sync to anonymous collaborators via share link
- Preferences: price range + organic toggle + Tesco credentials (encrypted)
- LLM-powered item matching with per-user correction memory
- Headless-browser Tesco login + basket build with live progress
- Close-tab-safe builds with email notification on ready
- Verification-interrupt pause/resume flow
- Existing-basket warning with replace/merge choice
- Handoff to Tesco checkout, plus list of unmatched items
- Stripe subscription with first-basket-free trial
- Post-shop "wrong product" correction
- Mobile-responsive web + PWA install

Everything else listed in the brief — deferred.

## Future Considerations

Things we're explicitly not building in v1 but shouldn't paint ourselves into a corner on:

1. **Multi-store support** — data model should allow a future `supermarket` field on ProductMatch and BasketBuild without migration pain.
2. **Web push notifications** — v1.1. Build the notification dispatch as a pluggable interface so adding web push is a new adapter, not a rewrite.
3. **Recipe import** — parse a recipe URL or paste, add ingredients to the list. Natural next feature after core loop works.
4. **Collaborator-initiated builds with owner approval** — shift from owner-only CTA to a permissions model (e.g., "collaborators can request a build, owner one-taps to approve").
5. **Learned preferences beyond matching** — remembering brands, pack sizes, typical quantities per item.

## Open Decisions Deferred to Post-PRD

- **Subscription pricing.** Brief suggested £1.99/mo or £14.99/yr — founder flagged as TBD. PRD assumes a monthly + annual structure with a first-basket-free trial. Specific numbers to be set before launch and do not affect architecture or build plan.

---

*Sign-off: PRD v1.0 is ready for review. Phase 2 (Technical Architecture) begins only on explicit approval.*
