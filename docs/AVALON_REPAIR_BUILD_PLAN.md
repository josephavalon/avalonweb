# AVALON_REPAIR_BUILD_PLAN.md

> **Context.** Full-platform audit of Avalon Vitality (React + Vite SPA, Vercel serverless `api/`, Stripe, Acuity, Attio, Supabase + demo auth) run via `/code-review` + `/design-review` against the working tree on `snooches-deploy`. Five parallel audit passes (diff correctness, diff cleanup, security/HIPAA, frontend design/UX/a11y, reliability/release readiness) plus manual verification of every critical claim. Findings below are repair actions, not feedback. On approval this document is saved to `docs/AVALON_REPAIR_BUILD_PLAN.md` and Phase 1 begins.
>
> **Verification notes** (claims hand-checked, not just agent-reported):
> - NAD+ add-on price drift between `src/data/catalog.js` and `api/_lib/catalog-pricing.js` — **confirmed with exact numbers**.
> - `api/appointment-summary.js` unauthenticated PHI — **confirmed** (no auth check; returns name-adjacent appointment data for any Stripe session ID).
> - PHI in Stripe checkout metadata — **confirmed** (`buildStripeCheckoutMetadata` at `api/_checkout-fulfillment.js:439` writes name, email, phone, DOB, emergency contact, address, notes, clinical flags).
> - One agent claimed `.env.local` with `ACUITY_API_KEY` is *committed* — **refuted**: `git ls-files` shows only `.env.example` is tracked. The key exists in the local untracked file only. Rotation is still on the existing launch checklist (chat-exposed key), but this is not a repo leak.
> - `||` vs `??` on `launchPayment.depositAmount` (`api/create-checkout-session.js:~220`) — **confirmed latent**: quote-required events return `depositAmount: 0`, but today that only happens when subtotal is 0, which zeroes the fallback too. Fix to `??` so it never bites.

---

## Executive Summary

**Current readiness: NOT production-ready. Beta-ready with known blockers.**

The booking and payment core is well-architected (server-side price sanitization, idempotency claims, reconciliation cases, webhook signature handling), but three classes of issues block launch:

1. **PHI exposure** — full client PII/PHI is written into Stripe metadata and served back by an unauthenticated endpoint. This is the single largest HIPAA-conscious-design failure and contaminates Stripe dashboards, logs, and webhook payloads.
2. **Pricing integrity** — the uncommitted diff updated server NAD+ pricing but left the client add-on catalog and one server label-map entry stale. Customers currently see $600/$950/$1100 and get charged $650/$1000/$1200 at Stripe (visible mismatch at checkout — a trust-killer and chargeback magnet), and the 1000mg add-on undercharges by $50.
3. **Silent partial failure** — Stripe payment succeeding while Acuity booking fails leaves the customer with a success page and no appointment, with only a reconciliation table row to catch it.

**Fastest path to release:** Phase 1 (security: 3 fixes) + Phase 2 (blockers: pricing sync, fulfillment notification, validation) ≈ the minimum ship set. Everything else hardens conversion, polish, and accessibility behind that.

---

## Critical Ship Blockers

