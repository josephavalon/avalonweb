# Synthetic Nurse route beta seed

This bootstrap is restricted to the isolated beta Supabase tenant created by
`scripts/seed-avalon-os-beta.mjs`. It cannot target the main tenant, accepts
only `.test` operator identities, and never creates a readiness result, offer,
assignment, feasible plan, or release decision.

## Scenario

- Date: September 2, 2026, Pacific time
- Start: Avalon SF office, 275 8th Street, third floor
- 12:00–1:00 PM: `[BETA TEST] Joseph`, generic hydration, Hayward
- 2:00–4:00 PM: `[BETA TEST] Joshua`, NAD+, Millbrae
- Nurse identity: Nora Nurse from the isolated beta identity seed

The script does not commit or print coordinates. An authorized beta operator
must verify the three coordinate pairs and supply them at execution time.

## Commands

Default dry run, with no network or database access:

```sh
npm run seed:nurse-route-beta
```

Static safety verification:

```sh
npm run verify:nurse-route-beta-seed
```

Read-only database preflight:

```sh
SUPABASE_URL=https://BETA_REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
AVALON_BETA_SUPABASE_PROJECT_REF=BETA_REF \
AVALON_BETA_TARGET=avalonweb-beta \
AVALON_BETA_NURSE_EMAIL=avalon-beta-nurse@example.test \
AVALON_BETA_COORDINATES_APPROVED_BY_EMAIL=avalon-beta-admin@example.test \
AVALON_BETA_COORDINATES_APPROVED=true \
AVALON_BETA_SYNTHETIC_GFE_PAYMENT_APPROVED=true \
AVALON_BETA_SF_OFFICE_LATITUDE=... \
AVALON_BETA_SF_OFFICE_LONGITUDE=... \
AVALON_BETA_JOSEPH_LATITUDE=... \
AVALON_BETA_JOSEPH_LONGITUDE=... \
AVALON_BETA_JOSHUA_LATITUDE=... \
AVALON_BETA_JOSHUA_LONGITUDE=... \
npm run seed:nurse-route-beta -- --check
```

Apply uses the same environment with `--apply`:

```sh
npm run seed:nurse-route-beta -- --apply
```

Use a secret manager or an untracked environment file rather than saving the
service-role key in shell history. The script never prints credentials or the
three addresses.

## Required governed state

Before either `--check` or `--apply` succeeds, the beta tenant must contain:

- Active synthetic-only beta tenant and active Nora Nurse/Admin `.test` profiles
- Effective approved `appointment_mapping` policy mapping `hydration` to 60
  minutes and `nad` to 120 minutes
- Effective approved `route_release` policy with complete route constraints
- Active approved supply manifests with requirements for both protocols
- Content-hashed published mobile appointment guides for both protocols
- Migrations through 082, including route-location, marketplace-job, typed
  origin retention, and optional route-preview geometry
- Explicit coordinate and synthetic GFE/payment test approval attestations

The script creates Nora's provider profile as `pending` if it does not exist. It
does not mark credentials or Nursys evidence clear.

## What happens after the seed

The seed queues two appointment reconciliation jobs with no inferred Nurse
candidates. The following steps remain real, independently governed beta work:

1. Run the authenticated marketplace worker with automatic shift creation
   enabled; confirm both canonical shifts are admitted.
2. Credentialing clears the restricted beta Nurse and Operations configures
   current availability, scope, engagement, service area, and schedule evidence.
3. Inventory verifies stock and reservations for the approved manifests.
4. Dispatch attaches an approved offer cohort/terms contract or uses an approved
   W-2 assignment command. Nora claims/receives both shifts.
5. The server creates the route day and stops from those assignments.
6. Google Route Optimization plans the route through the configured Vercel OIDC
   identity. Any skipped stop or provider error must remain infeasible.
7. Dispatch manually releases the feasible route; Nora acknowledges and starts
   it. Auto-release remains disabled.

The current implementation uses Google Route Optimization and external
Google/Apple Maps leg handoff. The beta also includes a Mapbox GL visual preview
of the persisted Google route geometry when `VITE_MAPBOX_ACCESS_TOKEN` is set.
Mapbox is a display layer in this build; it does not replace the governed Google
Route Optimization and Google Geocoding backend.
