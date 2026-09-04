# PHI Data Flow

This map identifies where protected or sensitive health/payment-adjacent information can move in the launch build and what controls are required before real PHI flows.

## Stores And Processors

- Supabase `public.appointments.external_payload`: canonical appointment payload with checkout contact, intake, scheduling, payment state, and fulfillment status. Server-side service role only; client APIs shape safe summaries. **BAA: required, self-serve on Team plan + HIPAA add-on.**
- Stripe Checkout: payment processor for deposits and balance collection. Metadata must contain operational IDs and amounts only, not DOB, address, notes, medications, allergies, or emergency contact. **BAA: Stripe does NOT sign BAAs.** Route-around: all metadata writes are filtered through `safeStripeMetadata()` (`api/_lib/safe-stripe.js`) — whitelist of allowed keys plus deny-patterns for PHI-shaped names. CI guard: `scripts/no-phi-in-stripe-qa.mjs` (`npm run test:no-phi-in-stripe`).
- Acuity: scheduling and intake destination for appointment time, contact, address, consent fields, and clinical appointment notes. **BAA: required, self-serve on Powerhouse/Premium tier (in-app link).**
- Resend ops email: PHI-free per `api/_booking-email.js`. The ops email body contains only an admin deep link — no name, contact, appointment time, address, or amounts. Staff click through to Supabase (BAA-covered) to view details. **BAA: not signed.**
- Resend customer email: customer-facing confirmation or pending scheduling messages. Generic content only; minimum-necessary patient-authorized communication per HIPAA permitted use. Do not expose raw provider failures.
- HubSpot: hospitality CRM for identifiers (name/email/phone/city) + lifecycle facets + guest-profile preferences (social handles, style, wardrobe, beverage, music, "anything to help" notes). Fires on signup, on consent-signed (metadata only), on booking lifecycle events, and on admin guest-profile edits. **BAA: not signed; outbound sync is killed by default** — `api/_hubspot.js` refuses all calls unless `HUBSPOT_SYNC_ENABLED=true`. PHI is architecturally excluded via a hard property allowlist + a per-property PHI-token deny sweep on free-text values. CI guard: `scripts/no-phi-in-hubspot-qa.mjs` (`npm run test:no-phi-in-hubspot`). NEVER sends: DOB, address street, emergency contact, allergies, medications, conditions, GFE state, appointment notes, Acuity intake, signature hashes.
- Quo (SMS): OTP-only message bodies. SMS is excluded from Quo's BAA, so we lock the body to authentication codes + staff invite codes. `api/_lib/send-sms.js` refuses bodies containing PHI-shaped tokens as defense-in-depth.
- Sentry-compatible endpoint: telemetry endpoint must use sanitized events and no raw PHI payloads. **BAA: required if `VITE_SENTRY_DSN` is shipped, self-serve on Business tier (Org Settings → Legal & Compliance).**
- Cognito Forms: the patient intake form, and **the sole PHI ingress on front-door hosts**. Served as a sealed `<iframe>` on the `https://www.cognitoforms.com` origin (`src/components/forms/CognitoFormEmbed.jsx`), so every keystroke lands in a document Avalon's JavaScript cannot read — no field value ever enters Avalon's DOM, analytics, or error telemetry. Account key `Tj34pIQDwkyKMQlnT_qpRQ`, form number `1`. Required configuration: **HIPAA Enterprise plan**, entry encryption **ON**, and every field marked **Protected**. **BAA: NOT YET SIGNED (pending signature).** Until it is countersigned the live form must take **synthetic data only** — no real patient may be routed to it. See `docs/COGNITO_FRONT_DOOR.md`.
- Vercel: hosts the app. On the apex/www funnel it hosts all PHI-touching API routes. **On front-door hosts (`snooches.avalonvitality.co`) it serves static assets only** — every PHI-writing API route answers `409 front_door_phi_route_disabled` via `blockFrontDoorPhiRoute()` in `api/_lib/pre-api-guard.js`, so no patient identity reaches a Vercel function or Supabase from that host. CI guard: `scripts/front-door-qa.mjs` (`npm run test:front-door`, also folded into `npm run test:launch-blockers`). **BAA: required, click-through on Pro tier; signed on Enterprise.**
- Nominatim (OpenStreetMap): proxied via `api/address-search.js` and `api/reverse-geocode.js` for address autocomplete and lat/lng lookup. **BAA: not signed; relied on as a de-identified utility.** Route-around: the outbound `fetch` carries only the address string plus a static User-Agent/Referer — no cookies, no Authorization header, no patient identifier. The browser never calls Nominatim directly (it would carry session cookies); all calls go through these two proxies. No responses are persisted. If patient identity ever needs to be attached to a geocode lookup, swap to a BAA-eligible provider (e.g. Google Maps under the Google Maps Platform BAA) before doing so.
- Google Places (New) via `src/components/store/PlacesAutocomplete.jsx`: called directly from the browser using `VITE_GOOGLE_MAPS_API_KEY` (client-visible). Loaded only on `/book`, `/checkout`, `/plan` for address autocomplete. **BAA: not signed.** Route-around: the query is the free-text partial address the user typed; no patient identifier, DOB, name, or appointment ID is included in the query. The autocomplete widget's `componentRestrictions: 'us'` and `types: 'address'` limit the query. If the SDK fails or the key is missing, the component silently falls back to the Nominatim-backed `AddressAutocomplete` above. **Runbook TODO:** lock the API key's HTTP-referrer restrictions in Google Cloud Console to `beta.avalonvitality.co`, `avalonvitality.co`, `*.vercel.app`, `localhost` — the key ships unrestricted at deploy and MUST be restricted immediately after (see `docs/GO_LIVE_STATUS.md`).

