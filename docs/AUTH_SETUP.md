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

## Privileged Admin/Staff MFA

Privileged MFA uses two environment flags because enforcement happens in two
independent places:

- `VITE_MFA_ENFORCED=false` is the build-time client gate. When enabled, the
  browser reads the signed-in session through Supabase
  `auth.mfa.getAuthenticatorAssuranceLevel()` and keeps every canonical Admin
  or staff identity at the enrollment/challenge screen until `currentLevel` is
  `aal2`.
- `MFA_ENFORCED=false` is server-only. When enabled, the standard Admin/staff
  role helpers and the enumerated custom Avalon OS, organizer, event
  asset/document, and appointment-summary gates reject access tokens whose
  signed JWT `aal` claim is not `aal2`.

This is an API-layer control, not proof that every route or direct Supabase Data
API policy is covered. The release inventory and database AAL2 work remain open
P0 requirements in the security remediation plan.

Do not enable only one half in production. Keep both flags false for local/demo
review; demo and beta-review identities retain the explicit
`not_required_demo_local` state and never manufacture a Supabase AAL.

Lockout-safe activation:

1. Replace shared credentials with named Supabase users and enable TOTP in the
   target Supabase project.
2. In a protected preview/staging environment, set both flags to `true`, sign in
   as a named Admin, and complete the QR enrollment or existing-factor challenge.
3. Confirm the browser reports AAL2, a privileged API succeeds, a fresh AAL1
   session is denied, and enrollment recovery works for a second named Admin.
4. Set both flags to `true` in the reviewed production release. The gate keeps
   enrollment, challenge, retry, and sign-out reachable before protected pages.
5. If assurance cannot be read, the client reports `assurance_unavailable` and
   privileged access stays gated. Roll back by setting both flags to `false` in
   one reviewed release; never weaken the state parser or trust User metadata.

Run `npm run verify:mfa-assurance` for the supported-API and fail-closed
contract. Production activation still requires a manual enrollment, recovery,
step-up, and session-revocation drill with captured evidence.

## Forced Password Rotation

`profiles.must_change_password` is server-owned authorization state. An
Admin/staff identity with this flag set is redirected to
`/account/new-password`, and privileged APIs return
`password_change_required` until rotation completes. The password page sends
the new password to `/api/me/account/password`; that server route first waits
for Supabase Auth to confirm the password write and only then clears the flag
with the service-role client. Browser code cannot clear the flag through a
profile update or an authenticated RPC.

The password endpoint remains reachable while rotation is required so the
operator cannot be locked out of the completion path. This repository check
does not prove that migration 055 is applied in a target Supabase project;
confirm the migration and run a real forced-rotation drill before release.

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
- `VITE_MFA_ENFORCED`
- `MFA_ENFORCED`
- `APPOINTMENT_SUMMARY_TOKEN_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `AVALON_INTERNAL_API_SECRET`
- `ACUITY_API_KEY`
- `RESEND_API_KEY`
- `HUBSPOT_ACCESS_TOKEN`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Keep secret values in Vercel/Supabase/Stripe provider dashboards only. Pull local values into ignored `.env.local` files when needed.
