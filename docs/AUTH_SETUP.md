# Avalon Auth Setup

This repo wires email recovery, optional Google/Apple OAuth, optional phone OTP, and optional passkeys through Supabase Auth. The human operator owns provider secrets and pastes them directly into Supabase Studio; do not commit secrets.

Provider exposure is controlled by build-time flags. Keep a flag `false` until the matching Supabase provider is configured and verified; disabled providers stay hidden in the UI so snooches does not expose broken launch paths.

- `VITE_AUTH_GOOGLE_ENABLED`
- `VITE_AUTH_APPLE_ENABLED`
- `VITE_AUTH_PHONE_ENABLED`
- `VITE_AUTH_PASSKEY_ENABLED`

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
5. Set `VITE_AUTH_GOOGLE_ENABLED=true` in the target Vercel environment.
6. Run `npm run test:oauth-config`.

## Apple

Human steps:

1. Create an Apple Developer Services ID and private key for Sign in with Apple.
2. Use the same Supabase provider callback URL.
3. Paste the Services ID/team/key details into Supabase Studio -> Auth -> Providers -> Apple.
4. Enable Apple.
5. Set `VITE_AUTH_APPLE_ENABLED=true` in the target Vercel environment.
6. Run `npm run test:oauth-config`.

## Phone OTP

Human steps:

1. Configure the phone provider in Supabase Studio -> Auth -> Providers -> Phone.
2. Add the Twilio account SID, auth token, and Verify service.
3. Confirm Avalon SMS hook settings separately if using `api/auth/send-sms.js`.
4. Set `VITE_AUTH_PHONE_ENABLED=true` in the target Vercel environment.
5. Run `npm run test:oauth-config`.

## Passkeys

Human steps:

1. Confirm Supabase passkey/WebAuthn support is available for the project and target browsers.
2. Set `VITE_AUTH_PASSKEY_ENABLED=true` in the target Vercel environment.
3. Run a manual sign-in/enrollment drill from `/members/account`.

## Verification

After optional providers are configured:

```bash
npm run test:oauth-config
npm run verify:signup
npm run verify:password-reset
```

`npm run test:oauth-config` only requires providers whose `VITE_AUTH_*_ENABLED`
flag is true. Use `OAUTH_VERIFY_STRICT=1 npm run test:oauth-config` for a
hard check that Google, Apple, and Phone are all enabled in Supabase.

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
- `VITE_AUTH_GOOGLE_ENABLED`
- `VITE_AUTH_APPLE_ENABLED`
- `VITE_AUTH_PHONE_ENABLED`
- `VITE_AUTH_PASSKEY_ENABLED`
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
