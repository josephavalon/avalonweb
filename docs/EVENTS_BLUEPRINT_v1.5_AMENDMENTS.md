# Events Platform — Blueprint v1.5 Amendments

Applies over **Build Blueprint v1.4** (July 2026). Produced 2026-07-05 by /design-consultation with user approval. The design system itself lives in [`DESIGN.md`](../DESIGN.md) (repo root) — this document is the build-plan deltas.

## Vision stack (user-stated, governs everything)

- **Brand thesis:** **"We deliver care."** We deliver (mobile — we pull up, whatever/whoever/wherever), we deliver care (medical, RN-staffed, charted), we care (hospitality).
- **North star:** "That was the easiest, smoothest wellness event booking ever."
- **Objectives:** Speed · Simplicity · Completeness — across all meanings and concepts.
- **Governing metric:** **Time to Finish (TTF)** — booking → payment → health check → queue → administration → back on the floor.
- **Hard invariant:** perfect HIPAA / perfect PHI security. Where TTF and PHI conflict, PHI wins; redesign for speed *within* the boundary.
- **End goal ("Avalon Disneyland"):** multiple partner providers under the Avalon banner doing everything you can think of in a mobile setting — the Lightning in a Bottle wellness area, productized. If someone wants a wellness event, Avalon is that company.
- **Scope for this build:** v1 ships the IV platform exactly per blueprint v1.4; the park architecture goes into schema and enums only (groundwork, rows-not-migrations).

## The five signature design moves (what makes it industry defining)

1. **"Back on the floor" is the product promise** — giant 30 (IV) / 5 (shot); every service carries a time-to-return rendered everywhere and driving day-of SMS ("you'll be back on the floor by 11:40").
2. **Mono = TRUE** — everything medically/operationally true renders in IBM Plex Mono. Guests learn: mono = verified.
3. **Clinicians as headliners** — the event page's second module: names, credentials, license numbers set like catalog numbers. Requires real portraits + staff consent; cut the module rather than ship stock photos.
4. **Price is a number, never a table** — one price, one sentence per tier; protocol detail is one tap into a mono sheet.
5. **The kiosk is a departures board** — idle state is the live queue in split-flap rows, initials only. The DMV asks you to take a number; the board puts your name in lights.

---

## A. Governing metric: instrument TTF end-to-end (amends Steps 0, 9, 10)
- Scope Lock addition: the platform's one number is TTF — first tap to back-on-the-floor. Every stage has a budget; dashboard shows p50/p95 per stage; breaches alarm.
- **TTF budgets (v1 gate criteria):** reserve first-tap→paid ≤90s (returning member ≤45s) · GFE invite→scheduled ≤24h SLA · kiosk sign-in ≤90s · call→at-station ≤5min · shot administration door-to-floor ≤5min · IV chair time ≤30–45min by protocol · walk-up pay-by-phone ≤30s.
- Add timestamps to the Step 9 stream to compute stage TTF, plus `administration_started/completed` from the serve tool.
- **Industry-defining move:** publish the number — "average guest: booked in 74 seconds, back on the floor in 31 minutes." Instrumented TTF makes it provable; nobody in events or med-spa can say it.

## B. Design-system corrections (amends Steps 1.2, 4)
- Replace every "frosted glass" reference with **V2 flat surfaces** (opaque `#0d0d0d`, 12%-white borders, 1.35rem radius, zero blur). DESIGN.md is the source of truth.
- **Stack decision flag (week 1):** blueprint says Next.js App Router as a new app; the shipping site is Vite + the `app-modules` shim pattern. "Must merge into beta" argues for building the events surface inside the existing app (inherits tokens, nav, auth, theme system; deploys on the existing beta alias flow). If Next.js stays, port `src/index.css` tokens + fonts wholesale. Do not resolve silently.
- Self-host IBM Plex Mono (400/500 woff2) with the inline @font-face + preload pattern. No Google Fonts `<link>` in production.

