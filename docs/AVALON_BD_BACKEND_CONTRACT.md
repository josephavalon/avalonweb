# Avalon BD backend contract

Avalon BD is currently an admin-only, service-role-backed CRM foundation. Apply migration `048_avalon_bd_crm.sql` before using the endpoint.

## Endpoint

`GET /api/admin/bd`

- `?view=dashboard`
- `?view=companies|people|pipeline|tasks|lists&limit=50&offset=0`
- `?view=search&q=...`
- `?view=record&recordType=company|person|opportunity&id=<uuid>`

Collection rows use the persisted `snake_case` database shape. Company, person,
opportunity, and task rows are decorated with `owner_name`, resolved only from
tenant-scoped profile data; no additional profile fields are exposed.
Every paginated collection includes exact pagination metadata.

Search returns bounded matches for companies, people, opportunities, notes,
activities, and tasks. Record context returns the selected record, relationships,
a de-duplicated unified activity timeline, open and historical tasks, notes,
document metadata, call intelligence, and mutation history. Company history
includes its related people and opportunities. Person history includes primary
and secondary activity links plus linked opportunities. Relationship expansion
and every returned collection are capped to keep requests bounded.

Dashboard due-today and overdue work are separate. Day boundaries are calculated
in `America/Los_Angeles` (including daylight-saving transitions). `upcomingCalls`
includes the tenant-scoped prospect's `organization`, `contact_name`,
`contact_role`, `company_id`, `person_id`, and `opportunity_id` when available.

`POST /api/admin/bd`

- `create_company { company }`
- `create_person { person }`
- `create_opportunity { opportunity }`
- `create_activity { activity }`
- `create_task { task }`
- `add_note { note }`
- `register_file_metadata { file }`
- `create_list { list }`
- `add_list_item { item }`
- `record_call { call }`
- `reconcile_prospect { prospectId }`
- `merge_records { recordType, sourceId, targetId, sourceExpectedVersion, targetExpectedVersion }`

`PATCH /api/admin/bd`

- `update_company|update_person|update_opportunity { id, expectedVersion, patch }`
- `change_pipeline_stage { opportunityId, expectedVersion, stage }` (also accepts `patch.stage`)
- `update_task { taskId, expectedVersion, patch }`
- `complete_task { taskId, expectedVersion }`
- `soft_delete { recordType, id, expectedVersion }`

The API requires a Supabase admin session and AAL2 when operator MFA enforcement is active. Owner assignment is restricted to an active admin or staff profile in the caller's tenant. Updates use optimistic versions and return `409 version_conflict` when stale.

Company creation rejects an existing active normalized domain and also rejects a
same-name active company when the new record lacks a domain. RobBot reconciliation
prefers an exact domain. A no-domain name fallback must resolve to one company;
multiple matches fail with `company_name_ambiguous`. Location is retained as
context but is not used as an automatic identity key. When a later reviewed prospect adds a domain
to a linked name-only company, reconciliation compare-and-sets the missing
domain/website and records the previous and resulting values. A domain already
owned by another company fails with `company_domain_conflict` for merge/review.

Archiving a company, person, or opportunity is fail-closed. Any active child,
historical relationship that must remain addressable, list membership, call, or
RobBot link returns `409 archive_dependencies_active`; operators must reassign,
merge, or archive dependencies first. Terminal opportunities reopened into an
active stage receive a stage-based probability (10–80%) so a lost record does not
remain at 0% and a won record does not remain at 100%.

## Post-call ingestion

`record_call` accepts manual notes/summary plus first-class `requirements`,
`clientObjectives`, `painPoints`, `budgetMinCents`, `budgetMaxCents`,
`decisionMakers`, `stakeholders`, `servicesOfInterest`, `objections`,
`requestedDeliverables`, `recommendedNextSteps`, `recommendedFollowUp`,
`followUpAt`, `dealProbability`, `expectedValueCents`, and `expectedCloseDate`.
The response contains `{ call, activity, opportunity, tasks }`. `opportunity` is
`null` unless approved updates were applied; `tasks` is always an array.

