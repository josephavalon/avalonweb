# Avalon Security Threat Model

Status: current-state model and target-control requirements
Model date: 2026-08-30
Audited source: `02f4d899fe3b38ffa41326101c11e455c53658ae`

## Scope and method

This model covers public web surfaces, Admin, Finance, BD, Clinical, member/provider portals, Supabase, serverless APIs, object storage, scheduled jobs, provider integrations, analytics, CI/CD, and future agents. It evaluates repository evidence; it is not a production penetration test, legal assessment, or certification.

Risk is qualitative:

- Likelihood: Low, Medium, High.
- Impact: Moderate, High, Critical.
- Residual risk is the expected risk after the listed target controls are implemented and verified.

## Protected assets

- patient identity, clinical intake, visit, GFE, communication, and consent records;
- member, provider, workforce, and business-contact PII;
- invoices, receipts, payouts, payment references, and financial operations;
- authentication material, sessions, keys, secrets, signing material, and recovery channels;
- role, tenant, approval, suppression, agent-policy, and kill-switch authority;
- audit, backup, incident, legal-hold, and compliance evidence;
- Avalon availability, reputation, deliverability, and business continuity.

## Adversaries and failure sources

- external attackers using stolen credentials, application flaws, malware, or supply-chain compromise;
- malicious or over-privileged insiders;
- a compromised nurse, member, admin, developer, or vendor device;
- a compromised integration, model provider, webhook sender, CI identity, or cloud account;
- a prompt-injected, defective, or rogue agent;
- accidental disclosure, policy drift, configuration error, or operational shortcut;
- ransomware, region failure, destructive error, or unavailable security dependency.

## Material threats

| ID | Threat and attack path | Asset | Likelihood | Impact | Preventive controls | Detective controls | Recovery controls | Target residual risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | Stolen/shared privileged credential signs into Admin at AAL1 | All domains and authority | High | Critical | Named accounts, passkey/SSO, required AAL2, risk-aware sessions, step-up, no shared credentials | auth anomaly alerts, new-device and role-use alerts, session inventory | global revoke, credential/key rotation, access review, incident runbook | Medium |
| T-02 | Authenticated staff directly updates `profiles.role`, `status`, or `tenant_id` through broad RLS policy | Identity and tenant authority | High | Critical | tenant-scoped action policies, narrow audited RPCs, immutable authority rules, separate super-admin | authority-change audit, direct Data API anomaly, negative RLS tests | revoke sessions, restore authority state, investigate affected access | Low |
| T-03 | Staff passes another tenant's UUID/slug to a service-role endpoint that omits tenant scope | Communications, event/GFE, customer records | High | Critical | tenant/object authorization in API and DB, composite tenant keys, scoped RPCs, resource relationship checks | cross-tenant denial/audit, canary tests, access anomaly detection | revoke access, notify owners, reconstruct access from immutable logs | Low |
| T-04 | XSS or malicious dependency steals browser-available Supabase bearer tokens | Sessions and every reachable record | Medium | Critical | strict CSP without `unsafe-eval`, Trusted Types where feasible, dependency controls, minimum token scope, BFF/HttpOnly design for privileged paths | CSP reporting, client integrity telemetry, token-use anomaly | revoke sessions, roll affected assets, incident response | Medium |
| T-05 | Forged/replayed Qualiphy callback marks a GFE approved or updates the wrong profile | Clinical authorization and patient record | High | Critical | native signature/HMAC raw body, timestamp, replay store, provider-account/tenant binding, conditional writes | accepted/rejected webhook audit, replay alerts, reconciliation | disable integration, restore source-of-record state, rotate secret, replay trusted history | Low |
| T-06 | Public member-message URL exposes an attachment; malicious file is rendered by a member/operator | PHI/PII, endpoint integrity | High | Critical | private quarantine, scanning/DLP, safe rendition, short signed URL, tenant/path authorization | public-bucket configuration check, object-access audit, malware alerts | revoke URLs, quarantine/delete objects, notify/assess exposure | Low |
| T-07 | Clinical data persists in local/session storage on a shared, stolen, or malware-infected device | PHI and patient identity | High | High | no browser persistence for RESTRICTED data, minimum server projections, managed-device controls for workforce, inactivity lock | storage regression test, device/session telemetry | purge keys, remote revoke, lost-device incident process | Low |
| T-08 | A nullable/global communications key joins two tenants' messages | Patient/member communications | Medium | Critical | non-null tenant, composite uniqueness, tenant-filtered service writes, migration collision review | integrity query, tenant collision alert, reconciliation | split/rebuild threads, assess disclosure, notify owners | Low |
| T-09 | Compromised serverless function or shared service-role key bypasses RLS across the database | All database records | Medium | Critical | workload identities, narrow DB roles/RPCs, segmented projects/schemas, short-lived credentials, egress controls | service-account anomaly, query/access monitoring, secret-use inventory | revoke/rotate, isolate function, restore and investigate | Medium |
| T-10 | PHI/PII leaks through free-form support, logs, analytics, error telemetry, email, SMS, AI, or SaaS | PHI/PII and privacy rights | High | Critical | data classification gateway, allowlisted schemas, Clinical analytics off, redaction, DLP, approved-vendor policy, minimum messages | canary values, DLP alerts, log/schema scans, vendor reconciliation | stop egress, delete where possible, rotate identifiers/secrets, incident assessment | Medium |
| T-11 | Insider searches or exports records unrelated to their task | PHI, Finance, workforce data | Medium | Critical | domain roles, purpose/reason, relationship-based access, step-up, caps, just-in-time elevation | sensitive-read and export audit, peer anomaly, access review | suspend access, revoke exports, investigation and notification process | Medium |
| T-12 | Prompt injection or model output causes an agent to exfiltrate data or invoke a harmful tool | CRM, communications, calendar, Clinical if mis-scoped | High | Critical | isolated agent identity, tool gateway/PDP, classification ceiling, structured tool args, exact approval, no direct DB, model/vendor allowlist | tool-call audit, policy denials, rate/spend/data-volume alerts | kill switch, credential revoke, reconcile actions, roll back reversible mutations | Low for RobBot3K; Medium for future Clinical agents |
| T-13 | Supply-chain, CI, maintainer, or deployment compromise inserts malicious code or exposes secrets | Code, artifacts, cloud environments | Medium | Critical | branch protection, independent review, OIDC, environment approval, pinned actions, SAST, SBOM, dependency review, provenance | secret/SAST/dependency alerts, artifact verification, deployment audit | block/rollback release, revoke identities, rebuild from trusted source | Medium |
| T-14 | Database theft, ransomware, destructive migration, or region outage removes confidentiality or availability | Production data and service continuity | Medium | Critical | encryption/KMS, least privilege, isolated immutable backups, migration review, regional recovery design | database/security monitoring, backup job alert, destructive-query alert | proven PITR/restore, key rotation, failover and incident runbooks | Medium |
| T-15 | Lost or compromised nurse/admin device keeps a long-lived session or offline PHI | PHI and privileged sessions | High | High | server idle/absolute timeouts, device inventory, remote revoke, minimal offline data, encrypted managed device | device/session alerts, inactivity and posture signals | remote revoke/wipe, access review, incident assessment | Medium |
| T-16 | Rate-limiter outage or cold starts allow credential stuffing, scraping, spam, or expensive API abuse | Identity, availability, deliverability, spend | High | High | persistent distributed limits, fail-closed high-risk paths, provider limits, bot/WAF controls, budgets | rate/backend health, auth failures, cost and queue alerts | temporary blocks, secret rotation, provider reconciliation | Low |
| T-17 | Shared or weak nurse-invoice door is treated as provider identity and used for fraudulent payout | Finance and workforce identity | Medium | High | individual provider identity, AAL2 where warranted, reviewed roster linkage, quarantined receipts, dual approval | duplicate/anomaly detection, payout reconciliation, identity-review audit | hold/reverse payout, suspend account, investigate | Low |
| T-18 | Wrong checkout or synthetic review credentials reach a production build | Admin and all connected data | Medium | Critical | release source pinning, production compile/runtime kills, forbidden-fixture scan, separate accounts/projects | artifact provenance, hosted verification, environment drift alert | rollback, revoke sessions/secrets, incident investigation | Low |
| T-19 | Audit insertion fails open, so a sensitive mutation succeeds without evidence | Audit integrity and non-repudiation | High | High | transactional/fail-closed audit for privileged/RESTRICTED actions, isolated append service | missing-sequence/reconciliation alert, audit-pipeline health SLO | halt sensitive writes, reconstruct from provider/DB evidence, incident review | Low |
| T-20 | Vendor contract/configuration drifts and PHI reaches a non-approved service or region | PHI/PII and regulatory obligations | Medium | Critical | vendor registry as policy input, BAA/DPA/region/data-class gate, egress deny-by-default | config evidence expiry, egress inventory, subprocessor change alerts | stop connector, deletion request, containment and notification assessment | Low |