## C. Client surface amendments (amends Step 4)
- **4.1 feed cards:** back-on-the-floor mono badge ("IV · BACK IN 30 / SHOTS · BACK IN 5") in the card meta. State chips stay the only scarcity signal.
- **4.2 event page module order:** photo poster → hosted-by + clinical lead → clinicians-as-headliners → duration pills → "What's included" (from package) → Good to know. Countdown stays Luma-quiet.
- **4.3 reserve sheet:** single-price photographic tier cards; **ban native `<select>` option wheels from the entire reserve flow** (repo learning: /book step-3 iOS wheel); custom pill stepper; price rolls as mono odometer.
- **4.4 trip page:** boarding-pass layout; day-of TTF promise line ("back on the floor by ~HH:MM" from queue + protocol time).
- **Checkout hardening (amends 6.1, from repo history):** pin `payment_method_types: ['card']` on every Checkout/Payment-Link session so Stripe Link OTP can't hijack the sheet before Apple Pay renders; verify Apple Pay domain + wallet activation for events routes in week 1. A hijacked payment sheet is a direct TTF failure.

## D. Portals & serve amendments (amends Steps 3, 6)
- Portals adopt the **Still regime**: dense, instant, zero animation, mono for states/timestamps/counts. Day-ops (light) tokens for bright venues.
- **6.2 serve view:** chair/station timer with projected back-on-floor time; feeds trip page and T+ SMS.
- **6.3 kiosk:** the iPad idle state IS the departures board — merges the separate "lounge queue board" line item (wk7); an optional TV mirrors the same route. Board flip + SMS fire together.
- **Queue lanes:** shots are a 5-minute express lane; call-next respects lanes so a shot guest never waits behind three 30-minute IV starts.

## E. Schema deltas (amends Step 2)
- `catalog_item` + `back_on_floor_minutes int` — renders badges, drives serve timer + day-of SMS.
- `queue_entry` + `lane` (or derive from service interest).
- Analytics + `administration_started/completed`.
- `provider` table + `catalog_item.provider_id` (see H) — one Avalon row in v1.
- `asset` + `theme` tables (see J).

## F. Perfect HIPAA / PHI security — the invariant, made enforceable (amends Steps 2, 6.3, 8)
- **One-question gate for every future feature:** "does this put PHI on the platform?" If yes, redesign. Template: express lane = phone → pointer lookup → `gfe_status` enum; zero health content crosses.
- **The design system IS a privacy control (testable rules):** board = initials only, opt-out honored; door mode = name + clearance color only; mono voice renders enums/counts/timestamps, never conditions/meds/reasons; SMS content-free; email links, never describes; wallet pass = state enum; QR = flag COUNT; kiosk wipes between guests (no back-nav, 90s idle reset, no autofill); Slack = initials + category.
- **Data-shape guards:** `application.answers` stays non-medical; flag categories pulled from Acuity at render time, never stored; CI grep fails migrations adding free-text health-ish fields.
- **RLS deny-tests run in CI on every migration** (promoter→GFE detail, door→flags, nurse→revenue all rejected at the database), not just at sign-off.
- **BAA inventory = week-1 blockers:** Acuity Powerhouse, Twilio, Supabase. Stripe ownership matches MSO/PC before real money moves.
- **Red-team drill in the rehearsal script:** per-role PHI-reach attempts via API and UI; pass = every attempt dies at RLS with an audit row.
- The "platform DB contains zero intake content" check becomes a scheduled job.

## G. What v1.4 already gets right (design-ratified, no change)
Acuity-as-the-chart PHI architecture; three-portal RLS model; zero-pixel policy; offline signed-manifest door; refund machine incl. medical-decline-always-full; the 10-week/two-engineer honesty; the comp-tier rehearsal gate.

## H. The end goal: Avalon Disneyland (amends Steps 0, 2, 3.5)
v1 build scope stays the IV platform; "out of scope: marketplace, non-IV services" becomes "out of *build* scope for v1" — the data model is the wellness-area platform from day one.

