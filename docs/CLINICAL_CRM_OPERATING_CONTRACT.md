# Avalon Clinical CRM operating contract

## Product decision

Clinical is a separate CRM and permission domain from Avalon BD.

- **Avalon BD** stores companies, business contacts, opportunities, and public business-development activity. It must never receive patient identity, visit history, clinical status, or PHI.
- **Avalon Clinical CRM** is the patient relationship and communications control plane. It references canonical patient records, tracks communication authority, and records every patient-facing communication.
- **Acuity remains the chart and scheduling source of record.** Clinical CRM is not a replacement EHR and must not copy clinical notes simply to support audience selection.
- **Marketing access is not clinical access.** A marketing operator sees only the minimum identity, channel, authorization, suppression, and campaign-delivery fields needed for an approved communication.

This architecture is designed to support HIPAA and California compliance, but software alone cannot make Avalon “HIPAA compliant” or “California legal.” Covered-entity status, policies, risk analysis, workforce training, contracts, authorization language, and campaign classifications require qualified privacy counsel and responsible operational owners.

## Strict launch posture

Avalon will use the strictest safe default:

1. Being a patient never equals marketing permission.
2. Promotional outreach is blocked unless the recipient has a current, purpose-specific authorization and the selected channel is permitted.
3. Care communications and promotional marketing are separate message classes, templates, queues, approvals, and suppressions.
4. No audience may be selected by diagnosis, medication, screening answer, contraindication, genetic data, reproductive information, mental-health information, or other clinical fact for marketing without a specifically approved legal basis and campaign-level privacy review.
5. No vendor receives a patient list unless its exact service is approved for PHI, the necessary contract or BAA is executed, and the integration is on the Clinical allowlist.
6. Agents may draft or classify; they may not decide that consent exists, widen an audience, or send patient outreach.

## Communication lanes

| Lane | Purpose | Default authority | Automation |
| --- | --- | --- | --- |
| Care operations | Appointment confirmation, requested follow-up, pre/post-visit instructions, results availability, safety, or care coordination | Counsel-approved treatment/payment/operations policy plus channel preference | May queue only through an approved clinical provider; stop and opt-out rules still apply |
| Service relationship | Account, membership, credit, or service notices tied to an existing relationship | Counsel-classified transactional or relationship basis | May use approved templates; promotional content is prohibited |
| Avalon promotion | Offers or messages encouraging purchase or use of a service | Current purpose-specific patient authorization plus channel-specific permission | Human campaign and exact-content approval required |
| Third-party promotion | Any promotion involving another entity, remuneration, referral consideration, or data disclosure | Campaign-specific legal approval and authorization disclosing the relevant parties and remuneration | Disabled for V1 |

When classification is uncertain, the system must choose the more restrictive lane and block the send pending privacy review.

## Source-of-truth model

Clinical CRM should reuse canonical records rather than creating a second patient database:

- `people` and `person_roles` — patient identity and relationship.
- `appointments` and `visits` — operational references only; the marketing layer does not read clinical payloads.
- Acuity — chart, scheduling, and clinical intake source of record.
- `consent_documents` and `consent_signatures` — existing treatment/privacy documents; these do **not** automatically confer marketing authority.
- New Clinical CRM tables — communication authorizations, channel preferences, suppressions, audience snapshots, campaigns, exact-message approvals, messages, delivery events, and access audits.

## Required Clinical CRM records

### Communication authorization

An append-only record must include:

- patient, tenant, authorization class, purpose, allowed channels, and authorized sender;
- exact authorization document version and cryptographic body hash;
- specific information/use limitations and permitted recipients or functions;
- whether remuneration or a third party is involved;
- signature, signed timestamp, source, signer authority, IP/device evidence where permitted;
- effective date, expiration date/event, revocation timestamp, superseding record, and patient copy-delivery evidence;
- proof that the authorization was separate and presented in the required form.

Treatment consent, a privacy notice acknowledgment, a checkout checkbox, or a communication preference cannot be silently converted into marketing authorization.

### Channel preference and consent

Store email, SMS, voice, and mail independently. Each record includes status, scope, capture source, notice version, timestamp, evidence, expiration if applicable, and revocation. A broad “marketing” boolean is insufficient.

