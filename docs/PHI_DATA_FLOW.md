# Avalon PHI Data Flow

Internal launch-readiness artifact for HIPAA Track J. This is a map of where
client health data is collected, stored, transmitted, displayed, and excluded.
Do not add real client data or secrets to this file.

## Scope

Launch scope is mobile IV therapy. The data below covers booking intake,
checkout fulfillment, appointment summaries, member/admin/nurse surfaces,
Supabase persistence, Acuity scheduling, Resend email, Stripe payment, Attio
CRM sync, browser analytics, and browser error telemetry.

## Data Classes

| Class | Examples | Handling |
| --- | --- | --- |
| Contact PII | name, email, phone | Needed for checkout, scheduling, receipts, support, and admin operations. |
| Visit location | address, ZIP, appointment window | Needed for mobile dispatch and Acuity scheduling. |
| Clinical intake | DOB, consent flags, medical conditions, allergies, medications, emergency contact, notes, GFE or clinical review flags | Treated as PHI. Stored in Supabase appointment payload and sent only to clinical/fulfillment surfaces that need it. |
| Payment data | Stripe customer/session/payment intent IDs, deposit, balance due, saved-card presence | Operational financial data. No raw card data is stored by Avalon. |
| Operational IDs | appointment record ID, Acuity appointment ID, order number, reconciliation case IDs | Preferred cross-system references. Safe for metadata/log correlation when separated from contact or clinical fields. |

## Source Of Collection

| Surface | Data Entered | Local Browser Handling | Server Handling |
| --- | --- | --- | --- |
| Booking and checkout flow | selected protocol/add-ons, address, ZIP, name, email, phone, DOB, intake flags, consent flags, notes | Cart and local preview handoff can store non-production simulation state. Privacy/security QA blocks direct PHI-like browser storage keys. | `api/create-checkout-session.js` validates and length-caps contact/appointment fields before building checkout payload. |
| Member portal | authenticated session identity, own appointment summaries | Uses Supabase auth token for `/api/me/*`. | `/api/me/appointments` matches the signed-in user by checkout email and shapes a safe summary; it does not return raw `external_payload`. |
| Admin portal | staff-visible booking list, contact/location, balances, saved-card presence | Protected by client route guard and server admin checks. | `/api/admin/bookings` requires Supabase admin role before returning staff-visible fields from appointment payload. |
| Nurse/provider surface | assigned visit context and local pre-API operational state | Demo/local state only until live assignment flow. | Supabase RLS migrations restrict nurse/provider reads to assigned records for PHI-bearing tables. |

## Persistence

| Store | PHI/PII Stored | Current Control |
| --- | --- | --- |
| Supabase `public.appointments.external_payload` | Full checkout payload including contact, appointment, selected items, amount details, and clinical intake fields | Required source of truth for fulfillment. RLS is enabled; service-role API paths write server-side. Migrations through `011_launch_messaging_roles.sql` must be applied live before real PHI. |
| Supabase appointment payment columns | Stripe IDs, deposit/balance amounts, payment status, Acuity ID | Used for billing, reconciliation, and admin charge integrity. Balance charge attempts write immutable `audit_events`. |
| Supabase clinical tables | visits, consent signatures, record locks/addenda, escalations, adverse events, do-not-treat flags | `010_tighten_clinical_rls_and_reconciliation_cases.sql` limits client reads to own records, nurse/provider reads to assigned records, and admin/clinical authority reads deliberately. |
| Browser local/session storage | Demo auth/session, cart, theme, analytics queue, local preview booking handoff | Security/privacy QA blocks direct PHI-like storage keys. Live PHI must stay server-side. |

## Third-Party Data Flows