## Clinical intake ownership

- **Customer-side checkout** collects the legally required minimum: identity (name/DOB/email/phone), address, emergency contact, single combined consent checkbox. It does NOT collect clinical fields (allergies, medications, medical conditions, COVID/infectious exposure, IV history) — those were moved out of the Acuity Booking Info form (id 3331431) on 2026-07-20.
- **Nurse arrival capture** owns clinical intake via the admin-only Acuity Intake Form (id 3007895) and the `phi.nurseNotes` field on `/admin/clients/:id`. `api/_checkout-fulfillment.js#requiredSchedulingFields` deliberately does NOT write clinical Acuity fields so nurse answers are never overwritten by customer-side defaults.

## Appointment Summary Access

Appointment Summary Access requires either a signed summary token from `APPOINTMENT_SUMMARY_TOKEN_SECRET` or an authorized staff session. Query-string summary tokens are treated as unsafe and denied/audited. Denied reads must not return identifiable appointment details.

## Actors

- Client: can read only their own shaped appointment summaries via session email and signed post-checkout summary tokens.
- Nurse / provider: can access assigned operational/clinical workflow surfaces according to role policies.
- Admin / operator / clinical authority: can access admin bookings, finance, scheduling reconciliation, and balance collection according to role policies.

## Exhaust Controls

- Use the Supabase service role only in serverless functions.
- Keep RLS enabled on exposed public tables.
- Keep audit events for PHI-touching reads and balance charge attempts.
- Keep Stripe metadata PHI-free.
- Keep raw provider errors out of customer responses.
- Keep reconciliation cases for Acuity, email, and CRM failures.
- Use persistent rate limiting for auth, invite, SMS, and public side-effect endpoints.
- Maintain BAAs before real PHI flows with Supabase, Acuity, Vercel, Sentry, Cognito Forms. For vendors that won't sign a BAA (Stripe, HubSpot, Resend, Quo SMS), keep PHI architecturally walled off via the route-around controls listed in the Stores And Processors section — those four are **architecturally walled, not contractually covered**, and that distinction must survive every refactor. A signed BAA is not a substitute for the wall, and the wall is not a substitute for a BAA.
- The **Cognito Forms BAA is not signed yet.** The front-door intake form is live but must receive synthetic data only until it is countersigned.

## Route-Around Controls (vendors without a BAA)

| Vendor | Control | Source of truth |
|---|---|---|
| Stripe | `safeStripeMetadata()` whitelist at every metadata write; CI guard refuses regressions | `api/_lib/safe-stripe.js`, `scripts/no-phi-in-stripe-qa.mjs` |
| Resend | Ops email body stripped to admin deep link; client details only inside Supabase admin | `api/_booking-email.js` |
| HubSpot | Property allowlist in `buildHubspotProperties`; free-text PHI-token deny sweep throws `HubspotPhiRefused`; kill switch (`HUBSPOT_SYNC_ENABLED`); CI regression guard | `api/_hubspot.js`, `scripts/no-phi-in-hubspot-qa.mjs` |
| Quo SMS | Body is OTP/invite-code only; PHI-token deny patterns refuse the send | `api/_lib/send-sms.js` |