Opportunity changes are explicitly human-gated. With
`applyOpportunityUpdates: true`, the caller must send
`opportunityExpectedVersion` and may apply `expectedValueCents`,
`dealProbability`, `expectedCloseDate`, `recommendedFollowUp`/`nextAction`, and
`followUpAt` (mapped to the opportunity's Pacific-local `next_action_date`).
Stale versions return `409 version_conflict`. With the flag false or absent,
these values remain call intelligence and the opportunity is not changed.
`followUpTasks` supports at most 10 validated linked task objects with
`title`, optional `dueAt`, `priority`, `notes`, same-company `personId`, and
active operator `ownerProfileId`.

Call insertion, activity/audit, optional opportunity update, and task creation
are validated up front but remain separate service-role requests. A later-step
failure can leave the already-stored call or earlier task in place; the API
surfaces that failure and mutation history supports reconciliation. Transcript
and recording storage remain staged and unconnected.

## Human-admin record merge

`merge_records` supports only Company and Person records. A service-role-only,
security-definer database function independently verifies that the actor is an
active admin in the same tenant, locks both rows, checks both optimistic
versions, and commits the relationship changes, soft deletion, timeline
activity, and immutable mutation audit in one transaction. The function is
revoked from public, anonymous, and authenticated callers.

The target record wins: its descriptive fields are preserved as-is. References
to the source are repointed to the target, the source remains as a soft-deleted
merge record with `merged_into_id` and `deleted_by`, and the target and affected
versioned children advance their versions. Company merges cover people,
opportunities, activities, tasks, notes, files, calls, list memberships, RobBot
links, and prior merge pointers. Person merges cover opportunity and activity
relationships, tasks, notes, files, list memberships, RobBot links, and prior
merge pointers.

V1 does not combine conflicting field values or silently drop duplicate
relationships. It rejects list-membership, RobBot-opportunity, opportunity-person,
same-name name-only contact, and activity-person uniqueness collisions for human review. There is no UI or
automatic undo flow in this backend change; the retained source and mutation
snapshot provide the evidence needed for a separately reviewed repair.

## RobBot reconciliation hook

`reconcileRobBotProspectToBd(db, tenantId, actorProfileId, prospectId)` is exported from `api/_lib/bd-crm-core.js`. It idempotently resolves or creates a company, eligible named person, and opportunity; links them back to `robbot3k_prospects`; writes a `rob_bot_action` activity; and records agent/model/confidence/approval attribution. It never sends outreach and never grants outreach approval.

Contact resolution prefers an exact normalized email. Name-only contacts are
preserved by creating or finding an active person with the normalized full name
at the same tenant and company; a partial unique key makes concurrent name-only
reconciliation race-safe. If more than one existing named contact is ambiguous,
the operation stops for review. An exact email match with the same company is
reused, and a previously unassigned email contact may be attached to the company
with an attributable mutation. If an email match belongs to another company,
reconciliation fails with `person_company_conflict`; it never silently links
that person into the new company's opportunity.

The normal `create_manual_prospect` admin action immediately invokes this
reconciliation after the durable RobBot research upsert. Success returns `crm`
with company/person/opportunity IDs and still creates no outreach approval. If
CRM reconciliation fails, the API returns a non-success response with
`researchRecordRetained: true`, the retained prospect, and a precise CRM error;
missing CRM tables return `manual_prospect_saved_crm_migration_required` for
migration 048 rather than being mislabeled as RobBot migration 046. A later
manual edit can safely enrich the same linked name-only Person with email and
RobBot-owned title using optimistic versioning and an attributable mutation.
An email already owned by another active Person fails with
`person_email_conflict` for review/merge.

Human approval now reconciles a prospect before the executable outreach
approval is created. If reconciliation fails, no send-enabled approval exists.
If the post-approval CRM outcome write fails, RobBot revokes the executable
approval and returns the prospect to review. The send gate also refuses any
approved sequence that lacks its company and opportunity links.

`recordRobBotCrmOutcome` is the shared idempotent outcome bridge. It records
attributed activities and mutation history for approval/reconciliation, outbound
email sent, inbound reply, meeting booked, hold/revoke/reject, and suppression.
Pipeline movement is conservative and forward-only: `approved` -> `contacted`
-> `engaged` -> `discovery`. The bridge never regresses a stage and never moves
an opportunity autonomously into proposal, negotiation, won, or lost. Manual
admin actions are human-attributed, RobBot send execution is agent-attributed,
and webhook-style events without an operator are system-attributed.

The outcome bridge is retry-idempotent but its activity, opportunity update,
and mutation entries are separate service-role requests, not one database
transaction. A provider-confirmed send is retained for reconciliation if the
CRM bridge fails; sequence advancement waits until the CRM outcome is recorded.
The transactional merge RPC is the exception to this general V1 limitation.

## Honest runtime boundary

- File APIs register metadata only. No file bucket or upload provider is connected.
- Call APIs accept manual structured notes. Transcript extraction and recording storage are not connected.
- Ask Rob Bot / record Q&A is not connected.
- Agent permissions default to denied and are separate from human roles. No autonomous agent API credential is issued by this foundation.
- Deterministic reconciliation is permitted only as a derivative of an authenticated human-admin action. Outcome-bridge writes are permitted only from that human action or from the exact persisted outreach approval enforced by the RobBot send gate. The disabled `robbot3k` identity is attribution, not general mutation permission.
- `executeAuthorizedBdAgentMutation` is an exported fail-closed seam and always returns `agent_write_path_not_connected`. No route exposes autonomous CRM mutation. It must be replaced only by a database-transactional write that consumes a persisted, exact-payload approval artifact; a caller-supplied approver ID is never treated as proof.
- Do not enable a live outreach provider until bridge capabilities are transactionally enforced through `bd_agent_permissions` or an equivalent exact-approval RPC. V1 application-level ordering and idempotency are safety controls, not a general agent authorization system.
- A successful ordinary mutation response requires the detailed mutation-history insert to succeed. Except for `merge_records`, the business-row write and mutation-history write are separate service-role requests, not one database transaction. Before autonomous agent writes are enabled, move each mutation and its audit insert into a security-definer RPC (or equivalent transaction) so a process failure cannot leave an unaudited write.