| Priority | Issue | Impact | Root Cause | Repair Action | Acceptance Criteria |
|---|---|---|---|---|---|
| P0 | Unauthenticated PHI endpoint `api/appointment-summary.js` | Anyone with a Stripe session ID (present in success URLs, browser history, logs) reads appointment details: address, price, status, payload-derived contact data | Endpoint trusts `session_id` query param as the only credential | Require auth (Supabase session or signed short-lived token issued at checkout return) OR strip response to non-identifying fields (status, paid flag, first-name only, time). Never return address/DOB/contact | Unauthed request with valid session ID returns 401 or a redacted body containing no address/phone/email/DOB; success page still renders |
| P0 | Full PII/PHI in Stripe metadata (`api/_checkout-fulfillment.js:439`) | Name, email, phone, DOB, emergency contact, address, clinical notes visible in Stripe dashboard/exports/webhooks — HIPAA exposure to a non-BAA processor surface | Metadata doubles as the fulfillment fallback payload (`checkoutPayloadFromStripeMetadata`) | Persist the full payload to Supabase `appointments.external_payload` *before* session creation (already partially done via `appointmentRecordId`); reduce metadata to `appointmentRecordId`, `fulfillment`, amounts, item keys. Rewrite the metadata-fallback reader to fetch the record by ID | New checkout sessions show only IDs/amounts in Stripe metadata; fulfillment still completes when webhook fires before/after verify; grep of metadata builder shows no contact/DOB/address fields |
| P0 | Client/server add-on price mismatch (`src/data/catalog.js:190-195` vs `api/_lib/catalog-pricing.js`) | NAD+ 750mg shows $600, charges $650; 1250mg shows $950, charges $1000; 1500mg shows $1100, charges $1200 — visible price jump at Stripe | Diff updated server key-map + fallback but not client `IV_ADDONS` | Update `IV_ADDONS` NAD+ prices to 650/800/1000/1200 (750/1000/1250/1500mg). Long-term: generate both maps from one source (see Architecture) | Cart price equals Stripe line-item price for every add-on; `scripts/booking-flow-qa.mjs` extended with a price-parity assertion |
| P0 | Stale `'nad 1000mg': 750` in `ADDON_PRICE_BY_LABEL` (`api/_lib/catalog-pricing.js:58`) | 1000mg add-on undercharges $50 (label map shadows the correct 800 fallback) | Same partial price update | Set to 800; add the missing 750/1250/1500mg label entries so the table is complete rather than fallback-dependent | Unit check: every NAD label price equals the key-map price |
| P0 | Stripe-paid / Acuity-failed silent partial failure (`api/_checkout-fulfillment.js`, `api/integrations/stripe/webhook.js`) | Customer pays, sees success, gets no appointment; ops finds out only by reading `reconciliation_cases` | Fulfillment errors are recorded but trigger no notification | On `stripe_succeeded_acuity_failed`: send ops email + customer email ("payment received, we're confirming your time, an RN will call"); CheckoutSuccess renders a distinct "being confirmed" state when fulfillment is pending/failed | Forced Acuity failure produces: reconciliation row, ops email, customer email, non-success-but-reassuring UI state |
| P0 | `api/admin/collect-balance.js` accepts arbitrary `amountCentsOverride` | An admin (or leaked admin session) can charge any amount with no audit trail | No server-side reconciliation against `balance_due_cents` | Default to DB `balance_due_cents`; clamp override to ≤ balance due; write an audit log row (who, when, appointment, amount, override flag) for every charge | Override above balance is rejected 400; every charge produces an audit row |
| P1 | Double-create race between Stripe webhook and `api/checkout/verify.js` | Duplicate Acuity appointments on user refresh during slow fulfillment | Claim-loser path can still proceed to creation | When `wonSchedulingClaim=false`, never create; poll `readAcuityAppointmentId` ≤5×1s then return `pendingFulfillment: true` for client re-poll | Refresh-spam during slow webhook yields exactly one Acuity appointment |
| P1 | Demo password `JonJones1986` hardcoded in client bundle (`src/lib/useAuthStore.js`) | Secret in shipped JS; demo auth gated to localhost/beta/snooches hosts but the credential is public | Demo roster convenience | Move the password to `VITE_AVALON_DEMO_PASSWORD` consumed only on allowed hosts, set per-environment; exclude from production builds entirely (dead-code-eliminate the demo path when env var absent) | Production bundle contains neither the string nor the demo login path |

---

## Features and Systems To Build

### 1. Audit log for money + PHI access
- **Purpose:** Immutable record of admin charges, balance collections, appointment reads.
- **Business impact:** HIPAA auditability requirement; chargeback defense.
- **User impact:** None visible; protects clients.
- **Priority:** P0 (charges) / P1 (reads). **Dependencies:** Supabase table + service-role writes.
- **Acceptance:** Every `collect-balance`/`charge-balance` call writes actor, appointment, amount, timestamp; rows are insert-only.

### 2. Fulfillment notification pipeline
- **Purpose:** Convert silent reconciliation cases into ops + customer emails (Resend) with retry links.
- **Business impact:** No stranded revenue; SLA on failed bookings.
- **Priority:** P0. **Dependencies:** existing `api/_booking-email.js`, `reconciliation_cases`.
- **Acceptance:** Each reconciliation case type (`acuity_failed`, `crm_sync_failed`, `operations_email_failed`) generates exactly one ops alert; customer-facing email on payment-without-appointment.

### 3. Single-source pricing catalog
- **Purpose:** One data module that generates client display prices and server charge maps.
- **Business impact:** Eliminates the class of drift bugs found in this audit.
- **Priority:** P1. **Dependencies:** none — `api/create-checkout-session.js` already imports from `src/lib/paymentRules.js`, proving shared modules work across both bundles.
- **Acceptance:** `src/data/catalog.js` add-on prices and `api/_lib/catalog-pricing.js` maps derive from one exported table; a parity test fails the build on drift.

### 4. Server-side validation module
- **Purpose:** Shared email/phone/DOB validators used by Checkout client + `create-checkout-session` server.
- **Priority:** P1. **Acceptance:** see Reliability Repair Plan items 4–6.

---

