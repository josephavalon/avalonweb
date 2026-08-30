# Avalon Security Remediation Plan

Status: proposed execution plan
Plan date: 2026-08-30
Audited source: `02f4d899fe3b38ffa41326101c11e455c53658ae`

## Operating rule

No phase is complete because code exists. A control is complete only when its design is approved, implementation is reviewed, negative and end-to-end tests pass in staging, runtime configuration is verified, evidence is attached, recovery is exercised where relevant, and the accountable owner accepts residual risk.

Production code, migrations, secrets, provider configuration, and real data were not changed during this audit phase.

## Immediate no-go gates

Until Phase 0 is verified:

- no real PHI through the current public member-message attachment path or browser-persisted clinical profile path;
- no production Qualiphy mutation through the current static-secret callback;
- no general `staff` release against the current profiles authority policy;
- no real-PHI launch without required BAA/configuration evidence;
- no autonomous Clinical agent or patient marketing;
- no live RobBot3K sends, forms, calendar actions, or production CRM mutations;
- no production promotion while `npm run test:launch-blockers` fails.

## Phase 0 — contain and establish authority (0–14 days)

### P0-A: close identity and cross-tenant authority paths

Owner: identity/security engineer
Reviewers: database owner and independent security reviewer

1. Replace the broad profiles `FOR ALL` operator policy with action-specific, tenant-scoped policies.
2. Remove `staff` from profile authority management.
3. Expose authority changes only through narrow server actions/RPCs that require the exact action permission, target tenant, fresh AAL2, reason, and audit.
4. Define tenant administrator separately from Avalon super-administrator.
5. Tenant-scope every service-role object query and mutation, beginning with communications, event manifest, and serve flows.
6. Add an automated inventory rule that rejects service-role table access lacking an explicit tenant/resource guard or approved global exception.

Evidence required:

- negative RLS tests for self, peer, staff, tenant admin, super-admin, inactive, null-tenant, and other-tenant cases;
- API tests for object IDs from another tenant;
- migration dry run against a scrubbed production-shape snapshot;
- stale-session/role-change test;
- independent review approval.

### P0-B: contain public and browser-resident RESTRICTED data

Owner: Clinical platform engineer
Reviewers: privacy owner and security reviewer

1. Disable member-message attachment uploads until a secure replacement is ready.
2. Make the `member-messages` bucket private and revoke anonymous access.
3. Inventory existing objects and public URLs; assess, delete/rotate, and document them.
4. Remove clinical/profile/booking values from local and session storage; purge legacy keys safely.
5. Replace client persistence with server-side minimum-necessary projections.
6. Add CI checks for forbidden RESTRICTED fields in browser storage and public buckets.

Evidence required:

- anonymous object-read test returns denial;
- authenticated same-resource download succeeds through a short-lived path; other-member and other-tenant reads fail;
- malware/DLP quarantine test before attachments are re-enabled;
- browser storage inspection after all Clinical/member flows shows no RESTRICTED records;
- inventory and exposure review for existing objects.

### P0-C: repair communications tenancy

Owner: communications platform engineer

1. Review collisions before changing the schema.
2. Backfill and make `tenant_id` non-null.
3. Replace `(channel, contact)` uniqueness with `(tenant_id, channel, normalized_contact)`.
4. Require tenant in all lookup, insert, append, mark-read, and reconciliation methods.
5. Prevent a global fallback in ordinary tenant operations.

Evidence required: collision report, reviewed migration/rollback, two-tenant integration tests, message reconciliation, and safe deployment plan.

Implementation status: review migration 057 adds tenant-scoped uniqueness,
tenant-required checks, and a composite message/thread tenant foreign key;
matching APIs require an explicit tenant and the Quo adapter requires
`QUO_TENANT_ID`. The P0 remains open because the migration is unapplied and
legacy null/collision rows require inventory, ownership reconciliation,
backfill, constraint validation, and live two-tenant testing.

### P0-D: make privileged identity production-safe

Owner: identity/security engineer

