# Avalon Security Phase 0 Implementation Record

Status: review candidate only; not applied or deployed
Date: 2026-08-30
Branch: `codex/avalon-security-architecture`
Baseline audit: `02f4d899fe3b38ffa41326101c11e455c53658ae`

## Outcome

This branch implements a bounded first containment and authorization slice after the security architecture audit. It does not claim compliance, certification, production effectiveness, or completion of the broader remediation plan.

No Supabase migration was applied. No production environment variable, provider setting, secret, data, domain, deployment, or GitHub branch protection rule was changed.

## Implemented in the review candidate

### 1. Profile authority escalation closed in migration code

- `supabase/migrations/055_profiles_authority_rls_hardening.sql` removes the broad `is_operator()` `FOR ALL` profiles policy.
- Direct authenticated profile updates are removed; ordinary member edits use the authenticated server API.
- Password-rotation flag completion uses the server-owned service-role path only after the password provider confirms the write; the old caller-accessible flag-clear RPC is removed.
- Application profile updates, including Clinical authority fields, require a server-owned service-role path.
- A service-role-only, tenant/id-bound RPC applies patient profile patches atomically and preserves clinician notes and review markers from the locked row; member-authored context uses a separate `patientNotes` JSON field.
- Legacy email resolution uses exact canonical equality inside one tenant and fails closed for zero or duplicate matches; it never interprets email characters as wildcard patterns.
- `scripts/admin-cross-portal-qa.mjs` guards the policy and trigger contract.

State: `IMPLEMENTED_UNVERIFIED`. It remains unapplied and requires a staging migration drill and live negative RLS test before production.

### 2. Highest-risk service-role object paths tenant-scoped

- Communications list/detail/store paths require a tenant, scope parent and child messages to it, and reject unassigned inbound persistence.
- `supabase/migrations/057_communications_tenant_integrity.sql` replaces global contact uniqueness with tenant-scoped uniqueness and adds tenant-integrity checks and a composite message/thread foreign key without assigning unknown legacy rows.
- The Quo inbound adapter requires an explicit `QUO_TENANT_ID` binding.
- `api/events/manifest.js` scopes containers, visits, updates, and referenced services to the caller tenant and authorized event.
- `api/events/serve.js` authorizes the tenant event first, binds token/visit/service data to it, and scopes the photo-release mutation.
- Organizer, event-asset, and event-document service-role paths now require an explicit caller tenant and independently scope containers, assignments, child records, and mutations to it.
- Manifest token issuance requires a successfully persisted one-time JTI; signed-token scans require the same non-empty stored JTI and fail closed on persistence errors.
- `scripts/verify-service-role-tenant-boundaries.mjs` adds regression contracts.

State: `IMPLEMENTED_UNVERIFIED`. Static and local tests pass. A live two-tenant test is still required, and the `transition_event_visit` RPC should later accept and verify tenant/container itself.

### 3. Privileged MFA assurance repaired

- `src/lib/mfaAssurance.js` uses Supabase's supported `auth.mfa.getAuthenticatorAssuranceLevel()` API.
- Unsupported `User.aal`/`User.amr` inference was removed.
- When enforcement is on, an assurance read failure stays gated; when off, local/demo behavior is unchanged.
- Paired `VITE_MFA_ENFORCED` and `MFA_ENFORCED` configuration and rollout are documented.
- Standard Admin/staff role helpers and the enumerated custom Avalon OS, organizer, event asset/document, and appointment-summary gates share one server assurance and forced-rotation policy.
- A browser session can no longer clear `must_change_password`; the server clears it only after the identity provider confirms the password write.
- The production verifier requires both flags to be true, and the MFA gate always exposes a sign-out/switch-account escape.
- `scripts/mfa-assurance-qa.mjs`, smoke, and launch checks protect the contract.

State: `IMPLEMENTED_UNVERIFIED`. Both flags remain false by default. Direct Supabase Data API policies do not yet enforce AAL2. The P0 is open until database enforcement plus named production accounts, enrollment/recovery, AAL1 denial, AAL2 success, and session revocation are evidenced.

### 4. Public member-message attachment path contained

- `supabase/migrations/056_secure_member_message_attachments.sql` makes the bucket private and removes browser-direct upload/read/delete policies.
- The member UI no longer uploads, renders, links to, or fetches legacy attachment URLs.
- Text messaging remains available and the UI truthfully labels attachments unavailable during the security upgrade.
- `scripts/p0-data-containment-qa.mjs` guards the containment.