## Design Repair Plan

*(Code-derived findings; Phase 8 re-verifies each on live pixels per the device matrix. Design system context: dark theme, Bebas display, AA-safe grey tiers — see `avalon-design-system` memory.)*

1. **Problem:** Secondary-text opacity used ad hoc (`text-foreground/45 /52 /58 /62 /68 /72`) across `app-modules/pages/Store.jsx:231` and siblings. **Impact:** unpredictable hierarchy and contrast. **Repair:** define 3 semantic tiers in Tailwind config (e.g. `text-secondary` /70, `text-tertiary` /55, `text-hint` /40 — all AA-checked on the dark background) and replace arbitrary tiers. **Acceptance:** grep finds no `/4x`–`/7x` arbitrary opacities on text in pages; all tiers pass 4.5:1.
2. **Problem:** Border-radius zoo — `rounded-full`, `rounded-[1.35rem]`, `rounded-2xl`, `rounded-[1rem]` (`Store.jsx:312` et al.). **Repair:** define radius tokens (`card`, `control`, `pill`) in `tailwind.config.js`; replace arbitrary values. **Acceptance:** no `rounded-[...]` arbitrary values in pages.
3. **Problem:** Primary CTA label swaps (CONFIRM / OPENING / CHECKOUT / NEXT) resize the button (`BookNow.jsx:4086`). **Repair:** fixed `min-w` sized to the longest label, centered text. **Acceptance:** no layout shift on state change at 360–430px.
4. **Problem:** Guided/Custom toggle visually unbalanced (`Store.jsx:174`). **Repair:** equal flex-1 widths, identical padding. **Acceptance:** both segments identical width at all viewports.
5. **Guard (do not regress):** `.av-page-stage` must stay free of `transform`/`filter`/`will-change` (fixed-nav containing-block trap) and the service-worker kill-switch must stay (no caching SW). **Acceptance:** grep confirms both invariants after every phase.

---

## UX Repair Plan

1. **Problem:** Submit allows proceeding with no selection; error surfaces late (`Store.jsx:159`). **User impact:** dead-end flow, abandonment. **Repair:** disable Continue until a goal/therapy is selected; inline helper "Choose a goal or therapy to continue". **Acceptance:** Continue is inert + labeled when cart empty.
2. **Problem:** Checkout redirect has no full-screen pending state (`Checkout.jsx:865`). **Impact:** double-clicks → duplicate sessions. **Repair:** on success, render blocking overlay "Redirecting to secure checkout…", disable all controls, 10s timeout fallback with retry. **Acceptance:** rapid double-click creates one session (assert via network log).
3. **Problem:** Booking confirmation shows bare spinner (`BookingConfirmation.jsx:200`). **Repair:** staged copy — "Confirming your appointment… (usually under 30 seconds)" → timeout fallback "Payment received — your RN will call to confirm." **Acceptance:** no state renders an unexplained spinner > 5s.
4. **Problem:** Zero-availability date is a dead end (`Checkout.jsx:448`). **Repair:** "No openings on this date" + next-3-available-dates shortcut; next button gated on `selectedSlot`, not date. **Acceptance:** zero-slot date cannot advance; alternative dates are one tap away.
5. **Problem:** Disabled submit is opacity-only (`BookNow.jsx:4359`, `Login.jsx:303`). **Repair:** `disabled:cursor-not-allowed` + distinct fill + `aria-disabled`; pair every disabled state with visible reason text. **Acceptance:** disabled vs enabled distinguishable in grayscale screenshot.

---

## CRO Repair Plan

1. **Friction:** Checkout shows a different (higher) price than the cart for NAD+ add-ons. **Conversion impact:** highest-severity trust break possible at the payment moment. **Repair:** P0 price-sync above. **Expected improvement:** checkout completion rate on carts containing NAD+ add-ons recovers to baseline; zero price-mismatch support tickets.
2. **Friction:** Validation errors appear only after submit (`Checkout.jsx:45`). **Impact:** error-discovery round-trips before payment. **Repair:** inline on-blur validation for email/phone/required fields with specific messages. **Expected improvement:** reduced field-correction loops; measure form completion time.
3. **Friction:** Deposit model (deposit now, balance later) computed but not foregrounded as a selling point. **Repair:** at the payment step show "Due today: $50 · Due after your visit: $X" as the primary line, total as secondary. **Expected improvement:** lower sticker-shock abandonment at the final step.
4. **Friction:** Double-submit risk and unclear processing state (UX items 2–3) directly leak conversions. Same repairs; measure duplicate-session count → 0.

---

## Mobile Repair Plan