### Suppression

A suppression is global by default and overrides campaigns and prior approvals. Store recipient, channel, reason, source, captured time, actor/provider event, and any legally permitted re-consent. STOP, unsubscribe, complaint, hard bounce, wrong person, deceased, guardian restriction, manual hold, and privacy request are first-class reasons.

### Campaign and immutable audience snapshot

Each campaign stores owner, lane, purpose, legal-policy version, sender, channels, content version, scheduled window, frequency cap, exclusion policy, and approval state. Its audience is an immutable snapshot with one eligibility decision per person and no raw clinical selection criteria.

### Exact-message approval

Approval binds the campaign, recipient snapshot, sender, channel, subject, rendered body, links, attachments, scheduled window, and policy version. Any change invalidates approval. Approval is consumed transactionally when a provider job is created.

### Delivery and response history

Log queued, sent, delivered, failed, bounced, complained, unsubscribed, replied, booked, and reconciled events. Provider webhooks must be signed, replay-safe, idempotent, and reconciled against provider history.

## Eligibility decision

The server is the only authority that can return `eligible`. For each recipient and channel it must verify, in one transaction:

1. active tenant and patient relationship;
2. campaign lane and current counsel-approved policy version;
3. required authorization and channel permission are present, current, unrevoked, and purpose-compatible;
4. no global, channel, recipient, guardian, provider, or legal-hold suppression applies;
5. contact point is verified and belongs to the intended recipient;
6. content and audience snapshot still match the approved hashes;
7. vendor, BAA/contract, sending identity, webhook health, and environment are approved;
8. frequency, quiet-hour, age/guardian, geography, and campaign caps pass;
9. a human approval is current and unconsumed; and
10. the global Clinical outreach kill switch is off.

The response should reveal only `eligible`, blocking reason codes, and the minimum fields needed to render the approved message. It must not expose diagnoses or clinical notes to campaign tooling.

## Admin product

Clinical CRM should live under `/admin/clinical` with these pages:

1. **Patients** — canonical identity, relationship status, last operational contact, and privacy-safe summary.
2. **Patient record** — contact details, communication authority, preferences, suppressions, authorized representatives, activity, requests, and linked Acuity record. Clinical details open in the chart system.
3. **Authorizations** — document versions, signatures, expirations, revocations, patient copies, and exceptions queue.
4. **Audiences** — privacy-safe criteria, projected eligible count, exclusions, and a required privacy review before materialization.
5. **Campaigns** — care, relationship, or promotion classification; content; exact audience snapshot; approvals; schedule; and caps.
6. **Approvals** — exact rendered messages, recipient counts, legal policy, sender, risk flags, expiry, and approve/reject/edit controls.
7. **Inbox and activity** — replies, opt-outs, complaints, wrong-person reports, bookings, and human assignments.
8. **Compliance** — vendor/BAA registry, access log, consent and suppression exports, webhook health, incidents, and kill switch.

The existing `/admin/clients` page is only a bookings-derived patient roll-up. It must not be presented as the completed Clinical CRM.

## Security and operational controls

- Separate Clinical roles for privacy officer, clinical authority, campaign operator, and read-only auditor.
- MFA, short sessions, device/session revocation, tenant isolation, minimum-necessary field projections, and reason-for-access capture.
- Encryption in transit and at rest, managed secrets, backups, disaster recovery, and tested restore procedures.
- Immutable audit history for reads, exports, authorizations, revocations, audience creation, approvals, messages, and administrative changes.
- Automatic change/delete history for electronically stored medical information.
- No PHI in analytics, logs, URLs, email subjects, push notifications, external error reporting, or unsupported vendor metadata.
- No advertising pixels, session replay, generic product analytics, or non-approved AI/model provider on Clinical pages, APIs, messages, or exports.
- BAAs and downstream subcontractor controls for every vendor that creates, receives, maintains, or transmits ePHI.
- Security risk analysis, workforce training, sanctions, incident response, breach assessment/notification, retention, access, amendment, accounting, and deletion workflows.

## Current Avalon boundaries