State: `IMPLEMENTED_UNVERIFIED`. Migration 056 is unapplied. Existing objects and public URLs require inventory and exposure review before rollout. Attachments stay disabled until quarantine, validation, malware/DLP scanning, short-lived server-authorized download, audit, and lifecycle deletion are complete.

### 5. Live Clinical browser profile cache removed

- Every real Supabase session purges the legacy `clientProfile` cache.
- Live profile saves remain server-authoritative and clear rather than mirror the cache.
- BookNow no longer reads or writes cross-session or in-tab booking drafts, last-booking payloads, group leads, subscription intake, or local handoff copies containing personal/Clinical fields.
- Sign-out removes the legacy non-prefixed booking session draft.
- The local simulation redactor now covers address, emergency-party data, COVID/infectious status, IV history, nurse notes, PHI policy, and GFE keys.
- Synthetic local/demo editing remains available.

State: `IMPLEMENTED_UNVERIFIED`. Local source tests pass; browser/device inspection is still required in staging across Account and Book flows.

### 6. Legacy Qualiphy mutation contained in production

- The static-secret callback now requires an explicit synthetic/local compatibility flag.
- The route refuses mutation unless `NODE_ENV` is explicitly development/test and `VERCEL_ENV` is absent or development, even if the flag is set.
- The unmatched callback log no longer writes the provider patient identifier.
- Profile cache updates resolve exactly one tenant-bound profile through exact canonical email equality and then mutate by stable profile ID; zero/duplicate matches fail closed.

State: `CONTAINED_NOT_REPLACED`. Production mutation remains intentionally unavailable. The P0 stays open until a provider-native signature or reviewed raw-body HMAC, timestamp freshness, durable replay rejection, provider-account/tenant binding, conditional writes, audit, and reconciliation are implemented.

### 7. Invoice no-PHI release guard restored

- The receipt instruction now says `no personal names or health details`, preserving the warning without patient-facing language on the pay-data-only route.
- `npm run test:launch-blockers` passes on the built candidate.

State: `IMPLEMENTED_UNVERIFIED` until the exact reviewed artifact passes protected CI and hosted verification.

## Verification result

The following passed after all Phase 0 candidate changes:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:security`
- `npm run test:privacy`
- `npm run test:admin-portals`
- `npm run test:os-rls`
- `npm run test:team`
- `npm run test:smoke`
- `npm run test:launch-blockers`
- `npm run verify:mfa-assurance`
- `npm run verify:events-qr`
- `npm run verify:event-organizer`
- `git diff --check`

`npm audit --omit=dev --audit-level=high` reported no high/critical production advisory at the configured threshold; two moderate React Router advisories remain and require a planned, tested upgrade rather than an automatic breaking change.

## Still-open P0 work

1. Apply migrations 055, 056, and 057 in an isolated staging project with backup, rollback, data/object inventory, and negative tests; then review production rollout separately.
2. Inventory and reconcile legacy communications rows, backfill known ownership, validate migration 057 constraints, and run live two-tenant reconciliation.
3. Replace the disabled Qualiphy legacy callback with a signed, replay-safe, tenant-bound integration.
4. Complete named accounts, database/RLS AAL2 enforcement, paired MFA activation, recovery, session revocation, and step-up evidence.
5. Complete required BAAs/DPAs, provider configuration evidence, and the vendor registry before real PHI.
6. Make sensitive audit writes transactional/fail-closed and add sensitive read/denial/export/workload context.
7. Replace remaining broad service-role use with scoped DB roles/RPCs; bind `transition_event_visit` inside the RPC.
8. Standardize all file paths, including team inbox and event documents, on scanning and short-lived access.
9. Complete the service-role query inventory, log/analytics/egress controls, distributed rate-limit verification, backups/PITR/restore evidence, incident runbooks, and independent testing.

## Staging rollout and rollback

1. Snapshot schema, policies, storage configuration, profile counts/roles/tenants, message objects, and public URL inventory.
2. Apply migration 055 only; run member-profile API, password-rotation, staff, tenant-admin, inactive, null-tenant, and cross-tenant tests plus Admin team operations.
3. Apply migration 056 only after object inventory and communication plan; verify anonymous and direct authenticated object reads fail.
4. Inventory and reconcile communications ownership before applying migration 057; then validate its deferred constraints and verify Quo tenant binding.
5. Deploy the matching application candidate; run Account, Book, Messages, Admin communications, event manifest/serve, MFA, and release suites.
6. Keep attachments and legacy Qualiphy production mutation disabled.
7. If a functional regression occurs, roll back the application first. Database rollback must be a reviewed forward migration; never restore the broad profiles operator policy or public bucket as a convenience fix.

Production requires a separate change approval with the security, privacy/clinical, system, and release owners.
