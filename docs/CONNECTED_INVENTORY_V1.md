# Connected Inventory V1 release contract

## Current evidence

- Route baseline checkpoint: `a25ee60c` on `josephavalon/nurse-marketplace-route-v1`.
- Baseline merge-base: `origin/main@9ad68bfd`; the route checkpoint is directly on that base.
- Local pre-change gates passed: build, shared inventory, Vendor AP, nurse marketplace, and `git diff --check`.
- The workspace itself had no `.vercel/project.json`, but the authenticated Vercel account confirms separate `avalonweb-beta` and `avalonweb` projects. The newest listed beta preview is Ready but 19 days old, so it has no proven lineage to this branch.
- Beta Preview has encrypted `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `AVALON_BETA_SUPABASE_PROJECT_REF` variable names. Their sensitive values are not exportable through this audit, so migrations 077-089 and database/RLS status remain unverified. No deployment or database state is inferred.
- Migrations 077-082 remain immutable route baseline. Connected Inventory is forward-only in 083-089.

## Legacy cutover

The production JavaScript inventory readers and writers were audited. The remaining legacy `items` access existed in `api/admin/inventory-low.js`, `api/admin/shift-marketplace.js`, `api/_lib/inventory-burndown.js`, and `app-modules/source/hooks/useInventoryData.js`. These paths now use typed `os_*` data or fail closed. Database row counts and backfill parity remain unverified because the beta Supabase credentials could not be exported. The static connected-inventory gate rejects any new production `.from('items')` use and browser-direct canonical inventory mutations.

Acuity labels no longer decrement inventory. Completion creates a PHI-free reconciliation exception. Exact reserved stock is consumed, released, wasted, or damaged only through `reconcile_shift_inventory` with reservation IDs and one idempotent closeout payload.

## Flags and authority

All flags default safe:

- `CONNECTED_INVENTORY_ENABLED=false`
- `INVENTORY_CANARY_PROFILE_IDS=` (empty blocks every account)
- `INVENTORY_MANUAL_PROCUREMENT_ENABLED=false`
- `INVENTORY_A1_DRAFTS_ENABLED=false`
- `INVENTORY_SUPPLIER_EXECUTION_ENABLED=false`
- `INVENTORY_GLOBAL_KILL_SWITCH=true`

Option A produces an immutable approved JSON payload and print-safe HTML document. An authorized human transmits it outside Avalon and records structured evidence. No supplier transport is implemented. The disabled adapter interface is present for future work.

A1 is deterministic and draft-only. It may create a draft requisition and calculation trace only after the server flag, named-account canary, internal service token, approved procurement policy, and database control are all enabled. It cannot approve a requisition or PO, export or send an order, select substitutions, contact a supplier, access PHI, or initiate Vendor AP/payment.

## Canary sequence

1. Confirm the beta Vercel project and Supabase project IDs out of band; do not reuse production by assumption.
2. Back up and apply 083-089 in order. Record each migration checksum, then run `supabase/tests/connected_inventory_contract.sql` against that exact target to verify relations, RLS, grants, service commands, availability fields, and immutability triggers.
3. Run `npm run verify:connected-inventory`, the existing shared-inventory, Vendor AP, nurse-marketplace suites, and `npm run build`.
4. Deploy the exact commit to the isolated beta canary with every new feature flag OFF and the global kill switch ON.
5. Verify authenticated Admin and provisioned RN/NP reads. Confirm the generic invoice-only Nurse login cannot enter full kit flows.
6. Enable `CONNECTED_INVENTORY_ENABLED` for named beta accounts, then nurse workflows, manual procurement, and A1 drafting separately. Keep supplier execution OFF.
7. Exercise receive -> kit -> count -> shift reserve -> consume/release -> restock -> A1 requisition -> immutable manual PO -> inspection -> receiving -> handoff -> Vendor AP.
8. Compare ledger-derived quantities after every step. Any divergence, stale count, ambiguous UOM, unclassified item, custody conflict, recalled lot, unknown order state, or hash mismatch stops the canary.

## Rollback and compensation

Turn all connected flags OFF and restore the global kill switch first. Do not delete or edit movement, count-line, handoff-line, PO-event, execution-attempt, inspection-line, A1-evaluation, or automation-control evidence. Reverse an incorrect stock result with a separately approved compensating movement; resolve or supersede workflow records with new events. Database rollback means a reviewed forward migration, never rewriting an applied migration.

Production, Cognito, public client pages, Events, payments, and supplier contact remain outside this release and require separate approval plus deployed lineage, migration/RLS postflight, authenticated UI/API/database evidence, observability, owner approvals, and zero unexplained quantity divergence.