- HubSpot is an explicitly non-PHI hospitality CRM and cannot become Clinical CRM.
- Resend operations email, current customer email, and Quo SMS are deliberately PHI-limited or PHI-free; they are not approved patient-marketing transports.
- Cognito Forms, Acuity, Supabase, Vercel, and any new communications provider require their documented production agreements and safeguards before real PHI use.
- Existing `profiles.comm_prefs.marketing` is an unversioned JSON preference, not sufficient authorization evidence.
- Existing treatment/privacy consent documents are not marketing authorization records.

## Current code blockers

The following issues must be corrected before the existing Admin patient surface can become Clinical CRM:

- `/admin/clients` derives people from bookings and groups by email, phone, or name instead of using canonical `people.id`. That can merge a guardian, booker, payer, and patient or split one patient into duplicates.
- `profiles.phi` is an unversioned mutable JSON object. Patient-reported history, clinician-authored information, encounter facts, and addenda must be separate typed records with provenance.
- Clinical fields are currently mirrored into browser storage, and the existing redactor does not cover every clinical key. Real PHI must be removed from local storage and legacy keys must be purged.
- The patient-detail editor mixes patient data with account role/status administration. Clinical editing cannot be a path to staff/admin privilege changes.
- `profiles.comm_prefs.marketing` is a mutable preference with none of the evidence required for a marketing authorization.
- Current email/SMS send paths do not share a server-side eligibility decision. Inbound STOP and provider unsubscribe events do not yet create one global Clinical suppression.
- Current communications thread lookup and uniqueness are not consistently tenant-scoped. This is a release-blocking isolation defect.
- Audit writes can fail without failing the underlying operation, and privileged PHI reads are not consistently recorded. Privileged access and disclosure auditing must fail closed where required.
- Existing document signatures are not proven to bind an immutable rendered authorization snapshot into the signature hash.
- Current account “anonymization” does not cover the complete clinical, appointment, communication, external-vendor, and audit footprint.
- Public privacy language and the actual BAA/vendor boundary are not fully aligned.

## Staged release

### Phase 0 — legal and data map

- Determine Avalon's HIPAA covered-entity/business-associate posture and CMIA/CCPA applicability with counsel.
- Approve the care, relationship, own-service promotion, and third-party-promotion classifications.
- Approve authorization language, retention, minors/guardians, geographic rules, and vendor list.
- Complete the risk analysis and BAA/contract register.

### Phase 1 — read-only Clinical CRM

- Canonical patient directory and detail view.
- Role-based minimum-necessary access.
- Communication timeline, access auditing, and explicit source-of-truth links.
- No campaign creation or sending.

### Phase 2 — authority and suppression

- Versioned authorization documents and signatures.
- Channel preferences, revocation, global suppression, patient copy delivery, and privacy requests.
- Eligibility engine in shadow mode with synthetic data and legal test fixtures.

### Phase 3 — human-gated internal pilot

- One counsel-approved message class and one BAA-covered channel.
- Internal/test recipients, exact-payload approval, signed webhook events, reconciliation, daily caps, and kill switch.
- Red-team privacy, cross-tenant, opt-out, wrong-person, retry, and outage scenarios.

### Phase 4 — limited patient pilot

- Small allowlisted cohort whose authorization evidence has been manually verified.
- Human review of every audience and message.
- Daily review of opt-outs, complaints, wrong-person reports, delivery, and incidents.

No autonomous patient marketing agent is permitted until the limited pilot demonstrates reliable consent enforcement, suppression, auditability, and recovery.

## Reference authorities

- [HHS HIPAA marketing guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/marketing/index.html)
- [45 CFR 164.508 — authorizations](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.508)
- [HHS HIPAA Security Rule summary](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
- [California Civil Code 56.10 — medical information disclosure and marketing](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=56.10.)
- [California Civil Code 56.11 — authorization requirements](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=56.11.)
- [California Civil Code 56.101 — confidentiality and electronic change history](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=56.101.)
- [California Attorney General CCPA overview](https://oag.ca.gov/privacy/ccpa)
- [47 CFR 64.1200 — calls, texts, consent, and revocation](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200)
- [FTC CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
