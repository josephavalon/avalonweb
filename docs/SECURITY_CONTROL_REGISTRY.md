# Avalon Security Control Registry

Status: initial evidence registry
Registry date: 2026-08-30
Audited source: `02f4d899fe3b38ffa41326101c11e455c53658ae`

## Status model

- `NOT_IMPLEMENTED` — the required control is absent.
- `IMPLEMENTED_UNVERIFIED` — code or documentation exists, but runtime/configuration/effectiveness evidence is missing.
- `VERIFIED` — current environment evidence and a reproducible effectiveness test exist.
- `FAILED` — the current control or its required test fails.
- `EXCEPTION` — a named owner accepted a time-bounded exception with compensating controls.

No code-only control is marked `VERIFIED` by this audit.

## Initial controls

| Control | Requirement | Current status | Repository evidence | Required evidence to reach `VERIFIED` | Owner |
| --- | --- | --- | --- | --- | --- |
| GOV-001 | Security, privacy, clinical, data, vendor, and incident owners are named | NOT_IMPLEMENTED | Operating contracts name responsibilities but not a durable owner registry | approved RACI, on-call/escalation contacts, annual review | Executive owner |
| DAT-001 | Every data asset uses PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED with purpose and retention | NOT_IMPLEMENTED | Existing `data_assets` classes do not match the target model: `supabase/migrations/003_healthcare_os_core.sql:583-633` | complete inventory, classification review, automated coverage check | Data/privacy owner |
| DAT-002 | Clinical, BD, Finance, HR, Audit, Analytics, and agent memory are separate authorization domains | FAILED | generic `staff` access and co-located appointment data: `012_admin_team_management.sql:31-57`; `003_healthcare_os_core.sql:211-226` | domain permission matrix and cross-domain negative tests | Platform owner |
| IAM-001 | Every production operator has a named account; shared accounts are forbidden | IMPLEMENTED_UNVERIFIED | real Supabase path exists; demo/review paths remain for isolated use | production user roster, shared credential rotation, artifact test | Identity owner |
| IAM-002 | Privileged sessions require AAL2 | FAILED | supported client/server checks and a paired production verifier exist, but enforcement remains off by default and direct RLS access is not yet AAL-bound: `api/_lib/supabase-auth.js`; `src/lib/mfaAssurance.js`; `scripts/verify-prod.mjs` | database/RLS enforcement, production activation, AAL1/AAL2, recovery and revoke evidence | Identity owner |
| IAM-003 | Authority changes are action-specific, tenant-scoped, step-up protected, and audited | FAILED | review migration 055 removes direct authenticated profile mutation and the browser-callable password-rotation flag-clear RPC, but it is unapplied and broader action permissions/step-up/audit remain open | staging apply, RLS/RPC negative suite, step-up and audit evidence | Identity owner |
| IAM-004 | Sessions have server idle/absolute limits, device inventory, and remote/global revoke | NOT_IMPLEMENTED | browser idle timer and best-effort logout only: `src/lib/useAuthStore.js:16-36`, `684-694` | session policy/config, device UI, remote/global revoke drill | Identity owner |
| API-001 | Every service-role access is tenant and resource scoped | FAILED | identified communications/event paths are scoped and statically guarded; complete inventory and live two-tenant test remain open | static inventory plus two-tenant API integration suite | API owner |
| API-002 | High-risk routes have persistent, fail-closed rate limits | IMPLEMENTED_UNVERIFIED | shared limiter supports KV and fail-closed but defaults to memory/fail-open: `api/_lib/rate-limit.js:21-108` | production KV evidence, outage and threshold tests, route coverage report | Platform owner |
| WEB-001 | Webhooks use native signatures/HMAC, freshness, replay protection, tenant binding, and audit | FAILED | Qualiphy static secret with global mutation: `api/webhooks/qualiphy-inbound.js:23-97` | tamper/replay/tenant/reconciliation suite | Integration owner |
| STO-001 | Sensitive files use private quarantine, scan/DLP, safe rendition, short access, and lifecycle | FAILED | member bucket public: `026_member_message_attachments.sql:10-21`; team URL lasts one year: `api/admin/team-messages/upload.js:20-25`, `88-96` | anonymous denial, scanner, short-link, lifecycle and access tests | Storage owner |
| STO-002 | Nurse receipt intake is private, checksummed, quarantined, and short-lived after clearance | IMPLEMENTED_UNVERIFIED | `047_finance_nurse_invoices.sql:100-120`, `173-193`; `api/_lib/nurse-invoice-store.js:156-180` | staging malware/clear/reject/access/expiry tests and storage config capture | Finance owner |
| CRY-001 | Managed encryption at rest/in transit is evidenced for data, files, backups, queues, and logs | NOT_IMPLEMENTED | provider behavior is referenced but no consolidated evidence registry exists | provider controls, TLS scan, architecture review, backup encryption test | Security owner |
| CRY-002 | Field/envelope encryption and key lifecycle protect selected RESTRICTED data | NOT_IMPLEMENTED | no repository KMS/envelope/field-encryption implementation found | data-field decision, KMS policy, rotation and recovery exercise | Security owner |
| SEC-001 | Secrets are server-only, inventoried, rotated, and separated by environment | IMPLEMENTED_UNVERIFIED | CI scans verified secrets and browser artifact prefixes; runtime inventory not verified | secret inventory, environment separation, rotation evidence, incident drill | Security owner |
| AUD-001 | Audit rows are append-only | IMPLEMENTED_UNVERIFIED | immutable trigger: `003_healthcare_os_core.sql:790-819` | applied-migration evidence, mutation-denial test, isolated backup/export | Security/audit owner |
| AUD-002 | Privileged/RESTRICTED operations fail closed if audit cannot be recorded | FAILED | writer catches the failure and returns: `api/_lib/audit-events.js:14-42` | transactional failure test and audit-pipeline SLO | Security/audit owner |
| AUD-003 | Sensitive reads, denials, exports, agent actions, and security changes are attributable | NOT_IMPLEMENTED | current schema lacks full session, assurance, reason, approval, workload, and outcome context | schema/control implementation and representative event tests | Security/audit owner |
| LOG-001 | Logs, analytics, support, email, SMS, and AI egress are schema-classified and PHI safe | FAILED | the identified Qualiphy identifier log is removed, but free-form outbound/support and analytics paths still lack complete allowlisted schemas and evidence | allowlisted schemas, DLP tests, Clinical telemetry-off test, log scans | Privacy/security owner |
| AGT-001 | Every agent/worker/integration has a unique short-lived identity and bounded tools | NOT_IMPLEMENTED | cron uses shared secret/service role and null actor: `api/cron/robbot3k-refresh.js:8-36`; `robbot3k-outreach.js:8-32` | service-principal inventory, token scopes, tool-gateway denial tests | Agent platform owner |
| AGT-002 | RobBot3K consequential actions require exact human approval and stop conditions | IMPLEMENTED_UNVERIFIED | provider intentionally unconfigured and payload/sender controls exist: `api/_lib/robbot3k-execution.js:10-29`, `46-108` | synthetic end-to-end test, approval invalidation, stop/reconcile/kill drills | BD owner |
| VEN-001 | Vendors are approved by purpose, class, contract, region, retention, and incident terms | NOT_IMPLEMENTED | narrative data-flow map exists: `docs/PHI_DATA_FLOW.md:5-18`; agreements remain pending | approved vendor registry and current BAA/DPA/config evidence | Privacy/vendor owner |
| BCP-001 | Backups/PITR are isolated, encrypted, monitored, and restorable to RPO/RTO | NOT_IMPLEMENTED | no repository effectiveness evidence found | provider config, successful restore report, RPO/RTO measurement | Resilience owner |
| IR-001 | Incident runbooks and exercises cover healthcare, identity, vendor, ransomware, and agents | NOT_IMPLEMENTED | readiness checklist requests runbooks: `docs/ADMIN_READINESS_BEFORE_AGENTS.md:73-82` | approved runbooks, on-call test, tabletop reports and improvements | Incident commander |
| SDL-001 | CI scans secrets and high-risk dependencies and runs authorization/environment contracts | IMPLEMENTED_UNVERIFIED | `.github/workflows/ci.yml:9-77` | protected required checks and representative failure evidence | Engineering owner |
| SDL-002 | CI includes SAST, dependency review, SBOM, IaC/config, DAST/app-security, and provenance | NOT_IMPLEMENTED | not present in the reviewed CI workflow | green required jobs, retained SBOM/provenance, triage workflow | Engineering/security owner |
| REL-001 | Production is promoted only from a reviewed artifact with rollback and post-deploy verification | IMPLEMENTED_UNVERIFIED | written launch constraints and feature-branch process | protected environment evidence, signed approval, rollback exercise, hosted verification | Release owner |
| REL-002 | All release blockers pass before promotion | IMPLEMENTED_UNVERIFIED | local built review candidate passes `npm run test:launch-blockers` | full required suite green on protected CI and the exact hosted artifact | Release owner |

## Evidence record requirements

Every evidence object must include:

- control ID, environment, system, and scope;
- collection method and immutable location;
- collected time, effective period, expiry, and next test;
- implementation owner and independent reviewer;
- test input, expected result, actual result, and artifact hash;
- exceptions, compensating controls, residual risk, and approval;
- links to incident, vulnerability, vendor, backup, or change records when relevant.

Screenshots alone do not prove a control unless the source, environment, time, reviewer, and effectiveness test are also captured.

## Framework traceability

The eventual machine-readable registry should map each Avalon control to relevant requirements in the current HIPAA Security Rule, NIST CSF 2.0, NIST SP 800-53, NIST SP 800-207, ISO/IEC 27001, ISO/IEC 27701, GDPR security/privacy-by-design principles, OWASP ASVS, and PCI DSS scope where applicable. A mapping records intent and evidence coverage; it does not claim legal compliance or certification.
