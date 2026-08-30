# Avalon Admin definition of ready before agents

The platform-wide security design, current threat model, phased remediation, and evidence status are maintained in:

- `SECURITY_PLATFORM_ARCHITECTURE.md`
- `SECURITY_THREAT_MODEL.md`
- `SECURITY_REMEDIATION_PLAN.md`
- `SECURITY_CONTROL_REGISTRY.md`
- `SECURITY_PHASE_0_IMPLEMENTATION.md`

Those documents are release inputs for every Admin domain and agent. This checklist does not override a security P0 or missing runtime/contract evidence.

## Decision

Do not activate autonomous agents until the P0 gates below are complete and verified. RobBot3K can remain available in research and dry-run mode while the Admin control plane is finished.

Avalon does **not** need to build every future Admin module first. The safe sequence is:

1. Finish the shared Admin control plane.
2. Finish the human-operated Finance and BD workflows.
3. Hide every unfinished or mock module from launch navigation.
4. Activate one narrowly scoped, human-gated RobBot3K workflow.
5. Add agents only after the first workflow is observable, reversible, and reliable.

## Launch scope

The Admin control plane has three separate work areas. Finance and BD are the first launch scope; Clinical becomes its own privacy domain and follows the staged release in `CLINICAL_CRM_OPERATING_CONTRACT.md`:

- **FINANCE** — nurse invoices, identity review, approval, receipt safety, payment references, reconciliation, and an immutable audit trail.
- **BD** — CRM records, opportunities, activities, tasks, documents, approval queue, RobBot3K research, outreach review, suppression, replies, meetings, and reconciliation.
- **CLINICAL** — canonical patient relationships, communication authority, preferences, suppressions, patient communications, and compliance evidence. It is separate from BD and does not replace the chart.

Clinical, field, credentials, kits, training, event operations, generic Avalon OS capability pages, and the automated shift marketplace are later products. They should be hidden or clearly labeled preview until their real data and actions exist.

## P0 — required before the first live agent

### 1. Truthful Admin surface

- [ ] Make FINANCE and BD the primary launch navigation.
- [ ] Keep Clinical CRM separate from Avalon BD and prevent patient or PHI data from entering business-development records or tools.
- [ ] Inventory every Admin route and label it live, preview, staged, or hidden.
- [ ] Remove generic capability placeholders and mock control towers from launch navigation.
- [ ] Fix route, navigation, and access mismatches, including Inbox, Team Inbox, and event-serving roles.
- [ ] Never mix sample CRM records into a live outage. Show an explicit unavailable state and recovery action.
- [ ] Provide consistent loading, empty, error, offline, and permission-denied states.
- [ ] Visually verify every live route at desktop and mobile widths, including keyboard focus and reduced-transparency mode.
- [ ] Meet minimum accessibility targets for contrast, labels, focus order, touch targets, and screen-reader status messages.

### 2. Identity, access, and security

- [ ] Provision named Supabase users for each operator; do not use a shared production account.
- [ ] Rotate any password previously posted in chat before production use.
- [ ] Require MFA at AAL2 for production Admin access.
- [ ] Verify role and tenant boundaries for every route and server action.
- [ ] Move login throttling to a persistent server-side store and test lockout behavior.
- [ ] Add session timeout, recovery, access revocation, and a documented break-glass process.
- [ ] Record immutable audit events for login, approvals, data changes, exports, merges, and agent actions.
- [ ] Define retention, export, deletion, and sensitive-data handling policies.

### 3. Data foundations and systems of record

- [ ] Apply migrations 046, 047, and 048 in non-production, run verification, then apply them in production with backups and rollback steps.
- [ ] Declare the system of record for identity, bookings, clinical records, Finance, CRM, files, email, calendar, and call recordings.
- [ ] Make business mutations, audit writes, and approval consumption one transactional server operation.
- [ ] Require idempotency keys for every retryable mutation and external side effect.
- [ ] Finish duplicate detection, merge review, undo/recovery, and reconciliation.
- [ ] Connect private file storage, signed access, malware/DLP scanning, and retention rules before releasing invoice receipts or CRM documents.
- [ ] Store server-readable notification preferences; browser-only preferences are not sufficient for workers.
- [ ] Remove or isolate legacy browser-direct mutations that can bypass the Admin service layer.

### 4. Complete human workflows