1. Rotate every shared or chat-posted credential immediately; never reproduce credential values in source, tickets, logs, or documentation.
2. Provision named production users.
3. Make server-side AAL2 a production invariant for privileged roles.
4. Use Supabase's supported authenticator-assurance API in the client; do not infer AAL from unsupported `User` fields.
5. Add fresh step-up for authority changes, exports, Finance actions, Clinical sensitive access, and agent-policy changes.
6. Verify identity-provider rate, CAPTCHA, breached-password, recovery, factor-enrollment, and session settings.
7. Pin deployment to the reviewed checkout and reject demo/review credentials in production artifacts.

Evidence required: enrollment/recovery/step-up/revoke tests, production configuration capture, named-user roster, forced-session-revocation test, and forbidden-demo-auth build test.

Implementation status: client assurance now uses Supabase
`mfa.getAuthenticatorAssuranceLevel()` and has an automated fail-closed contract.
The server review candidate also centralizes Admin/staff MFA and forced-password-
rotation denial across the standard role helpers and identified custom API role
checks. Password rotation clears only after the server confirms the Supabase
Auth password write. These are repository changes, not production evidence.
The P0 remains open until `VITE_MFA_ENFORCED=true` and `MFA_ENFORCED=true` are
activated together for named production operators and the manual evidence above
is captured. Direct Supabase Data API operator policies also remain outside this
API-layer control until database AAL2 enforcement is implemented and verified.
See `docs/AUTH_SETUP.md` for the lockout-safe rollout and rollback.

### P0-E: disable forgeable Clinical callbacks

Owner: integrations engineer
Reviewer: Clinical system owner

1. Keep production mutation disabled until a provider-supported native signature or reviewed raw-body HMAC design is available.
2. Add timestamp freshness, durable provider event-ID replay rejection, size/schema limits, and constant-time verification.
3. Bind the provider account and event to one tenant and expected appointment.
4. Use tenant-scoped conditional writes and record accepted and rejected events.
5. Reconcile with the Clinical source of record.

Evidence required: tamper, stale, replay, wrong-account, wrong-tenant, unknown-appointment, retry, and reconciliation tests.

Implementation status: the legacy callback is now synthetic-local-only and
production/preview/unknown environments fail closed. Profile cache mutation
also requires exactly one tenant-bound profile match and then writes by profile
ID. This is containment, not a replacement for signed, replay-safe provider
authentication and canonical appointment-to-person binding.

### P0-F: complete real-PHI launch contracts and release health

Owner: privacy/security program owner

1. Complete and evidence required BAAs/DPAs and approved configurations for the exact services receiving PHI.
2. Create a vendor registry with data classes, purpose, region, subprocessors, retention/deletion, incident obligations, owner, approval, and expiry.
3. Keep synthetic-only routing until evidence exists.
4. Resolve the current invoice no-PHI launch-blocker failure.
5. Require all release/security tests on the protected branch.

Evidence required: executed agreements or approved route-around decision, provider configuration captures, vendor approval, all required CI checks green, and launch-owner sign-off.

## Phase 1 — centralize policy and evidence (2–6 weeks)

### Authorization and data projections

- Introduce domain permissions for Finance, BD, Clinical, HR, Security/Privacy, and read-only audit.
- Implement a policy decision interface and shared API enforcement middleware.
- Replace generic `staff` access with action-specific permissions.
- Separate Clinical, payment, CRM, and operational projections currently co-located in appointment rows.
- Add reason-for-access and step-up to sensitive Clinical reads and exports.

### Audit and logging

- Make audit transactional/fail-closed for privileged and RESTRICTED actions.
- Add permitted/denied outcome, human/workload identity, role, session/device, assurance, access reason, approval/delegation, and correlation fields.
- Audit sensitive reads, denials, searches, exports, merges, agent actions, and security changes.
- Export to an immutable destination and alert on gaps.
- Centralize log redaction; remove patient exam IDs and raw provider/storage messages.

### Files, analytics, and egress

- Standardize all uploads on quarantine, magic-byte/parser checks, malware/DLP scanning, safe renditions, short links, lifecycle, and audit.
- Allowlist analytics event names and typed properties; disable analytics/pixels on Clinical surfaces.
- Remove durable browser analytics payload storage.
- Add an egress classification gateway for email, SMS, analytics, AI/model providers, and SaaS.
- Convert unapproved email/SMS notifications to opaque IDs and secure Admin links.

### Secure delivery