## Priority abuse cases

### A. Staff-to-admin escalation

1. Attacker obtains any active `staff` session.
2. Attacker calls the Supabase Data API directly rather than using the UI.
3. The profiles `FOR ALL` policy permits the write because `staff` is an operator.
4. The trigger permits authority changes for operators.
5. The attacker sets an administrative role or changes tenant/profile authority.

Required proof of closure: database integration tests demonstrate that staff cannot read another tenant's profile, cannot modify any authority field, cannot elevate self, and cannot use a stale session after an administrator changes their role.

### B. Cross-tenant service-role object access

1. A legitimate operator obtains or guesses an object UUID or event slug from another tenant.
2. The route verifies only that the caller is staff.
3. The server's service-role client bypasses RLS.
4. The query looks up the global object without the caller's tenant.

Required proof of closure: every service-role repository method takes a non-null tenant and action; negative API tests for tenant A against tenant B return the same safe not-found response and create a denial event.

### C. Clinical webhook forgery/replay

1. A static URL secret leaks through configuration, logs, support, or a vendor account.
2. The attacker submits or replays an approval body.
3. The server trusts the body, searches globally, and writes clinical/profile state.

Required proof of closure: modified body, expired timestamp, duplicate event ID, wrong provider account, wrong tenant, and unknown appointment are all rejected and audited; reconciliation agrees with the clinical source of record.

### D. Attachment disclosure

1. A member uploads an image that may contain health information.
2. The app stores it in a public bucket and saves a public URL.
3. The URL leaks through a message, browser history, log, screenshot, referrer, or compromised device.
4. Anyone with the URL retrieves the object without authorization.

Required proof of closure: storage configuration denies anonymous reads; existing objects and persisted URLs are inventoried; every download requires current tenant/resource authorization and uses a short-lived URL; malware/DLP scanning is verified.

### E. Rogue or prompt-injected agent

1. Untrusted web content instructs an agent to reveal data or use a tool outside the task.
2. A model emits an apparently valid tool call.
3. Without an external policy gateway, the agent's credential can perform the action.

Required proof of closure: the tool gateway denies actions outside the identity's tenant, classification ceiling, approved resources, budget, and current exact approval; the model cannot modify the policy or approval record; the kill switch is exercised.

## Review triggers

Re-run this model when Avalon adds a country, Clinical workflow, new data class, new identity provider, new payment or communications provider, new agent/tool, new storage system, mobile/offline capability, major tenant model change, acquisition integration, or material security incident. Review at least annually even without a trigger.
