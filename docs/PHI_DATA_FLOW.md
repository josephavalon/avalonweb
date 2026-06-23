# PHI Data Flow

This map identifies where protected or sensitive health/payment-adjacent information can move in the launch build and what controls are required before real PHI flows.

## Stores And Processors

- Supabase `public.appointments.external_payload`: canonical appointment payload with checkout contact, intake, scheduling, payment state, and fulfillment status. Server-side service role only; client APIs shape safe summaries. **BAA: required, self-serve on Team plan + HIPAA add-on.**
- Stripe Checkout: payment processor for deposits and balance collection. Metadata must contain operational IDs and amounts only, not DOB, address, notes, medications, allergies, or emergency contact. **BAA: Stripe does NOT sign BAAs.** Route-around: all metadata writes are filtered through `safeStripeMetadata()` (`api/_lib/safe-stripe.js`) — whitelist of allowed keys plus deny-patterns for PHI-shaped names. CI guard: `scripts/no-phi-in-stripe-qa.mjs` (`npm run test:no-phi-in-stripe`).
- Acuity: scheduling and intake destination for appointment time, contact, address, consent fields, and clinical appointment notes. **BAA: required, self-serve on Powerhouse/Premium tier (in-app link).**
- Resend ops email: PHI-free per `api/_booking-email.js`. The ops email body contains only an admin deep link — no name, contact, appointment time, address, or amounts. Staff click through to Supabase (BAA-covered) to view details. **BAA: not signed.**
- Resend customer email: customer-facing confirmation or pending scheduling messages. Generic content only; minimum-necessary patient-authorized communication per HIPAA permitted use. Do not expose raw provider failures.
- Attio: CRM destination for safe lifecycle/contact fields only. **BAA: not signed; outbound sync is killed by default** — `api/_attio.js` refuses all calls unless `ATTIO_SYNC_ENABLED=true`. Re-enable only after a BAA is executed or after migration to a HIPAA-eligible CRM.
- Quo (SMS): OTP-only message bodies. SMS is excluded from Quo's BAA, so we lock the body to authentication codes + staff invite codes. `api/_lib/send-sms.js` refuses bodies containing PHI-shaped tokens as defense-in-depth.
- Sentry-compatible endpoint: telemetry endpoint must use sanitized events and no raw PHI payloads. **BAA: required if `VITE_SENTRY_DSN` is shipped, self-serve on Business tier (Org Settings → Legal & Compliance).**
- Vercel: hosts all PHI-touching API routes. **BAA: required, click-through on Pro tier; signed on Enterprise.**
- Nominatim (OpenStreetMap): proxied via `api/address-search.js` and `api/reverse-geocode.js` for address autocomplete and lat/lng lookup. **BAA: not signed; relied on as a de-identified utility.** Route-around: the outbound `fetch` carries only the address string plus a static User-Agent/Referer — no cookies, no Authorization header, no patient identifier. The browser never calls Nominatim directly (it would carry session cookies); all calls go through these two proxies. No responses are persisted. If patient identity ever needs to be attached to a geocode lookup, swap to a BAA-eligible provider (e.g. Google Maps under the Google Maps Platform BAA) before doing so.

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
- Maintain BAAs before real PHI flows with Supabase, Acuity, Vercel, Sentry. For vendors that won't sign a BAA (Stripe, Attio, Resend), keep PHI architecturally walled off via the route-around controls listed in the Stores And Processors section.

## Route-Around Controls (vendors without a BAA)

| Vendor | Control | Source of truth |
|---|---|---|
| Stripe | `safeStripeMetadata()` whitelist at every metadata write; CI guard refuses regressions | `api/_lib/safe-stripe.js`, `scripts/no-phi-in-stripe-qa.mjs` |
| Resend | Ops email body stripped to admin deep link; client details only inside Supabase admin | `api/_booking-email.js` |
| Attio | Outbound sync disabled by default (`ATTIO_SYNC_ENABLED`); short-circuits at the API client | `api/_attio.js` |
| Quo SMS | Body is OTP/invite-code only; PHI-token deny patterns refuse the send | `api/_lib/send-sms.js` |
