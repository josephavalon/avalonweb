# Connected Inventory API and environment requirements

## Required to activate Option A beta

No supplier API is required for Option A. The only currently blocking integration access is a safe way to administer the isolated beta Supabase database:

- Beta Supabase project reference plus a migration-capable connection (database URL/password, or Supabase CLI access token with explicit project link).
- Permission to run migrations 083-094, a pre-migration backup, and read access for the postflight/RLS contract.
- Provisioned beta identities for one Inventory Admin, a separate Clinical approver, a separate Procurement approver, a Finance/Vendor AP reviewer, and provisioned RN/NP canaries. The generic Nurse account remains invoice-only.
- Server secret `INVENTORY_A1_INTERNAL_TOKEN` for A1 internal calls. This is an Avalon secret, not a third-party API.

Vercel project/deployment access is already available in this workspace. New flags must remain OFF until migration postflight succeeds, then be enabled only for the named canary profile IDs.

## Not required for Option A

- Supplier ordering API, EDI, SMTP or email API. An authorized human downloads the immutable JSON/print-safe document and transmits it outside Avalon.
- QuickBooks or Gusto. They are not sources of inventory truth.
- A payment API. Existing Vendor AP remains human-governed and inventory has no payment authority.
- A generative-model API. A1 V1 is a deterministic policy/calculation service.

## Optional future integrations, each separately approved

| Capability | API / credential needed | Current behavior |
| --- | --- | --- |
| Supplier price and availability check | Approved supplier catalog/quote API or EDI credentials stored in managed secrets | Disabled; stale or absent reviewed price holds the proposal. |
| A2 exact PO submission | Approved supplier order API/EDI or tightly structured sender, sandbox account, idempotency semantics and timeout/reconciliation contract | Interface only; no callable execution endpoint. |
| Supplier events | Provider webhook signing secret/certificate, timestamp/replay rules and tenant/connection binding | Immutable inbox schema only; events remain held. |
| Shipment tracking | Approved carrier or aggregator API token | Manual tracking/evidence works without it. |
| Recall signal detection | FDA/openFDA or approved manufacturer/distributor feed | Manual reviewed recall entry works; a feed would be signal-only. |
| Barcode/UDI enrichment | Approved GUDID/UDI or catalog data service | Scanning uses identifiers already in Avalon; unknown classification remains blocked. |
| Electronic order email | Approved transactional email account/domain and structured template transport | Not part of Option A; A1 cannot invoke it. |

Before any future supplier integration is enabled, Avalon needs the provider’s sandbox/base URL, authentication method, credential owner, allowed supplier/account/ship-to scope, rate limits, idempotency and accepted-timeout semantics, webhook verification rules, PHI/data-processing review, and named operational/security owners.