- Add SAST, dependency review, SBOM, license/policy checks, infrastructure/config scanning, and application security tests.
- Enforce protected-branch review and environment approval for production.
- Use workload/OIDC release identity where supported and record artifact provenance.
- Track vulnerabilities and risk exceptions with owners and expirations.

Phase 1 exit evidence: negative authorization suite, policy decision logs, audit failure test, file-malware test, analytics schema test, egress-denial test, SBOM, protected-branch evidence, and remediation retest.

## Phase 2 — keys, workloads, agents, and recovery (6–12 weeks)

### Data protection

- Implement managed KMS/envelope encryption for approved RESTRICTED fields and secrets.
- Create key/secret inventories, environment separation, rotation, dual-key migration, and emergency-revoke runbooks.
- Tokenize or pseudonymize identifiers in analytics, support, and integration paths.

### Agent execution plane

- Issue a unique identity to every agent, scheduler, worker, and integration.
- Remove direct service-role credentials from agents.
- Put all tools behind a policy enforcement gateway with tenant, classification, action, resource, spend, rate, time, and approval checks.
- Preserve exact-payload approvals and exercise global/per-agent kill switches.
- Add durable workflow, retries, dead-letter handling, replay, reconciliation, and operator-visible run history.

### Resilience and security operations

- Define data-service RPO/RTO and dependency tiers.
- Configure isolated/immutable backups and verified PITR.
- Run restore, credential-rotation, provider-outage, ransomware, account-takeover, PHI-disclosure, and agent-misbehavior exercises.
- Connect security events to monitoring/SIEM and documented on-call response.

Phase 2 exit evidence: KMS/key-rotation exercise, workload-identity inventory, agent escape tests, kill-switch drill, restore report against RPO/RTO, incident tabletop reports, and alert-response evidence.

## Phase 3 — governance and jurisdiction policy packs (3–6 months)

- Release the Security and Compliance Admin Center using the status model in the control registry.
- Automate control evidence collection without exposing secrets or PHI.
- Implement recurring access reviews, vendor reviews, key reviews, and risk-register governance.
- Enforce retention/deletion jobs, legal holds, privacy-request workflows, and backup deletion policy.
- Add region and jurisdiction policy packs only after local counsel/security review.
- Establish secure SDLC training, incident exercises, vendor-offboarding, and metrics reviewed by leadership.

Phase 3 exit evidence: a complete asset/vendor/control registry, two access-review cycles, retention/deletion evidence, an incident exercise, and leadership risk review.

## Phase 4 — independent assurance and limited activation

1. Commission an independent application/API/cloud penetration test and remediate findings.
2. Perform a HIPAA security risk analysis with the accountable organization and qualified advisors.
3. Run ISO 27001/27701 and relevant NIST/OWASP readiness assessments.
4. Run a synthetic end-to-end pilot.
5. Run a tiny allowlisted RobBot3K pilot to an Avalon-controlled address with daily caps and human approval.
6. Activate broader live behavior only after exit criteria, provider/legal review, and named human ownership.

No assessment result may be described as certification unless the relevant independent body has issued it.

## First implementation sequence

Use small, independently reviewable changes in this order:

1. `SEC-P0-PROFILES` — RLS/authority migration plus negative tests.
2. `SEC-P0-ATTACHMENTS` — disable upload, private-bucket migration, object inventory/rotation plan, secure retrieval tests.
3. `SEC-P0-TENANCY` — service-role tenant guards and communications collision-safe migration.
4. `SEC-P0-WEBHOOK` — disable current mutation then implement signed/replay-safe callback.
5. `SEC-P0-MFA` — production AAL2 invariant, supported client assurance, named users, step-up/revoke tests.
6. `SEC-P0-PHI-EGRESS` — support/email/SMS/log/analytics classification controls.
7. `SEC-P0-RELEASE` — resolve launch blocker, vendor evidence, and required protected checks.

Each change requires a rollback plan. Do not combine these migrations into a single unreviewable security rewrite.

## Risk acceptance

Only the accountable business owner may accept business risk; only the privacy/clinical owners may accept risk involving patient data; only the security owner may recommend a security exception. Exceptions must include scope, reason, affected data, compensating controls, evidence, expiration, owner, reviewer, and a committed remediation date. P0 cross-tenant, public-PHI, shared-admin, forged-clinical-state, or unaudited-agent risks are not eligible for silent acceptance.