| Destination | Data Sent | Purpose | Boundary |
| --- | --- | --- | --- |
| Stripe Checkout | customer email, receipt email, payment line items, amounts, payment method settings, operational metadata | Payment authorization, deposit capture, receipt, saved-card setup for balance collection | Stripe metadata is limited to operational IDs/amounts/item keys and minimal labels. Contact, DOB, address, emergency contact, notes, clinical flags, and item price detail are excluded from metadata. Stripe still receives payment PII needed for checkout/receipts. |
| Acuity | name, email, phone, appointment time/type, location, DOB, consent fields, clinical intake fields, notes, selected protocol/add-ons | Scheduling and clinical appointment record/dispatch | Acuity is a PHI vendor and requires BAA before real PHI. API errors must not log raw response bodies. |
| Resend ops email | PHI-rich operations notification: client contact, service, time, location, payment/balance status, IDs | Staff alert when payment is received or fulfillment needs action | Resend requires BAA before real PHI. Ops email is separate from customer-safe email. |
| Resend customer email | first name and customer-safe payment-received/confirming copy | Reassure customer after payment when appointment is pending confirmation | Must not include internal IDs, raw errors, clinical details, fulfillment errors, address, DOB, emergency contact, or clinical flags. |
| Attio | contact identity plus CRM-safe segmentation fields | CRM lifecycle/contact sync | Descriptions use an explicit allowlist: source, lifecycle stage, city, plan interest, visit count. DOB, emergency contact, address, ZIP, appointment time, items, clinical flags, payment amounts/status, booking IDs, and service labels are excluded. |
| Sentry-compatible endpoint | scrubbed browser error events only when `VITE_SENTRY_DSN` is set | Runtime error visibility | `src/lib/errorTelemetry.js` redacts contact fields, query strings, headers, cookies, DOBs, phone numbers, emails, addresses/notes, and sensitive tokens before dispatch. Sentry requires BAA before enabling with real PHI traffic. |

## Appointment Summary Access

| Caller | Access |
| --- | --- |
| Booking confirmation page after paid checkout | Calls `checkout/verify`; receives a signed short-lived summary token in component state and sends it to `appointment-summary` through the `x-appointment-summary-token` header. Tokens require the dedicated server-only `APPOINTMENT_SUMMARY_TOKEN_SECRET`. |
| Authenticated client | Can read an identifiable summary only when their Supabase email matches the checkout email. |
| Staff roles | Admin and nurse/staff roles can read identifiable summaries for operational use. |
| Bearer of Stripe session ID only | Receives `401 summary_auth_required`; no address, phone, email, DOB, emergency contact, notes, or clinical flags are returned. |

## Exhaust Controls

| Exhaust Surface | Control |
| --- | --- |
| Stripe metadata | `buildStripeCheckoutMetadata` emits IDs, fulfillment version, amount cents, payment type, item keys/types, and minimal labels only. |
| Analytics | `src/lib/analytics.js` documents and enforces no PII in event props; revenue matrix verifies funnel events without contact fields. |
| Browser error telemetry | `sanitizeErrorTelemetryEvent` redacts common PII/PHI and strips request query strings, headers, cookies, and body data. |
| API logs | Smoke tests block raw vendor `err.body` logging in checkout/fulfillment/webhook paths. |
| URLs | Appointment details are not encoded into success URLs; `session_id` alone is not sufficient to read an identifiable summary. |
| Client portal summaries | `/api/me/appointments` returns shaped visit/payment status and excludes raw `external_payload`. |

## Access Control Summary

| Role | Intended Access |
| --- | --- |
| Client | Own appointment/payment summaries and own messages. |
| Nurse / provider | Assigned appointments, visits, patient/person rows, clinical events, notifications, consent signatures, and reconciliation cases tied to assigned appointments. |
| Admin / operator / clinical authority | Deliberate staff access to tenant operational and clinical records. |
| Anonymous | No live PHI. Local preview/demo data only when live API is disabled. |

## Go-Live Requirements

- Apply Supabase migrations through `011_launch_messaging_roles.sql`.
- Set production Supabase URL and anon key in Vercel.
- Set `VITE_AVALON_ENABLE_LIVE_API=true` in production.
- Set server-only `APPOINTMENT_SUMMARY_TOKEN_SECRET` in Vercel before live checkout confirmation.
- Rotate exposed Acuity and Gemini keys.
- Confirm Stripe live mode and webhook secrets.
- Sign BAAs before real PHI flows: Supabase, Acuity, Resend, Sentry, and hosting if PHI transits it.
- Confirm production MFA decision/enforcement.
- Run staging drills for forced Acuity failure, webhook/verify race, and unauthenticated appointment-summary probe.