1. **Viewport fit:** content reserve under the fixed bottom CTA bar (`Store.jsx:357`) — add `pb-[calc(<bar-height>+env(safe-area-inset-bottom)+1rem)]` to the scroll container. **Acceptance:** at 360/375/390/393/414/430px nothing interactive is occluded; checkout CTA clears the iOS Safari toolbar.
2. **Footer reserve brittleness:** `BookNow.jsx:5026` hard-codes `--av-booking-footer-height` fallback — measure the footer with a ResizeObserver and set the CSS var. **Acceptance:** changing footer content never clips the last form field.
3. **iOS input zoom:** inputs at 17px are fine, but audit all inputs ≥16px (`Login.jsx:28` flagged; verify rather than assume). **Acceptance:** no input below 16px computed font-size; iOS Safari does not auto-zoom on focus.
4. **Touch targets:** cart remove button ~20px (`Checkout.jsx:209`); quantity steppers visually small (`Membership.jsx:207`). **Repair:** 44×44 minimum hit area (padding, not icon scale). **Acceptance:** all interactive elements ≥44px in both axes at 360px.
5. **Overlay hit-testing:** verify the `fixed inset-0 pointer-events-none` backdrop (`BookNow.jsx:5216`) never intercepts taps (history: z-index stacking trap already bit this store once). **Acceptance:** tap test on every CTA with overlay present.

---

## Desktop Repair Plan

1. **Hierarchy/composition:** apply the same token scales (Design items 1–2) at 1024/1280/1440/1728px; verify the booking layout uses the width (two-column summary at ≥1280px rather than stretched mobile column). **Acceptance:** no text measure exceeds ~75ch; booking flow shows order summary alongside the form at ≥1280px.
2. **Visual rhythm:** normalize section vertical spacing on the landing page to a single scale. **Acceptance:** section gaps come from ≤3 spacing tokens.
3. **Conversion focus:** primary CTA visible without scroll at 1280×800 on landing and store entry. **Acceptance:** screenshot check at 1280×800, 1440×900.

---

## Accessibility Repair Plan

| Issue | Repair | Acceptance Criteria |
|---|---|---|
| `focus:outline-none` without replacement (`Store.jsx:334`, `Signup.jsx:11`) | `focus-visible:ring-2 focus-visible:ring-accent` everywhere outline is suppressed | Tab through every form: visible focus on each stop (WCAG 2.4.7) |
| Icon-only buttons unnamed (`admin/Inventory.jsx:53`, others) | `aria-label` on every icon-only control | Axe scan: zero "button has no accessible name" |
| Selects without associated visible labels (`BookNow.jsx:5075`, `CustomProtocol.jsx:55`) | `<label htmlFor>` or `aria-labelledby` to the visible label | Screen reader announces purpose for every select |
| Accordion steps lack `aria-expanded`/`aria-controls` (`BookNow.jsx:4050`) | Add both; id the controlled region | SR announces expanded/collapsed on toggle |
| Errors may not announce (`BookNow.jsx:5405`) | Persistent `aria-live="polite"` container that errors render into | VoiceOver announces checkout errors without focus move |
| Contrast of active state text-background combos (`Store.jsx:288`) and grey tiers | Covered by Design item 1 token audit | All text ≥4.5:1 (AA), large display text ≥3:1 |

---

## Architecture Repair Plan

| Issue | Root Cause | Repair | Risk Level |
|---|---|---|---|
| Dual landing trees: `src/components/landing/` vs `app-modules/source/components/landing/` — this diff edits **both** (`Hero.jsx` in one, `RecoveryMenuSection.jsx` in the other) | Historical migration left two copies | Determine the rendered tree from the route imports, mark the other deprecated, delete it (or re-export from one source). Until then: CI grep that fails if a landing component is edited in only one tree | High (drift already happening) |
| `therapyWhatItDoes`/`therapyIngredients` duplicated as `sessionWhatItDoes`/`sessionIngredients` (`BookNow.jsx:228` ↔ `RecoveryMenuSection.jsx:402`) | Copy-paste in this diff | Extract to `src/data/therapyContent.js` keyed by protocol; both import | Medium |
| Hand-maintained triple price source (`catalog.js`, `ITEM_PRICE_BY_KEY`, `ADDON_PRICE_BY_LABEL`) | Grew organically | Single-source pricing catalog (Build item 3) + parity test | High (caused 4 live price bugs) |
| `BookNow.jsx` at ~5,850 lines | Accretion | Extract per-step components + a booking-flow hook; no behavior change, mechanical moves only, after blockers ship | Medium |
| `isGroupVisit` inferred by regex over `orderType + locationType` (`create-checkout-session.js:~207`) | Client sends free-form fields | Normalize `orderType` to an enum client-side at selection time; server validates against the enum | Medium |