| Disneyland | Avalon platform | Status |
|---|---|---|
| One gate, one ticket | One QR / wallet pass, valid at every station | v1 (per-service clearance scoping exists) |
| Attractions | `catalog_item` + station modes | v1 ships 2; additive rows after |
| Ride wait board | Kiosk departures board + per-station waits | v1 |
| Lightning Lane | The SMS queue; lanes per service class | v1 |
| Cast members | Providers under the banner; credential display scales (RN, NP → LMT, DC, RYT-500) | v2 network |
| Park standards | Provider vetting + catalog approval — "promoters compose, Avalon curates," generalized | v2 onboarding |
| Park map | Trip page day-of map with stations + live waits | v2 |

Groundwork in v1 (rows-not-migrations): `provider` table (Avalon = row #1); **service classes** `flow` / `express` / `session` / `amenity` (IV/shots prove the first two; the rest are enum values waiting); portals generalize by role+provider scoping; `requires_gfe` stays the clinical gate, `requires_waiver` covers non-medical services; partner payouts = Stripe Connect column only, flow flagged off; design scales by token (a new service = provider row + catalog row + back-on-floor minutes + class + supply ref; no new screens).

## I. Legal reality check — CPOM + FDA (amends Step 8; counsel signs off, this is build posture not legal advice)
- **CPOM/MSO:** all medical care rendered by the clinician-owned PC; Avalon-the-company is the MSO for a **fair-market-value fee, not a percentage of clinical revenue** (CA scrutiny). Platform posture already correct: clearance is only the nurse's tap; GFE gates every injectable; member perk is access-not-price. Copy rule: the banner sells the experience, the PC delivers the medicine.
- **FDA 503A:** bags compounded patient-specifically after GFE + NP order — never pre-batched (503B product is the only batch path). **TTF optimization must never pre-stage compounded bags ahead of clearance.** Watch-list: glutathione, NAD+ (document 503B sourcing).
- **Claims discipline:** week-9 copy pass includes an FDA/FTC claims screen — no treat/cure/prevent claims. The hospitality voice is also the compliant voice.
- **Future providers:** chiropractic (own CA corporate-practice regime), massage, fitness each carry their own licensing/insurance — handled per-provider via `provider.credentials/insurance_ref`.

## J. Organizer imagery + event theming, admin-audited (amends Steps 3.1, 3.3, 4.2)
- **Image uploads (promoter portal):** gallery + hero to Supabase Storage; every asset carries uploader, timestamp, status (`pending|live|pulled`). The standard scrim makes any photo on-brand automatically.
- **Theming = curated picker, not a stylesheet:** organizers choose from Avalon-authored theme rows that recolor live-state accents only; chrome, mono voice, and red/green clinical reservations are locked at the system level. Never free-form colors/fonts/layout.
- **Admin audit (compliance panel):** Brand & content audit view — every live asset/theme, one-tap pull/replace reverting to defaults, all audit-logged. Per-event `auto-publish` vs `require approval before Presale push`.
- **Guardrails:** organizer warrants image rights in upload T&Cs; no patient-identifiable imagery without photo release; webp/avif compression so uploads can't blow the TTF page-weight budget.

## K. Insurance workstream (amends Step 8; feeds H's provider network)

Insurance is both an ops requirement and a platform feature. Two sides:

**The Avalon/PC coverage stack (week-1 broker engagement, bound before the first paid event):**
- **Professional liability / med-mal** covering the PC and every rendering clinician — with **mobile/off-site practice explicitly endorsed**. Many med-mal policies assume a fixed clinic; an events business dies on that assumption. Confirm per-clinician vs entity coverage and 1099-vs-W2 implications.
- **General liability** ($1M/$2M typical) — venues will demand it, plus **additional-insured endorsements** naming the venue and host per event.
- **Product liability** for compounded/administered products (pairs with the 503B sourcing documentation from amendment I).
- **Commercial auto** for the mobile fleet; **workers' comp** for staff.
- **Cyber liability with HIPAA breach response** — the platform is PHI-free by architecture, but Avalon touches PHI operationally through Acuity access; breach-response coverage is cheap relative to the exposure.
- **Event cancellation coverage** — consider per large B2B event (refund exposure concentrates); optional, price it per event.
- Clarify the boundary of what the venue/host carries (their GL, liquor liability) vs what Avalon carries — written into the event agreement template.

**Platform hooks (build items):**
- **COI creation & submission, not just tracking:** the admin panel generates the COI *request* from event data — venue name/address, event dates, required limits, and additional-insured wording auto-filled from `container` — and submits it to the broker/carrier in one click (broker email pipe in v1; carrier/broker API — Thimble/Coverdash-class or the broker's portal — when available). The returned certificate lands on the event as a versioned document, and one tap sends it to the venue contact. The Monday task group on presale push auto-includes "COI to venue" and closes itself when the document goes out (non-PHI payload, existing pipe).
- **Contracts engine (same pattern as the package builder — the package IS the exhibit):** Avalon-authored, counsel-approved templates generate real agreements from platform data:
  - **Event agreement** (host/organizer): scope, the approved package as Exhibit A (itemized, clinical/experience lines separated per §3.5), payment terms, cancellation/refund policy, insurance boundaries (who carries what, from the coverage stack above), indemnification.
  - **Provider agreement** (partner onboarding, feeds H): services, rates, insurance minimums, brand standards, BAA when clinical.
  - **Venue riders** as needed.
  - E-signature via a Dropbox Sign / DocuSign-class integration; status machine `draft → sent → signed → active → expired`, all audit-logged; per-event config can **gate the presale push on a signed event agreement** (mirrors the package-approval gate). Contracts carry business terms only — no PHI — so the e-sign vendor needs no BAA. (Company-level BAAs — Acuity, Twilio, Supabase — stay in the Step 8 compliance workstream where they belong; they are not an events-platform feature.)
- **Schema delta (adds to E):** `document (id, container_id | provider_id, kind [coi | event_agreement | provider_agreement | venue_rider | waiver_template], status, url, esign_ref, version, expires_at, created_by, at)` — one table serves COIs and contracts; expiry alerts come free.
- **Provider insurance enforcement (feeds H):** `provider.insurance_ref` points into the same document system — coverage type, carrier, limits, expiry, additional-insured status. **A provider with a lapsed COI or unsigned agreement cannot be added to an event package** — same hard-enforcement pattern as the minimum-notice rules. Expiry alerts surface in the admin portal before they become day-of problems.
- **Waivers complement insurance:** `requires_waiver` services (amendment H) get their liability waiver flow; waiver completion is a visit-level status enum like everything else. Photo release stays separate.
- **Guest-side stays cash-pay:** HSA/FSA acceptance is already handled (MCC 8099 + receipt substantiation wording). Health-insurance *claims billing* is out of scope permanently for elective wellness; a v2-maybe is superbill generation from the visit record — flag only, do not promise reimbursement anywhere in copy (claims-discipline overlap with amendment I).

---

## Implementation order — ship until API, then finish with API input

Strategy: the repo already carries live Stripe, Acuity, Supabase, Resend, and Attio integrations, and the events surface is started (`app-modules/pages/Events.jsx`, `EventPage.jsx`, `EventPresale.jsx`, `TripPage.jsx` on static demo data). So the build splits hard: **Phase 1 ships everything achievable on existing credentials; Phase 2 items land independently as each credential arrives and never block Phase 1.** The platform runs in graceful degradation until then (board-only queue, trip-page QR as the pass).

### Phase 0 — start the paperwork clocks (day 1, parallel, no code)
- **Twilio account + BAA + A2P 10DLC campaign registration** — the longest pole (days to weeks of carrier approval); start immediately even though the code lands late in Phase 1.
- **Acuity Powerhouse upgrade + BAA** — required before *real patient* health checks, not before building against the existing Acuity creds.
- **Apple Pass Type ID certificate** (+ Google Wallet API access).
- **Stripe account config** (not a new API): HSA/FSA confirmation on MCC 8099, Apple Pay domain verification for the events routes.
- **Broker engagement** for the coverage stack (K); **counsel review** of event/provider agreement templates (K + I) and postures (I).

### Phase 1 — ship until API (existing credentials only)
1. **Foundation:** stack decision (B — default: inside this Vite app); events schema in Supabase (container/tier/visit/queue_entry/catalog + `back_on_floor_minutes`/provider row #1/asset/theme/document) replacing the localStorage demo (`avalon.events.demo.visits.v1`); DESIGN.md skin on the existing events pages — IBM Plex Mono self-hosted, three voices, pill components. DESIGN.md + CLAUDE.md committed ✅.
2. **Client journey:** feed → event page → reserve sheet: free RSVP end-to-end, then **paid checkout via the existing `create-checkout-session`** (server-side price recompute + webhooks already live; add `payment_method_types: ['card']` pin). Trip page with signed-JWT QR (Node crypto, no vendor) + day-of mode.
3. **GFE loop on existing Acuity creds:** GFE appointment type (dashboard config); health-check card → Acuity scheduling → webhook flips `gfe_status`; card-stack reviewer with one-tap clear/decline; medical decline → auto full refund via existing Stripe.
4. **Portals:** three-portal shell + RLS permission matrix + CI deny-tests; promoter event setup incl. image uploads + curated theme picker (J); admin audit panel; tier builder; package builder MVP with dual sign-off.
5. **Serve + kiosk:** scanner PWA + offline signed manifest + per-service clearance; kiosk intake posting to Acuity via existing creds; queue in **board-only mode** (departures board shows position; no SMS yet); express-lane ordering (D).
6. **Analytics:** server-side event stream + TTF timestamps to Postgres; CI pixel check extended to events routes.
7. **Phase 1 exit gate — internal rehearsal on beta (team only, no real patients):** paid flow + GFE loop + offline scan drill + kiosk board-only drill; TTF stopwatch drill vs budgets; PHI red-team drill; merge-into-beta screenshot check.

### Phase 2 — finish with API input (each lands independently, in arrival order)
- **Twilio live (BAA + 10DLC approved):** SMS queue — call-next texts, 5-min response timer, two-call no-show + rejoin, pay-by-phone clearance link; reminder SMS (skip if Acuity native reminders cover the GFE nudge); full kiosk concierge drill.
- **Acuity Powerhouse BAA executed:** real patient health checks authorized → first public event unblocked.
- **Wallet passes (Apple cert / Google API):** branded passes with silent GFE-state updates; trip-page QR remains the permanent fallback.
- **Monday.com token:** task-group push on presale (incl. auto "COI to venue" item).
- **E-sign vendor:** contracts engine (K) — event/provider agreements with presale gating; COI stays an email pipe until a broker API exists.
- **v1 gate (unchanged from blueprint):** a real low-stakes comp-tier event with real strangers, **TTF budgets met**, PHI red-team passed, zero door incidents — requires at minimum the Twilio and Acuity items above.

## Verification
- **Design:** compare built screens against the approved preview (`~/.gstack/projects/josephavalon-avalonweb/designs/design-system-20260705/afterglow-clinical-preview.html`); `/design-review` after each client surface ships.
- **TTF drill:** stopwatch script at dress rehearsal (first tap→paid ≤90s; kiosk→queue ≤90s; shot lane ≤5min door-to-floor); p50/p95 from the analytics stream vs budgets.
- **Smoothness guards:** Apple Pay renders first on a Link-enrolled email (no OTP hijack); grep reserve flow for native `<select>`; `npm run a11y:scan` incl. kiosk route; `npm run test:launch-blockers`.
- **PHI red-team drill:** per-role API + UI attempts rejected at RLS with audit rows; DB scan confirms zero intake content after the kiosk drill.
- **Merge-into-beta check:** events feed screenshot next to the live landing page — a stranger can't tell where the old site ends and the new wing begins.