- [ ] A human can create, edit, assign, search, archive, restore, merge, and reconcile CRM records.
- [ ] Build the missing Lists UI and merge-review UI.
- [ ] A human can record call notes, requirements, budget, decision makers, objections, next steps, deal probability, and follow-up date.
- [ ] A human can review an opportunity update before it changes the CRM.
- [ ] Build one generic approval inbox showing exact proposed payload, evidence, scope, expiry, risk, and destination.
- [ ] Support approve, reject, edit-and-approve, revoke, bulk reject, and approval invalidation when payloads change.
- [ ] A human can review nurse identity, approve or reject an invoice, inspect cleared receipts, record an external payment reference, and reconcile the result.
- [ ] Add assignments, due dates, reminders, and notification delivery for human queues.
- [ ] Show integration health and the last successful sync in the Admin UI.

### 5. Durable operations

- [ ] Run scheduled and long-running work through a durable queue or workflow engine, not a browser session.
- [ ] Add bounded retries, backoff, idempotency, dead-letter handling, replay, and reconciliation.
- [ ] Verify webhook signatures, prevent replay, and retain delivery evidence.
- [ ] Add structured logs, metrics, alerts, run histories, cost budgets, rate budgets, and operator-visible failure reasons.
- [ ] Provide global and per-agent kill switches that stop new work without corrupting in-flight records.
- [ ] Create staging fixtures and end-to-end tests for login, roles, Finance, CRM, approval invalidation, suppression, reply handling, meeting creation, and reconciliation.
- [ ] Add the Finance, Avalon BD, and RobBot3K verification suites to release CI.
- [ ] Maintain rollback, incident, provider-outage, credential-rotation, and data-recovery runbooks.

### 6. RobBot3K launch integrations

- [ ] Use a dedicated Google Workspace mailbox connected with OAuth or delegated access. Never share its password with the bot.
- [ ] Configure and verify the sending domain, SPF, DKIM, DMARC, sender identity, reply-to address, and required postal address.
- [ ] Complete legal, privacy, consent, anti-spam, and provider-acceptable-use review for the intended outreach categories and regions.
- [ ] Select an outreach provider that permits the approved use case. Keep the live adapter disabled until that review is complete.
- [ ] Implement signed native webhooks for delivery, bounce, complaint, unsubscribe, reply, and Calendly booking events.
- [ ] Maintain global and account-level suppressions, opt-outs, bounce suppression, do-not-contact reasons, and a monitored reply inbox.
- [ ] Resolve each prospect to a stable company and person record before approval or send.
- [ ] Require an exact, expiring approval for the final recipient, sender, subject, body, attachments, and follow-up schedule.
- [ ] Invalidate approval after any payload change. Never approve a template and silently send a different rendered message.
- [ ] Stop follow-ups immediately on reply, unsubscribe, complaint, hard bounce, meeting booking, manual pause, or kill switch.
- [ ] Test the complete flow first with an internal address, then a tiny allowlisted cohort with daily caps.

## P1 — required before adding a second agent

- [ ] Demonstrate reliable RobBot3K dry runs and a limited live pilot with no unapproved sends.
- [ ] Measure research acceptance, approval rate, send success, positive replies, opt-outs, complaints, meetings, operator time, and cost per qualified call.
- [ ] Review false positives and missed stops weekly.
- [ ] Add organization-wide account deduplication and contact ownership.
- [ ] Add transcript ingestion and summarization only after recording consent, storage, access, and retention are complete.
- [ ] Add external CRM sync only after conflict resolution and source-of-truth rules are explicit.
- [ ] Require a written operating contract, permissions matrix, evaluation set, owner, cost ceiling, kill switch, and rollback plan for every new agent.

## P2 — later enhancements

- Broad web scouts and more opportunity categories.
- Learned ranking and model-based enrichment.
- Automatic transcript extraction and record question answering.
- Automated Shift Marketplace workflows.
- Clinical, credential, field, kit, training, and event-operations control towers.
- Generic Avalon OS reporting and capability pages.
- A graph database. RobBot3K needs a durable workflow graph and relational audit history first; a graph database is not a launch requirement.

## Definition of done for first-agent activation

The first live agent may be enabled only when:

- Every P0 item is complete or has a documented, owner-approved compensating control.
- No preview or mock surface is presented as live.
- Every external action is human-approved from its exact final payload.
- Every action is attributable, idempotent, observable, stoppable, and reconcilable.
- Production migrations, secrets, MFA, storage controls, webhooks, and release checks pass.
- The internal test and limited allowlisted pilot succeed without an unapproved send or missed stop condition.
- A human operator owns the queue and knows how to pause, recover, and escalate it.

Until then, RobBot3K should research, enrich, score, and draft only. It should not send outreach, submit forms, create calendar events, or mutate a production system of record.