---

## Reliability Repair Plan

| # | Issue | Failure Risk | Repair | Validation Method |
|---|---|---|---|---|
| 1 | Acuity-fail-after-pay silent (P0 above) | Paid, no appointment, nobody told | Notification pipeline (Build item 2) + CheckoutSuccess pending/failed states | Force Acuity 400 in staging; assert email + UI state |
| 2 | verify/webhook race (P1 above) | Double-booking | Claim-loser polls then defers | Refresh-spam test during throttled webhook |
| 3 | `checkout/verify` re-read loop unbounded (`api/checkout/verify.js:~150`) | Function hangs to Vercel timeout → 500 | Cap 5 attempts × 1s; return `pendingFulfillment` | Mock never-arriving ID; response < 6s |
| 4 | Email validated with `.includes('@')` (`Checkout.jsx:25`) | Unreachable clients, broken receipts | Shared regex validator client + server (`create-checkout-session.js:~151`) | Submit `test@`, `@x.com` → rejected; `a+tag@sub.domain.org` → accepted |
| 5 | Phone accepts <10 digits (`Checkout.jsx:39`) | Nurse can't call | Min-10-digit validation both sides | `555` rejected with message |
| 6 | DOB unvalidated (`Checkout.jsx:512`) | Future dates, minors | Format + not-future + ≥18 check both sides | Boundary tests incl. exactly-18-today |
| 7 | Non-JSON 200 responses crash/blank checkout (`Checkout.jsx:829`, `CheckoutSuccess.jsx:31`) | Gateway error page → eternal spinner | Content-type check; distinguish parse vs HTTP errors; explicit messages | Mock HTML-200 and 500 responses |
| 8 | Attio + Resend fire-and-forget (`stripe/webhook.js:194,206`) | Stranded CRM data, missed ops alerts | On failure insert reconciliation case (`crm_sync_failed` / `operations_email_failed`) | Revoke tokens in staging; assert cases |
| 9 | `acuityTypeForCart` empty-default silently passes '' (`_checkout-fulfillment.js:~189`) | New catalog item → paid order, failed booking | Throw 400 pre-Stripe when no type id resolves | Add unmapped item; checkout blocked pre-payment |
| 10 | Acuity webhook dedup includes payload hash (`acuity/webhook.js:13`) | Same event, differing timestamp → processed twice | Dedup on (appointment_id + action); keep hash as integrity alert only | POST identical webhook twice; one processed row |
| 11 | Webhook handlers lack body-size limit / external-call timeouts (`stripe/webhook.js`) | Memory/timeout under junk traffic | Body limit + `Promise.race` 10s timeout → reconciliation case + 200 | Oversized payload returns 4xx fast |
| 12 | `setLoading` after unmount (`Checkout.jsx:770`) | Console noise masking real errors in QA | Cancelled-flag cleanup pattern | No React unmount warning on abandon |

---

## Security and HIPAA Review

| Severity | Finding | Risk | Potential Exposure | Repair Action | Validation Method |
|---|---|---|---|---|---|
| CRITICAL | Unauthenticated `GET /api/appointment-summary` (verified) | Session IDs leak via URLs/history/logs; bearer-of-ID reads appointment | Address, schedule, payment status, contact-derived fields | Auth or hard redaction (Blockers table) | Unauthed probe returns 401/redacted |
| CRITICAL | PHI in Stripe metadata (verified, `_checkout-fulfillment.js:439`) | Stripe dashboard/API/webhook surfaces all PII incl. DOB, emergency contact, clinical notes | Every paying client to date | Metadata → IDs only; payload lives in Supabase; backfill-scrub existing sessions where Stripe API allows | Inspect new session metadata; grep builder |
| HIGH | Demo credential in bundle (`useAuthStore.js`) | Public credential; host-gating is the only barrier | Demo accounts; reputational | Env-var + production dead-code elimination | String absent from `dist/` |
| HIGH | `collect-balance` arbitrary override | Over/under-charging without trace | Client funds | Clamp + audit log | Override > balance rejected |
| HIGH | No audit logging on `charge-balance` / internal-secret endpoints | Leaked `AVALON_INTERNAL_API_SECRET` = unlimited untraced charges | Payment + PHI endpoints | Audit rows + per-token rate limit + documented rotation | 15 rapid calls → 429 after limit; rows exist |
| MEDIUM | Open redirect via `redirect` param (`Login.jsx:~108`) | Phishing trampoline | Credentials | Allow only same-origin paths starting `/` (reject `//`, `:`) | `?redirect=https://evil.com` → `/members` |
| MEDIUM | `order-lookup` brute-forceable contact match (`api/order-lookup.js:69`) | Enumerate orders by phone | Appointment details | Rate-limit per IP (5/15min) + require two factors (phone AND email) | 20 bad attempts → 429 |
| MEDIUM | Unbounded contact field lengths (`create-checkout-session.js:~149`) | Metadata bloat / downstream breakage | Availability | Trim + max-length all inputs server-side | 1MB name rejected |
| MEDIUM | Webhook console logging of appointment context (`acuity/webhook.js:138`, `stripe/webhook.js:155`) | PHI fragments in Vercel logs | Log readers | Log IDs + error codes only; no contact fields, no payload echoes | Log review after staged bookings |
| LOW | Auth-resolution flash on protected routes (`useAuthStore.js`) | Brief unauthed render | Minimal | Gate protected routes on session-resolved flag | Hard-refresh shows loader, never content |

