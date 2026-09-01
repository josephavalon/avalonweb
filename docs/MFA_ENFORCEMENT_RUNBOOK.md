# Enabling operator MFA (`MFA_ENFORCED`)

Status as of 2026-09-01: **code ready, flag not set.** `MFA_ENFORCED` does not
appear in `vercel env ls production`, so `mfaEnforced()` is `false` and every
operator-tier route is reachable with a password-only Supabase session.

Deploying the code changes nothing. The gate is inert until the flag is set,
which is deliberate — see the ordering warning below.

## What the flag now covers

Until 2026-09-01 only `requireAdmin` / `requireRole` consulted the flag. Three
other helpers admitted the operator tier on top of `getAuthedUser()` and never
checked it, so setting the flag would have *looked* like it covered the admin
surface while leaving these password-only:

| Helper | Routes | Fixed by |
|---|---|---|
| `requireOsOperator` (`api/_lib/os-api.js`) | all of `api/os/v1/*` | `operatorMfaBlocked()` |
| `requireFinanceActor` (`api/_lib/payops-core.js`) | 17 finance / payroll / vendor-bill routes under `api/admin/` | `operatorMfaBlocked()` |
| `requireFinanceAdmin` (`api/admin/finance/roles.js`) | finance **role assignment** | `operatorMfaBlocked()` |

`requireVendorActor`, `requirePayrollView` and `requirePayrollAction` are thin
wrappers over `requireFinanceActor` and inherit it.

`operatorMfaBlocked()` (`api/_lib/supabase-auth.js`) is the single rule: it
blocks `admin`, `staff`, and `founder` sessions below `aal2` when the flag is
on, and is a no-op for `client` and `nurse`. `scripts/launch-blocker-qa.mjs`
asserts each helper still calls it, and that the two wrapper modules still
delegate rather than growing their own `getAuthedUser()` call.

## Order of operations

**Setting the flag before anyone has enrolled locks every operator out of the
admin API**, including the pages used to fix it. Do it in this order.

1. **Enroll a TOTP factor for every active operator.** Query the roster first:

   ```sql
   select id, email, role from profiles
   where role in ('admin','staff','founder') and status = 'active';
   ```

   Each person enrolls via Supabase MFA in the account UI. A session only
   carries `aal2` after the factor is *verified* in that session, not merely
   enrolled.

2. **Confirm one operator reaches `aal2` end to end** — sign out fully, sign in,
   complete the second factor, and load an `api/admin/*` route successfully.

3. **Only then** set the flag:

   ```
   vercel env add MFA_ENFORCED production      # value: true
   ```

   It is read per-request, so a redeploy is not required, but existing warm
   lambdas pick it up on their next invocation rather than instantly.

4. **Verify enforcement.** With an `aal1` operator token:

   ```
   curl -H "Authorization: Bearer <aal1-token>" https://www.avalonvitality.co/api/admin/bookings
   # expect 403 {"error":"Multi-factor authentication required","code":"mfa_required"}
   ```

   Repeat against one `api/os/v1/*` route and one finance route — those are the
   surfaces that were previously uncovered and are the point of this change.

## Rollback

Remove the env var (`vercel env rm MFA_ENFORCED production`). The gate reverts
to inert immediately; no code change or redeploy is needed. Nothing else in the
request path depends on it.
