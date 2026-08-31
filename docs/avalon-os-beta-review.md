# Avalon OS protected beta review

This build is exclusively for `beta.avalonvitality.co`. It must use a dedicated Vercel project, a dedicated staging Supabase project, sandbox payment providers, isolated Acuity test resources, restricted outbound recipients, authenticated application access, and `noindex, nofollow, noarchive`.

## Provisioning status

The dedicated Vercel project `avalonweb-beta` (`prj_smizqQYWmruc0rbuWIulXxKUMQvD`) is configured with Vite, `npm run build`, and `dist`. The active Preview deployment is `dpl_EdfaAjRhgtYwFokNbua3AamDk8p3`, and `beta.avalonvitality.co` points to that deployment. It emits `X-Robots-Tag: noindex, nofollow, noarchive`.

Vercel Standard Protection does not protect the custom domain. The beta domain therefore uses real Supabase email/password authentication instead of the old client-only review session. Unauthenticated operational API requests return `401`, and the live-API flags are enabled only in the beta project's Preview environment. No main or Snooches alias was changed.

The dedicated free Supabase organization and staging project `avalon-os-beta` (`adnuvhjodolgpenfhvrh`, West US) are healthy. Repository migrations `001` through `045` have been applied. Its URL, anon key, service-role key, project ref, and synthetic-review password exist only as Preview variables in `avalonweb-beta`.

Five `example.test` review identities, 104 synthetic capability records, a balanced opening ledger, synthetic inventory, an open shift, a completed shift, a submitted nurse invoice, and a four-stop nurse route are seeded. The admin login, scheduling workspace, invoice queue, accounting ledger, client-payments workspace, and server-backed nurse route builder have been verified against this staging project.

The seed command refuses to run unless the Supabase URL matches `AVALON_BETA_SUPABASE_PROJECT_REF`, the review email domain ends in `.test`, and an explicit `--apply` flag is present:

```sh
npm run seed:avalon-os -- --apply
```

Required environment variables are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AVALON_BETA_SUPABASE_PROJECT_REF`, `AVALON_BETA_REVIEW_PASSWORD`, and optionally `AVALON_BETA_REVIEW_EMAIL_DOMAIN` (defaults to `example.test`). Never paste values into this document.

## External API activation checklist

| Priority | System | Beta-only values needed |
| --- | --- | --- |
| Required | Supabase | Project URL, anon key, service-role key, project ref, and a synthetic review-user password. |
| Required for client payments | Square sandbox | Sandbox access token, application/location IDs, webhook signature key, and the exact beta webhook notification URL. |
| Required for legacy checkout paths | Stripe test mode | Test secret key, test publishable key, and test webhook signing secret. |
| Required for live scheduling | Acuity test resources | User ID, API key, dedicated beta calendar ID, and test appointment-type IDs. |
| Required for outbound email | Resend | Restricted API key, verified beta sender, and recipient allowlist. |
| Required for outbound SMS | Quo/OpenPhone | Sandbox/restricted API key, beta sender number, and recipient allowlist. |
| Recommended | HubSpot sandbox | Private-app access token and sandbox portal ID. |
| Optional | Mercury, QuickBooks, Gusto | Sandbox credentials; otherwise the audited manual CSV adapters remain active. |
| Optional | Nursys, Qualiphy | Sandbox access; otherwise auditable manual verification remains active. |

All secrets belong only in Vercel Preview environment variables. Production credentials, real patient data, and unrestricted recipient lists are prohibited.

## Review identities and scenarios

| Identity | Role | Primary scenario |
| --- | --- | --- |
| `avalon-beta-admin@<test-domain>` | Admin | Configure settings, review integration health, approve finance and audit evidence. |
| `avalon-beta-staff@<test-domain>` | Staff | Manage synthetic clients, events, inventory, balances, and reconciliation. |
| `avalon-beta-nurse@<test-domain>` | Nurse | Accept a synthetic shift, complete dispatch/kit/visit closeout, and file an incident. |
| `avalon-beta-organizer@<test-domain>` | Organizer (`promoter`) | Take an inquiry through proposal, presale, staffing, kiosk service, and closeout. |
| `avalon-beta-client@<test-domain>` | Client | Book, complete test intake/GFE, view membership/balance/documents, and request support. |

Use fictional names and addresses only. Do not enter real patient data, real PHI, production payment details, or live vendor credentials.

## Release lock

Before and after every beta release, record the deployment IDs for `avalonvitality.co` and `snooches.avalonvitality.co`. They must be identical. A beta release must never use `vercel deploy --prod`, re-alias either production domain, run migrations against production, or modify production webhooks.
