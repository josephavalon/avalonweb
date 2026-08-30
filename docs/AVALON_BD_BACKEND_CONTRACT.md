# Avalon BD standalone backend contract

Avalon BD is an admin-only, service-role-backed CRM. This release is isolated
from every outreach, research, webhook, calendar, and autonomous-agent path.

## Production gate

`/api/admin/bd` is disabled unless the server-only environment variable
`AVALON_BD_CRM_ENABLED` is exactly `true`. The default is `false`; there is no
browser flag. Enable it only after applying `064_avalon_bd_standalone.sql` and
verifying its empty-data and access-control postflight.

`AVALON_BD_DATA_REVIEWED` is a separate safety gate for the later outreach
system and remains `false` for this release. Enabling Avalon BD does not enable
that system, its API, its crons, its webhook, or live sending.

## Endpoint

`GET /api/admin/bd`

- `?view=dashboard`
- `?view=companies|people|pipeline|tasks|lists&limit=50&offset=0`
- `?view=search&q=...`
- `?view=record&recordType=company|person|opportunity&id=<uuid>`

Collection rows use the persisted `snake_case` database shape. Company, person,
opportunity, and task rows are decorated with tenant-scoped `owner_name` data.
Every paginated collection includes exact pagination metadata.

The dashboard reads only `bd_*` tables. Upcoming meetings are future
`bd_activities` rows whose type is `meeting`; no separate automation tables are
queried. Empty CRM tables produce real zero totals and empty lists.

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
- `merge_records { recordType, sourceId, targetId, sourceExpectedVersion, targetExpectedVersion }`

`PATCH /api/admin/bd`

- `update_company|update_person|update_opportunity { id, expectedVersion, patch }`
- `change_pipeline_stage { opportunityId, expectedVersion, stage }`
- `update_task { taskId, expectedVersion, patch }`
- `complete_task { taskId, expectedVersion }`
- `soft_delete { recordType, id, expectedVersion }`

There is no prospect-reconciliation or outbound mutation action on this
endpoint. The API requires a Supabase admin session and AAL2 when operator MFA
enforcement is active. Owner assignment is restricted to an active admin or
staff profile in the caller's tenant. Updates use optimistic versions and
return `409 version_conflict` when stale.

## Data and access boundary

Migration 064 creates exactly 15 tenant-scoped `bd_*` tables and the
service-role-only `bd_merge_records` function. It preflights the tenant/profile
foundation, required functions, database roles, and absence of prior BD tables
before the first schema write. The entire migration is one transaction and
seeds no rows.

All 15 tables have RLS enabled. PUBLIC, anonymous, and authenticated roles receive
no direct table privileges. Profile attribution uses same-tenant composite
foreign keys. The service role receives only the operations required
by the server API: soft-deleted business tables cannot be physically deleted,
relationship junctions can be replaced, and `bd_agent_mutations` is append-only.
The merge function is executable only by the service role and independently
verifies an active same-tenant admin before it writes.

## Human-admin merge

`merge_records` supports Company and Person records. Person merges are rejected
unless both people link to the same non-null company. The target record wins;
the source remains as a soft-deleted record with `merged_into_id`. The function
locks both records, checks optimistic versions, rejects relationship collisions,
repoints native BD relationships, records a timeline activity, and appends an
immutable mutation entry in one transaction.

Ordinary API writes do not have that merge guarantee. The business-row request
and the later `bd_agent_mutations` insert are separate service-role requests. If
the mutation-history insert fails, the business row may already be committed
even though the API returns an error. Agent BD must not receive autonomous CRM
mutation access until a transactional RPC and persisted exact-payload
authorization contract replace this V1 write path.

## Honest runtime boundary

- Person creation writes directly to `bd_people`; an existing company link is optional.
- File APIs register metadata only. No file bucket or upload provider is connected.
- Call APIs accept human-reviewed structured notes. Transcript extraction and recording storage are not connected.
- Agent identities and permissions default to disabled/denied. No autonomous mutation route is exposed; enabling one requires the transactional and exact-authorization work described above.
- No fixture, prospect, company, person, or opportunity rows are inserted by the release.
