# Connected Inventory master coverage

Status date: 2026-09-02. `IMPLEMENTED_CODE` means present in this checkout and covered by local static/application gates; it does not mean the migration is applied or the workflow is live.

| Master area | Status | Evidence / remaining gate |
| --- | --- | --- |
| Canonical typed catalog and append-only stock ledger | IMPLEMENTED_CODE | Migrations 043, 071-073 and 083; production JavaScript static gate rejects `.from('items')`. Target row/backfill parity is `BLOCKED_ENV`. |
| Physical kit separate from custodian | IMPLEMENTED_CODE | 083, 086 and 089 create/backfill physical kits and versioned accepted assignments. |
| In-transit handoff and nurse accept/dispute | IMPLEMENTED_CODE | 083-084 plus semantic Admin/nurse handoff APIs. Immediate fulfillment delegates to dispatch then acceptance for connected canaries. |
| Blind counts, immutable lines, variance review, compensating movements | IMPLEMENTED_CODE | 083-084 and 086; expected quantity is withheld by nurse count API until submission. |
| Approved manifests, exact reservations, pickup, route fail-closed | IMPLEMENTED_CODE | Existing 078/080 engine extended by 091 with effective windows, alternatives metadata, clinical approval and expiring readiness evidence. Authenticated route proof is `BLOCKED_ENV`. |
| Restock grouping and shortage-episode dedupe | IMPLEMENTED_CODE | 083-084 and 094 plus grouped nurse API; immutable origins preserve repeated/offline lineage while one unresolved episode remains authoritative, and proof is required to close. |
| Allocation and deterministic reorder math | IMPLEMENTED_CODE | 090 allocation locks and A1 calculator include usable stock, reservations, confirmed inbound, pending allocation, expiry, pack/MOQ/multiple, lead time, storage and budget gates. |
| Supplier master and supplier-item review | IMPLEMENTED_CODE | 083, 088, 090 and 093 require independent supplier review, explicit pack conversion, price window and prohibited substitution for A1. |
| Requisition lifecycle and conversion | IMPLEMENTED_CODE | 083, 090, 092 plus semantic API support create/recalculate, submit, independent approve/reject/cancel/expire and convert to a still-draft PO. |
| Exact immutable PO approval and manual Option A document | IMPLEMENTED_CODE | 083/085, print-safe HTML/JSON endpoint and manual event allowlist. A human transmits outside Avalon. |
| Shipment and receiving inspection | IMPLEMENTED_CODE | 083/085 and 090 add shipment lines/events, inspection, quarantine and separate posting. ASN/webhook cannot make stock usable. |
| Recall, hold, temperature and calibration | IMPLEMENTED_CODE | 078, 090 and 093 add safety evidence, quarantine/recall disposition and readiness invalidation. External feeds are not configured. |
| Vendor AP linkage | IMPLEMENTED_CODE | Existing 073 workflow retains three-way match and Finance separation; inventory cannot execute payment. |
| A1 draft-only agent | IMPLEMENTED_CODE | Deterministic calculator and internal-token endpoint; authority fields prohibit PO creation/contact/payment. Flags and DB kill switch default closed. |
| Disabled Option B adapter | IMPLEMENTED_CODE | Supplier-neutral interface exists; connection records are manual or explicitly disabled and no execution endpoint exists. |
| Seven-area Admin and nurse kit UX | IMPLEMENTED_CODE | Stock, Kits, Requests, Orders, Suppliers, Receiving, Exceptions; nurse custody, blind count, warnings, grouped restock, handoff, return/lost and safe allowlist. Full authenticated visual evidence is `BLOCKED_ENV`. |
| Offline count/restock only | IMPLEMENTED_CODE | Session-bound IndexedDB allowlist; conflict review on reconnect; supplier fields/actions rejected. |
| Database/RLS, concurrency and golden-path execution | BLOCKED_ENV | Requires an isolated beta database connection and provisioned test identities. Static SQL contract is present but has not executed against the target. |
| Live supplier API/EDI, webhook processing, A2/A3 execution | INTENTIONALLY_DISABLED | Outside Option A/A1 release. Requires separate provider selection, sandbox evidence and explicit higher-authority approval. |
| Production promotion | INTENTIONALLY_BLOCKED | Main URL, Cognito/public client pages, Events, supplier contact and payments remain unchanged pending separate production evidence and approval. |

## Source-of-record matrix

| Concern | Authoritative source |
| --- | --- |
| Catalog, item class, UOM and pack policy | `os_inventory_items`, variants, lots and approved supplier items |
| Quantity | append-only `os_stock_transactions`, exposed through derived balance/availability views |
| Custody | physical kits plus location assignments and handoff evidence |
| Shift need/readiness | approved supply-manifest version, pinned shift requirements, reservations and expiring readiness evaluation |
| Replenishment demand | demand episode plus immutable originating request links |
| Supplier commitment | exact approved PO payload hash plus append-only PO/execution events |
| Receipt | receiving inspection and accepted ledger movements |
| Payment | existing Vendor AP/Finance roles and evidence; never the inventory agent |

## Release evidence still required

Apply 083-094 to the isolated beta database, execute the postflight contract, provision named Admin and RN/NP canaries, run the authenticated golden path, capture redacted API/database/audit evidence, verify logs/metrics and zero quantity divergence, and collect accountable owner approvals. Until those steps pass, this is a code-complete candidate rather than a live operational release.
