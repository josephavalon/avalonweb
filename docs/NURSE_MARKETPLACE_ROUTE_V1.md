# Nurse Marketplace + Route V1

## Release boundary

This feature is local-first and beta-only. The only hosted target authorized for
this work is the isolated `avalonweb-beta` Vercel project at
`beta.avalonvitality.co`. Do not link this worktree to `avalonweb`, deploy to its
production target, change the apex or `www` aliases, or apply these migrations
to the main Supabase project.

If beta Supabase credentials, `CRON_SECRET`, or the Google Cloud identity are
missing, keep the build local and report the missing prerequisite. Never fill a
beta gap with a main-production credential.

## Human and feature gates

Every Nurse Marketplace environment flag defaults off. Enabling a flag does not
replace the corresponding human approval or database policy:

- Product/Ops owns appointment mappings, offer waves and expiry, amendment
  materiality, route release, and recovery policy.
- Clinical/Medical Direction owns guides, supply manifests, GFE readiness, and
  the guide publishing workflow.
- Credentialing, Inventory, HR/Legal, and Privacy/Security own their readiness
  domains.
- Google Cloud owners provision Route Optimization, billing, quotas, and the
  Vercel OIDC workload identity.

No active policy or approval means `blocked`, never an inferred default. Route
auto-release remains disabled in V1. Web Push, SMS/email offer delivery,
background GPS, and saved-home origins are outside V1.

## Stage-aware readiness

The existing route-before-claim dependency is intentionally replaced:

1. `offer` checks identity, license/scope, engagement, schedule preferences,
   appointment/client readiness, GFE, payment, safety, a published guide, and an
   approved supply manifest.
2. `claim` repeats those checks under lock, checks capacity and stock
   feasibility, and atomically creates the assignment and reservations.
3. `route_release` requires one-time origin consent, complete inventory
   disposition, a feasible plan version, current evidence, and a human release.
4. `run_start` requires acknowledgement of the released revision.

Contractors always accept an offer and any material amendment. An approved W-2
policy may allow direct assignment, but it does not bypass readiness, route
acknowledgement, or audit requirements.

## Privacy contract

- Pre-acceptance cards contain only operationally safe service, area, window,
  estimated duration, compensation/terms, and readiness information.
- Google receives only opaque stop IDs, coordinates, time windows, service
  durations, pickup precedence, and capacity/load data.
- Appointment addresses are never geocoded inside this workflow. Routing
  requires fresh tenant-local destination coordinates with approved provenance;
  missing coordinate evidence blocks planning before any provider call.
- A current foreground coordinate is passed through one planning request and is
  not stored. Its persisted request fingerprint is keyed with a beta-only
  `NURSE_ROUTE_REQUEST_HASH_SECRET`; the raw coordinate is never persisted.
  Replanning requires fresh consent. Typed route-day origins may be
  resolved by Google Geocoding v4 through the same server-side OIDC identity and
  may be stored; the existing public Nominatim lookup is not used for Nurse
  origins. Saved home origins are not implemented.
- Any provider error, timeout, validation error, quota rejection, or skipped
  expected stop makes the plan infeasible. Work is never silently omitted.
- External Maps opens only the current leg. The nurse deliberately records
  arrival after returning to Avalon.
- The authenticated Today screen may render the persisted Google route
  polyline over Mapbox GL. Mapbox is presentation-only: it receives no patient,
  appointment, service, or Avalon route identifiers, and it cannot establish
  route feasibility or release a route.

## Beta activation order

1. Run all local marketplace, Nurse release, protected-route, security, build,
   and migration contract checks.
2. Link an isolated temporary deployment directory to `avalonweb-beta`; do not
   create `.vercel` linkage in the repository worktree.
3. Confirm beta-only Supabase and server credentials exist. Apply migrations
   through `082_nurse_route_map_preview.sql` to
   beta, run the schema/RLS postflight, and verify no main resource changed.
4. Deploy with all new flags off. Confirm the resulting project ID, build SHA,
   no-index header, and `beta.avalonvitality.co` alias.
5. Enable one capability at a time for named beta accounts after its owner gate:
   reconciliation/readiness, offers/in-app recovery, inventory reservations,
   then route planning. Route release remains manual.
6. Capture authenticated Nurse/Admin proof for claim races, pickup, route
   infeasibility, cancellation, offline recovery, timekeeping, and the complete
   alert-to-closeout journey.

Main production promotion is a separate, future change requiring explicit user
authorization after the beta evidence packet is complete.