**HIPAA posture notes:** BAA tracking, key rotation (Acuity, Gemini), MFA decision, and Supabase RLS migration are already captured in `docs/ENTERPRISE_READINESS_PLAN.md` (§7, tracks B/D/J) — not duplicated here; this plan adds the metadata scrub, unauthenticated-endpoint fix, audit logging, and log hygiene to that list.

## Security Backlog (priority order)

1. **Authentication:** remove bundle credential; demo path dead-code-eliminated in prod builds.
2. **Authorization:** auth/redact `appointment-summary`; role checks asserted server-side on every `api/admin/*` (verify `requireAdmin` coverage); per-user record scoping for future client portal reads (RLS).
3. **Session:** server-side sign-out revocation; absolute session TTL; protected-route gating on resolved session.
4. **PHI protection:** Stripe metadata scrub; log hygiene sweep (`grep -rn "console\." api/` reviewed for contact fields); confirm analytics (`api/analytics.js`) carries no PII.
5. **Role permissions:** scoped nurse role design (pre-req for nurse app), least-privilege internal-secret split (one secret per service, not shared).
6. **Audit logging:** charges, admin reads, reconciliation actions.
7. **API security:** rate limits on `order-lookup`, `auth/send-sms`, webhooks; body-size limits; input length caps.
8. **Portal security:** open-redirect fix; CAPTCHA after repeated lookup failures.

---

## Repair Backlog

### Critical
| Issue | Impact | Repair Action | Acceptance Criteria |
|---|---|---|---|
| Add-on price drift (client 600/750/950/1100 vs server 650/800/1000/1200) | Visible mismatch at payment | Sync `IV_ADDONS` + `ADDON_PRICE_BY_LABEL`; parity test | Cart price == Stripe price, test enforced |
| Unauthenticated appointment-summary | PHI exposure | Auth/redact | 401/redacted unauthed |
| PHI in Stripe metadata | HIPAA exposure | IDs-only metadata | Metadata grep clean |
| Silent paid-without-appointment | Lost bookings, support storms | Notification pipeline + UI state | Forced-failure drill passes |
| Arbitrary admin charge override | Financial integrity | Clamp + audit | Over-balance rejected |

### High
| Issue | Impact | Repair Action | Acceptance Criteria |
|---|---|---|---|
| verify/webhook double-create race | Double-booking | Claim-loser defers | Refresh-spam → 1 appointment |
| Demo password in bundle | Credential exposure | Env-var + DCE | Absent from dist |
| Email/phone/DOB validation | Unreachable clients, invalid bookings | Shared validators | Reject/accept matrix passes |
| `acuityTypeForCart` silent '' | Paid order, no booking | Pre-Stripe 400 | Unmapped item blocked |
| `checkout/verify` unbounded poll | 500s under load | Bounded retry + pending state | <6s response always |
| Landing-tree duplication drift | Divergent prod UI | Consolidate trees | One canonical tree |

### Medium
| Issue | Impact | Repair Action | Acceptance Criteria |
|---|---|---|---|
| Open redirect on login | Phishing | Path allowlist | External redirect rejected |
| Fire-and-forget Attio/Resend | Stranded data | Reconciliation cases | Revoked-token drill |
| Webhook dedup hash | Duplicate processing | ID+action key | Replay test |
| `\|\|` → `??` on depositAmount (`create-checkout-session.js:~220`) | Latent deposit override | Nullish coalescing | Quote-required event keeps $0 deposit |
| Focus states, aria-labels, accordion ARIA | WCAG failures | A11y plan items | Axe clean on core flows |
| Touch targets <44px | Mis-taps | Hit-area padding | 44px audit |
| order-lookup brute force | Order enumeration | Rate limit | 429 after 5 |
| Webhook log hygiene | PHI in logs | ID-only logging | Log review |
| therapy copy duplication | Drift | Shared content module | Single source |

