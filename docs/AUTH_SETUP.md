# Avalon Auth Setup

This repo wires Google, Apple, phone OTP, email recovery, and passkeys through Supabase Auth. The human operator owns provider secrets and pastes them directly into Supabase Studio; do not commit secrets.

## Supabase URL Configuration

In Supabase Studio -> Auth -> URL Configuration, set:

- Site URL: `https://snooches.avalonvitality.co`
- Redirect URLs:
  - `https://snooches.avalonvitality.co`
  - `https://snooches.avalonvitality.co/login`
  - `https://snooches.avalonvitality.co/auth/callback`
  - `https://snooches.avalonvitality.co/account/new-password`
  - `http://localhost:4173`
  - `http://localhost:4173/login`
  - `http://localhost:4173/auth/callback`
  - `http://localhost:4173/account/new-password`
  - `http://localhost:5173`
  - `http://localhost:5173/login`
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173/account/new-password`

Use the callback URL shown in the current Supabase project under Auth ->
Providers. It has the shape `https://<project-ref>.supabase.co/auth/v1/callback`.

## Google

Human steps:

1. Create a Google Cloud OAuth web client.
2. Add the Supabase provider callback URL as an authorized redirect URI.
3. Paste the client id and secret into Supabase Studio -> Auth -> Providers -> Google.
4. Enable Google.
5. Run `npm run test:oauth-config`.

## Apple

Human steps:

1. Create an Apple Developer Services ID and private key for Sign in with Apple.
2. Use the same Supabase provider callback URL.
3. Paste the Services ID/team/key details into Supabase Studio -> Auth -> Providers -> Apple.
4. Enable Apple.
5. Run `npm run test:oauth-config`.

## Phone OTP

Human steps:

1. Configure the phone provider in Supabase Studio -> Auth -> Providers -> Phone.
2. Add the Twilio account SID, auth token, and Verify service.
3. Confirm Avalon SMS hook settings separately if using `api/auth/send-sms.js`.
4. Run `npm run test:oauth-config`.

## Verification

After providers are configured:

```bash
npm run test:oauth-config
npm run verify:signup
npm run verify:password-reset
```

Manual check:

1. Open `/signup`.
2. Continue with Google or Apple.
3. Return through `/auth/callback`.
4. Confirm the user lands on `/members/dashboard`.
5. Confirm `public.profiles` has `role='client'`, `status='active'`, and the `avalon-vitality` tenant.

## Launch-Critical Environment Keys

Production auth, checkout, scheduling, messaging, and rate-limit readiness depend on these Vercel/Supabase keys being present in the correct environment:

- `VITE_AVALON_ENABLE_LIVE_API`
- `AVALON_ENABLE_LIVE_API`
- `APPOINTMENT_SUMMARY_TOKEN_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `AVALON_INTERNAL_API_SECRET`
- `ACUITY_API_KEY`
- `RESEND_API_KEY`
- `ATTIO_ACCESS_TOKEN`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Keep secret values in Vercel/Supabase/Stripe provider dashboards only. Pull local values into ignored `.env.local` files when needed.