## Front-door hosts (PHI-free)

`snooches.avalonvitality.co` is a PHI-free brochure. Two independent gates hold that:

| Layer | Mechanism | Source of truth |
|---|---|---|
| Client routes | `<FrontDoorRedirect>` bounces 10 PHI-collecting routes to `/start` | `src/lib/frontDoor.js`, `src/components/FrontDoorRedirect.jsx`, `src/App.jsx` |
| Server routes | `blockFrontDoorPhiRoute()` answers `409` on 25 PHI-writing handlers | `api/_lib/pre-api-guard.js` |
| Intake | Sealed Cognito iframe; no native input/textarea/select in Avalon's DOM | `src/components/forms/CognitoFormEmbed.jsx` |
| CSP | Two mutually-exclusive blocks; `cognitoforms.com` in `frame-src` only, never `script-src` | `vercel.json` |
| Regression guard | 9 assertions, wired to both `npm run test:front-door` and `npm run test:launch-blockers` | `scripts/front-door-qa.mjs` |

Architecture record and rationale: `docs/COGNITO_FRONT_DOOR.md`.

### Endpoints deliberately exempt from `blockFrontDoorPhiRoute()`

The apex and `www` are front-door hosts, so that guard answers `409` there. Any
feature that must actually work on the apex therefore cannot call it, and cannot
be listed in `PHI_WRITING_HANDLERS`. That exemption is only defensible when the
handler is *structurally* incapable of receiving patient data, and each one is
paid for with a dedicated CI assertion.

| Endpoint | Why it is exempt | Guard |
|---|---|---|
| `api/invoice/submit.js` | Nurse pay data, not patient data. Free text is PHI-screened on input. | `checkInvoicePageIsPhiFree()` |
| `api/notify/intake-alert.js` | Empty POST. `bodyParser` off, a declared body is refused unread, the parsed-body property is never referenced. Sends one frozen constant with no name, service, time, or identifier. | `checkStartPingAndDepositArePhiFree()` |
| `api/deposit/create-session.js` | Empty POST, same body refusal. Sends Stripe no `customer_email`, no name, no phone, no address, no cart; metadata is restricted to `safeStripeMetadata()`'s frozen allowlist; writes nothing to Supabase, Acuity, or HubSpot. | `checkStartPingAndDepositArePhiFree()` |
| `api/deposit/verify.js` | Reads one Stripe session id and returns four payment-derived fields (`ok`, `paid`, `ref`, `amountCents`). `customer_details` / `customer_email` are never read, returned, or logged, so the non-correlation below still holds. Writes nothing anywhere. | `checkStartPingAndDepositArePhiFree()` |

`api/deposit/verify.js` exists because `/start/deposit` used to render "Your $50
deposit is in" from the query string alone — it read `ref` for display, never
read `status`, and never asked Stripe, so anyone could mint a screenshot-able
receipt. Stripe now stamps the session id into `success_url` via
`{CHECKOUT_SESSION_ID}` and the page verifies it before claiming payment. The
handler also requires `metadata.kind === 'start_deposit'`: without that, any
Avalon Checkout Session id — a booking, a plan signup, a gift card — would
render the deposit receipt.

The reviewer's objection to the deposit is that Stripe collects an email on its
hosted page and that email belongs to a healthcare provider's customer. The
answer is that we never **correlate** it: Avalon never learns the address, the
`AV-XXXX-XXXX` reference is random and derived from nothing about the person,
and no record anywhere links a Stripe session to a Cognito entry. The join
happens in a human's head in the Stripe dashboard, not in a data flow we built.

The SMS alert additionally relies on the body being a constant: Quo signs a BAA
but **SMS is not covered by it** (`api/_lib/send-sms.js`). Adding a first name,
a city, or a service to that message would break HIPAA posture, not merely a
lint rule. `checkStartPingAndDepositArePhiFree()` runs the real
`bodyContainsPhi()` over the real constants for exactly this reason.