### Low
| Issue | Impact | Repair Action | Acceptance Criteria |
|---|---|---|---|
| CTA label jitter | Polish | min-width | No CLS on state change |
| Radius/opacity token zoo | Consistency | Tokens | No arbitrary values |
| Unmount setState warning | QA noise | Cleanup flag | Clean console |
| Toggle asymmetry | Polish | flex-1 | Equal widths |
| Input length caps | Robustness | Truncate/validate | 1MB rejected |
| `isGroupVisit` regex inference | Fragility | orderType enum | Enum validated |

---

## Action Queue (execution order within phases)

| # | Action | Why | Priority | Complexity | Acceptance Criteria |
|---|---|---|---|---|---|
| 1 | Fix `IV_ADDONS` + `ADDON_PRICE_BY_LABEL` prices, change `\|\|`→`??`, commit the currently-uncommitted diff | The working tree ships price bugs today | P0 | S | Parity assertion green; diff committed |
| 2 | Scrub Stripe metadata to IDs; reroute fallback reader through Supabase | PHI | P0 | M | Metadata grep + fulfillment e2e |
| 3 | Auth/redact `appointment-summary` | PHI | P0 | S | Unauthed probe test |
| 4 | Clamp + audit `collect-balance`; audit rows on `charge-balance` | Money integrity | P0 | S | Override rejected; rows written |
| 5 | Fulfillment failure notifications + CheckoutSuccess pending/failed states | Silent failures | P0 | M | Forced-failure drill |
| 6 | Shared email/phone/DOB validators (client+server) | Data quality | P1 | S | Validation matrix |
| 7 | Race fix in `checkout/verify` + bounded polling | Double-booking | P1 | M | Refresh-spam test |
| 8 | Demo credential to env var, prod DCE | Secret hygiene | P1 | S | dist grep |
| 9 | `acuityTypeForCart` pre-payment guard | Stranded payments | P1 | S | Unmapped-item test |
| 10 | Open-redirect allowlist; order-lookup rate limit | Portal security | P1 | S | Probe tests |
| 11 | Reconciliation cases for Attio/Resend failures; webhook dedup key fix; body limits/timeouts | Ops visibility | P1 | M | Drills |
| 12 | Mobile fixes: CTA bar reserve, touch targets, footer ResizeObserver, overlay hit-test | Mobile conversion | P2 | M | Device matrix pass |
| 13 | UX states: empty-cart gate, redirect overlay, confirmation copy, zero-slot recovery, disabled-state styling | Conversion | P2 | M | Flow walkthroughs |
| 14 | A11y sweep: focus rings, aria-labels, select labels, accordion ARIA, live region | WCAG | P2 | M | Axe clean |
| 15 | Design tokens (opacity tiers, radii); CTA min-width; toggle balance | Polish | P3 | M | Token greps |
| 16 | Consolidate landing trees; extract therapy content module; pricing single-source; BookNow decomposition | Architecture | P3 | L | One tree; parity test; mechanical refactor diffs |

---

## QA Matrix

| Device | Browser | Viewport | Flow | Expected Result |
|---|---|---|---|---|
| iPhone SE-class | Safari | 360×780 | Homepage → store | No horizontal scroll; nav fixed after scroll; CTA visible |
| iPhone 12/13 | Safari | 390×844 | Full booking → checkout | Cart price == Stripe price; CTA clears toolbar; one session per click |
| iPhone Pro Max | Safari | 430×932 | Checkout → success | Success or "being confirmed" state; no eternal spinner |
| Pixel-class | Chrome | 393×873 | Booking w/ NAD+ add-on | Add-on price parity; touch targets ≥44px |
| Mid Android | Chrome | 414×896 | Login (demo + Supabase) → account | Auth resolves without content flash; logout revokes |
| iPad | Safari | 768×1024 | Store + booking | Layout uses width; no clipped fixed bars |
| Laptop | Chrome | 1280×800 | Homepage → booking | Primary CTA above fold; two-column booking summary |
| Desktop | Safari | 1440×900 | Full purchase | Identical totals UI→Stripe→success |
| Desktop | Firefox | 1440×900 | Login + admin LiveBookings | Admin gated; no console errors |
| Large | Chrome | 1728×1117 | Homepage | Composition holds; no stretched measure |
| Any | Chrome | — | Forced Acuity failure | Reconciliation + emails + UI state |
| Any | Chrome | — | Webhook replay / refresh-spam | Single appointment, single processing |

---

## Implementation Phases

**Phase 1 — Security and Stability.** Objective: close PHI and money-integrity holes. Tasks: Actions 2–4, 8, 10. Acceptance: Security table CRITICAL/HIGH items closed. Test: unauthed probes, dist grep, override rejection. Rollback: each action is an isolated commit; metadata scrub is feature-flagged (`STRIPE_LEAN_METADATA=1`) for one release.

**Phase 2 — Critical Ship Blockers.** Objective: pricing integrity + fulfillment honesty. Tasks: Actions 1, 5, 6, 7, 9, 11. Acceptance: parity test in CI; forced-failure and race drills pass. Test: `scripts/booking-flow-qa.mjs` extended; staging drills. Rollback: notification pipeline behind env flag.

**Phase 3 — Mobile Conversion.** Tasks: Action 12 + mobile QA matrix rows. Acceptance: no occlusion/overflow at 6 mobile widths. Test: screenshot run at each width. Rollback: CSS-only, revertible per commit.

**Phase 4 — Desktop Conversion.** Tasks: Desktop plan items; Action 13 remainder. Acceptance: 1280/1440/1728 rows pass. Rollback: per-commit.

**Phase 5 — Accessibility.** Tasks: Action 14. Acceptance: Axe zero criticals on home/store/booking/checkout/login; keyboard-only completion of a booking. Rollback: additive ARIA, low risk.

**Phase 6 — Reliability Hardening.** Tasks: Reliability items 10–12; timeout/body limits; unmount cleanup. Acceptance: drills in QA matrix bottom rows. Rollback: per-commit.

**Phase 7 — Performance Optimization.** Tasks: bundle audit of BookNow (5.8k lines) route-level code-split; image weights in `/bags/`; verify no caching SW reintroduced. Acceptance: Lighthouse mobile ≥85 on home and store; LCP <2.5s on 4G. Rollback: split is mechanical.

**Phase 8 — Final Visual Polish.** Tasks: Actions 15–16 design half; live-pixel re-verification of every Design/Desktop finding (this audit was code-derived). Acceptance: before/after screenshots per fix; design-token greps clean. Rollback: per-commit.

**Phase 9 — Release Validation.** Tasks: full QA matrix; smoke + booking + login QA scripts green against preview; launch checklist below. Acceptance: every matrix row evidenced with a screenshot or log. Rollback: hold release.

---

## Claude 4.8 Execution Plan

**Implementation order:** Action Queue order (1→16); never start a lower phase while a P0 remains open.
**Constraints:**
- Never reintroduce a caching service worker (kill-switch stays).
- Never add `transform`/`filter`/`will-change` to `.av-page-stage`.
- Never put secrets in `VITE_*` vars destined for production bundles; never commit `.env.local`.
- Server remains the only price authority; client prices are display-only.
- One concern per commit; commit message references the Action number.
**Verification requirements:** every action lands with its acceptance check executed (script, probe, or screenshot) and recorded in the PR body; pricing parity test and a11y scan run in CI from Phase 2 onward.
**Regression prevention:** extend `scripts/smoke-tests.mjs` with: price-parity assertion, unauthed appointment-summary probe, metadata-shape check, demo-credential dist grep, `.av-page-stage` style grep.

---

## Final Launch Checklist

- [ ] All P0 blockers closed and drill-verified (this doc, Blockers table)
- [ ] Stripe metadata contains IDs/amounts only; existing session scrub decision recorded
- [ ] `appointment-summary` probe returns 401/redacted unauthenticated
- [ ] Cart↔Stripe price parity test green in CI
- [ ] Forced Acuity-failure drill: reconciliation row + ops email + customer email + UI state
- [ ] Admin charge audit rows verified; override clamp tested
- [ ] Demo credential absent from production bundle; demo path disabled on prod host
- [ ] ACUITY_API_KEY and Gemini key rotated (pre-existing checklist item)
- [ ] Supabase env vars + RLS live in production; `AVALON_ENABLE_LIVE_API=true`
- [ ] Stripe + Acuity webhooks pointed at prod, signature secrets set, replay test passed
- [ ] Validation matrix (email/phone/DOB) green client+server
- [ ] QA matrix: all rows evidenced (screenshots/logs attached)
- [ ] Axe: zero critical violations on the 5 core pages; keyboard-only booking completed
- [ ] Lighthouse mobile ≥85 home/store; no caching SW present
- [ ] Rate limits live on order-lookup and send-sms; open-redirect probe rejected
- [ ] `scripts/smoke-tests.mjs`, `booking-flow-qa.mjs`, `login-qa.mjs` green against production preview
- [ ] BAA/legal items from ENTERPRISE_READINESS_PLAN §7 signed off
- [ ] Rollback plan: previous deploy pinned; SW kill-switch confirmed serving
