# Avalon Vitality — Inventory System: Complete Build Spec
**Target:** 100% functional Sortly clone. Zero stubs. Everything persists.  
**Date:** 2026-05-20

---

## Stack Additions

| Addition | Purpose |
|---|---|
| **Supabase** | PostgreSQL database, Auth, File Storage, Realtime subscriptions |
| **@supabase/supabase-js** | JS client |
| **papaparse** | CSV import/export |
| **jspdf + jspdf-autotable** | PDF report export |
| **zxing-wasm** | In-browser barcode + QR scanning via device camera |
| **react-dropzone** | Photo upload drag-and-drop |
| **react-dnd-kit** | Drag items between folders |
| **qrcode.react** | QR code generation for labels |
| **@react-to-print** | Label printing via CSS print stylesheet |

No other dependencies. Everything else is already in the repo (React, Framer Motion, Tailwind, Lucide).

---

## Database Schema (Supabase / PostgreSQL)

### `folders`
```sql
id            uuid primary key default gen_random_uuid()
name          text not null
parent_id     uuid references folders(id) on delete cascade
color         text default '#6b7280'
created_at    timestamptz default now()
updated_at    timestamptz default now()
created_by    uuid references auth.users(id)
```

### `items`
```sql
id                uuid primary key default gen_random_uuid()
sortly_id         text unique not null  -- AVOT#### auto-generated on insert
name              text not null
sku               text
category          text
folder_id         uuid references folders(id) on delete set null
qty               integer not null default 0
unit              text default 'units'
min_level         integer default 0
price             numeric(10,2) default 0
supplier          text
expiration_date   date
refrigeration     boolean default false
notes             text
is_new            boolean default true
alert_enabled     boolean default false  -- per-item low-stock bell
deleted_at        timestamptz            -- soft delete = trash
created_at        timestamptz default now()
updated_at        timestamptz default now()
created_by        uuid references auth.users(id)
```

### `item_photos`
```sql
id          uuid primary key default gen_random_uuid()
item_id     uuid references items(id) on delete cascade
storage_path text not null          -- Supabase Storage path
is_primary   boolean default false
created_at   timestamptz default now()
```

### `tags`
```sql
id          uuid primary key default gen_random_uuid()
name        text not null
color       text default '#60a5fa'
created_at  timestamptz default now()
```

### `item_tags`
```sql
item_id   uuid references items(id) on delete cascade
tag_id    uuid references tags(id) on delete cascade
primary key (item_id, tag_id)
```

### `custom_field_definitions`
```sql
id           uuid primary key default gen_random_uuid()
name         text not null
field_type   text not null  -- 'text' | 'number' | 'date' | 'checkbox' | 'dropdown'
options      jsonb          -- for dropdown: array of strings
sort_order   integer default 0
created_at   timestamptz default now()
```

### `custom_field_values`
```sql
item_id       uuid references items(id) on delete cascade
field_id      uuid references custom_field_definitions(id) on delete cascade
value         text
primary key (item_id, field_id)
```

### `transactions`
```sql
id          uuid primary key default gen_random_uuid()
item_id     uuid references items(id) on delete cascade
item_name   text not null           -- denormalized: item may be deleted later
type        text not null           -- 'check_in' | 'check_out' | 'move' | 'edit' | 'create' | 'delete' | 'restore'
qty_before  integer
qty_after   integer
qty_delta   integer                 -- computed: after - before
folder_from uuid references folders(id) on delete set null
folder_to   uuid references folders(id) on delete set null
note        text
created_at  timestamptz default now()
created_by  uuid references auth.users(id)
user_name   text                    -- denormalized display name
```

### `settings`
```sql
id                  integer primary key default 1  -- single-row table
org_name            text default 'Avalon Vitality'
currency            text default 'USD'
low_stock_threshold text default 'auto'
id_prefix           text default 'AVOT'
id_counter          integer default 21              -- next AVOT number
email_alerts        boolean default false
alert_email         text
created_at          timestamptz default now()
updated_at          timestamptz default now()
```

### Supabase Storage bucket
- **`item-photos`** — public bucket, per-item folders by item UUID

### Row Level Security
- All tables: authenticated users can read/write
- `transactions`: insert-only for non-admins (no deleting history)
- `settings`: read for all, write for admin role only

---

## Feature Spec — Complete

Each feature listed with exact acceptance criteria. "Done" means all criteria pass.

---

### 1. Persistence

**Acceptance criteria:**
- Every item create/edit/delete immediately writes to Supabase
- Every folder create/edit/delete immediately writes to Supabase
- Every tag create/edit/delete immediately writes to Supabase
- Page refresh shows identical state to before refresh
- All qty changes, moves, and field edits persist
- Optimistic UI: state updates instantly in React, rolls back on Supabase error with toast
- Loading skeleton shown on initial data fetch
- Real-time: if two browser tabs are open, a change in one reflects in the other within 2 seconds (Supabase Realtime)

---

### 2. Item Create (Quick Modal)

**Fields:** Name*, Qty*, Unit, Min Level, Price, Add to Folder, Photo (optional), Variants toggle  
**Acceptance criteria:**
- Form validates: Name and Qty required, submit disabled if missing
- On save: inserts row to `items`, inserts transaction row (`type: create`), closes modal
- Sortly ID auto-assigned by DB trigger: prefix from `settings.id_prefix` + zero-padded counter from `settings.id_counter` (increments atomically)
- `is_new` flag set to true, clears after 7 days via DB function or on next view
- Photo: if attached, uploads to Supabase Storage → inserts `item_photos` row, sets `is_primary: true`
- Item appears in grid/list/table immediately (optimistic insert)
- "Show All Fields" button opens Add Item Full Page

---

### 3. Item Create (Full Page — All Fields)

**All fields:** Name*, SKU, Category (dropdown), Qty*, Unit, Min Level, Price, Supplier, Folder, Expiration Date, Refrigeration toggle, Notes, Photo(s), Variants, QR/Barcode section, Custom Fields  
**Acceptance criteria:**
- Same persistence as quick modal
- Multiple photo upload: up to 5 photos, drag-to-reorder, set primary
- Custom fields: any `custom_field_definitions` rows appear as inputs; values saved to `custom_field_values`
- QR/Barcode section: shows auto-generated QR (via `qrcode.react`) and Code128 SVG for the SKU/Sortly ID as soon as name is entered; copy-to-clipboard button on each
- Variants: "This item has variants" toggle reveals a sub-items section — add named variants (e.g. Size: S/M/L) each with own qty and SKU

---

### 4. Item Detail Page

**Acceptance criteria:**
- All fields visible and reflect live DB state
- Qty +/− buttons: each click writes a `check_in` or `check_out` transaction immediately
- Min Level bell icon: toggling `alert_enabled` saves to DB
- Photo carousel: shows all photos for item, tap to expand full-screen
- Barcode section: real Code128 SVG + real QR code (via qrcode.react)
- Download barcode: saves SVG as `.svg` file to user's Downloads
- Print barcode: opens print dialog with label-sized CSS (62mm × 29mm Dymo format)
- Custom Fields tab: shows all defined fields with their saved values for this item
- Orders tab: shows all `transactions` rows for this item, newest first, with type badge, qty delta, user, timestamp
- Activity history scrollable, not paginated (or paginated at 50 rows)
- Tags: clicking a tag navigates to that tag's item list

---

### 5. Item Edit Page

**Acceptance criteria:**
- Pre-fills all current values from DB
- Save writes all changed fields to `items` row, updates `updated_at`
- Save writes an `edit` transaction row with note of which fields changed
- Photo management: add new photos, delete existing, set primary — each action writes immediately
- Custom field edits upsert into `custom_field_values`
- Tag management: add/remove tags writes to `item_tags`
- Cancel discards all local changes (no DB writes)

---

### 6. Item Soft Delete (Trash)

**Acceptance criteria:**
- Delete from context menu or bulk bar: sets `deleted_at = now()` on item, writes `delete` transaction
- Item disappears from all item views immediately
- Trash view: `SELECT * FROM items WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
- Restore: clears `deleted_at`, writes `restore` transaction, item reappears in its original folder
- Permanent delete: removes row from `items` (cascades to `item_photos`, `item_tags`, `custom_field_values`, `transactions`)
- Empty Trash: permanent delete all rows where `deleted_at IS NOT NULL`

---

### 7. Folders

**Acceptance criteria:**
- Create folder: inserts to `folders`, appears in sidebar tree immediately
- Edit folder: updates name/color in DB, reflects in sidebar
- Delete folder: if folder has items, prompt "Move items to [parent] or delete them?" — user chooses before deletion
- Nested folders: unlimited depth, sidebar tree renders via recursive query
- Folder item count: computed from `COUNT(items WHERE folder_id = X AND deleted_at IS NULL)`
- Moving an item to a folder: updates `folder_id`, writes `move` transaction with `folder_from` and `folder_to`
- Drag-to-folder: dnd-kit drag from item card onto sidebar folder node, drops and writes transaction

---

### 8. Search

**Searches across:** name, SKU, Sortly ID, notes, supplier, tag names, custom field values  
**Acceptance criteria:**
- Debounced 200ms, no page reload
- Highlights matching text in item name
- Empty state message: "No results for '[query]'"
- Clears on folder navigation

---

### 9. Filtering

**Filter panel (toolbar button):** Category, Tag (multi-select), Status (In Stock / Low / Out), Expiry (Expired / Expiring 7d / Expiring 30d / No expiry), Folder  
**Acceptance criteria:**
- Multiple filters combinable (AND logic)
- Active filter count badge on filter button
- Clear all filters button
- Filters persist in URL params so shareable/bookmarkable
- Filtered count shown: "Showing 4 of 21 items"

---

### 10. Sort

**Sort options:** Name, Updated At, Qty, Price, Expiration Date, Created At  
**Acceptance criteria:**
- Sort direction toggle (asc/desc)
- Sort persists across folder navigation within session
- Null dates sort last (expiration: null = never expires = last)

---

### 11. Bulk Actions

**Acceptance criteria:**
- Select All: selects all items on current page
- Select All (all pages): secondary confirmation "Select all 21 items across all pages?"
- Bulk Move: opens MoveFolderModal → writes `folder_id` update + `move` transaction for each item
- Bulk Delete: moves all to trash (soft delete), writes transaction for each
- Bulk Export: generates CSV of selected items (see Export spec below)
- Bulk Tag: opens tag picker → applies tag to all selected items
- Bulk Update Qty: opens qty delta input → applies +/− to all selected items, writes transaction for each
- Selection persists across layout switches (grid → list → table) within same filter context
- Selection cleared on folder navigation

---

### 12. Pagination

**Acceptance criteria:**
- Default 20 per page, options: 20/50/100
- Prev/Next buttons, current page / total pages display
- Jump to page: number input, enter to jump
- "1–20 of 21 items" count
- Page resets on search/filter/sort/folder change
- Table view: sticky column headers on scroll

---

### 13. Barcode / QR Scanning

**Acceptance criteria:**
- Scan button in toolbar opens camera modal
- Uses `zxing-wasm` to decode live camera feed
- Decodes: Code128, Code39, QR, EAN-13, EAN-8, DataMatrix
- Scan result:
  - If SKU/Sortly ID matches existing item → opens that item's detail page
  - If no match → opens Add Item modal with SKU pre-filled
- Scan to check in/out: dedicated scan mode where each scan opens a +/− qty dialog for matched item, writes transaction
- Works on mobile (rear camera) and desktop (webcam)
- Bluetooth scanner: USB/BT barcode scanners fire `keydown` events — capture those in a global listener, same lookup logic as camera scan
- Permission denied state handled gracefully with fallback message

---

### 14. Photo Upload

**Acceptance criteria:**
- react-dropzone: drag-and-drop or click-to-browse
- Accepts: JPEG, PNG, WebP, HEIC
- Max 5 photos per item, max 10MB per photo
- On drop: shows thumbnail preview immediately
- On save: uploads to Supabase Storage at `item-photos/{item_id}/{uuid}.webp` (converted to WebP via Canvas API for size)
- Primary photo shown as item card thumbnail in grid view
- Delete photo: removes from Storage + `item_photos` row
- Reorder: drag thumbnails, updates `sort_order`

---

### 15. Custom Fields

**Acceptance criteria:**
- Field types: Text, Number, Date, Checkbox, Dropdown (with defined options)
- Manage custom fields: Settings → Custom Fields section → add/edit/delete field definitions
- Adding a field definition: adds column to all items' edit/detail views
- Dropdown fields: admin defines option list (e.g. "Lot Number", "Batch ID")
- Values saved to `custom_field_values` table keyed by item + field
- Custom field values searchable (search box queries this table too)
- Deleting a field definition: prompts "This will remove this field's data from all items. Continue?" — cascades to `custom_field_values`
- Reports → Inventory Summary table includes custom field columns when any are defined

---

### 16. Variants / Sub-Items

**Acceptance criteria:**
- "This item has variants" toggle on Add/Edit item
- Variants section: add variant rows, each with: Name (e.g. "Size: L"), SKU, Qty, Min Level
- Each variant stored as a child item (`parent_id` column on `items` table — add this)
- Parent item qty = sum of variant qtys (computed, not stored)
- Detail page shows variant table below metric tiles
- Variants individually trackable (own transactions, own barcode)

---

### 17. Tags

**Acceptance criteria:**
- Tag CRUD: name + color, persists to `tags` table
- Apply tags to items: multi-select tag picker in item edit
- Tag filter: click a tag in the tag list → filters item view to items with that tag
- Tag chip in grid/list/table view is clickable — applies that tag filter
- Deleting a tag: prompts "Remove from X items?" — cascades via `item_tags`
- Tags view: shows tag list with real item count from DB query

---

### 18. Transaction History (Activity)

**Every state mutation writes a transaction row:**
- `create` — new item added
- `check_in` — qty increased
- `check_out` — qty decreased
- `move` — item moved to different folder
- `edit` — fields changed (records which fields)
- `delete` — soft deleted
- `restore` — restored from trash
- `permanent_delete` — permanently deleted (written before deletion)

**Acceptance criteria:**
- Item detail → Orders/Activity tab: shows all transactions for that item, newest first
- Reports → Activity History: shows all transactions across all items, filterable by date range, user, action type, item name
- Reports → Transactions: shows only check_in / check_out rows, filterable by date range
- Reports → User Activity Summary: groups by `created_by`, shows counts per action type, last active timestamp

---

### 19. Reports — All 6

All reports pull from live DB data, not mock arrays.

**Inventory Summary:**
- Full item table with all fields
- Summary tiles: total SKUs, total units, total value, alerts count
- Filter: by folder, category, tag, status
- Export: CSV and PDF

**Activity History:**
- All `transactions` rows, newest first
- Filter: date range picker, action type multi-select, item name search, user
- Pagination (50/page)
- Export: CSV

**Transactions:**
- `check_in` / `check_out` rows only
- Columns: Date, Item, Type, Qty Delta, New Qty, User, Note
- Filter: date range, type, item
- Export: CSV

**Item Flow:**
- Items ranked by total qty delta (most movement in selected period)
- Bar chart per item showing in vs. out
- Date range filter (default: last 30 days)
- Export: CSV

**Move Summary:**
- All `move` transactions grouped by destination folder
- Shows: folder name, item count moved in, items currently in folder, value
- Date range filter
- Export: CSV

**User Activity Summary:**
- All users who've made changes
- Columns: User, Total Actions, Items Created, Items Edited, Check-ins, Check-outs, Last Active
- Export: CSV

**All reports:**
- "Export CSV" → papaparse generates and triggers browser download
- "Export PDF" → jspdf-autotable generates and triggers browser download
- "Print" → window.print() with print stylesheet that hides nav and shows full table

---

### 20. Notifications

**In-app:**
- Bell icon shows count of active alerts (low stock + expiring within 7 days)
- Notification panel: lists alerts with item name, type, value, "View Item" link
- Mark as read: dismisses from panel (per-session or stored in DB)
- Per-item alert bell: when `alert_enabled = true`, item flagged in notifications regardless of global threshold

**Email alerts (optional, requires Supabase Edge Function or SendGrid):**
- Settings → Enable Email Alerts toggle + alert email field
- Supabase CRON job: daily at 08:00, queries items where `qty <= min_level OR expiration_date <= now() + 7 days`
- Sends digest email: "3 items need attention at Avalon Vitality"
- Unsubscribe link in email

---

### 21. Label Printing

**Acceptance criteria:**
- Print button in item detail → opens print preview
- Label shows: item name, SKU, Sortly ID, QR code, optional price
- CSS print stylesheet targets label size: 62mm × 29mm (standard Dymo)
- Batch print from bulk action bar: generates one label per selected item, all on print sheet
- Label template: clean, high-contrast, scannable QR

---

### 22. CSV Import

**Acceptance criteria:**
- Import button in toolbar → opens import modal
- Step 1: Upload CSV file (drag or browse)
- Step 2: Column mapping — user maps CSV columns to item fields (Name, SKU, Qty, etc.)
- Step 3: Preview — shows first 5 rows with mapped values, flags errors
- Step 4: Confirm import — inserts all rows, writes `create` transaction for each, assigns Sortly IDs sequentially
- Handles duplicates: if SKU already exists, option to skip or update existing
- Import errors shown per-row (e.g. "Row 4: Qty must be a number")
- Max 1000 rows per import

---

### 23. CSV / PDF Export

**Acceptance criteria:**
- Export all items: toolbar export button → CSV of all items in current view (filtered/sorted)
- Export selected items: bulk action → CSV of selected items only
- CSV columns: Sortly ID, Name, SKU, Category, Folder, Qty, Unit, Min Level, Price, Total Value, Supplier, Expiration Date, Refrigeration, Notes, Tags, Created At, Updated At
- PDF export: available in Reports only, uses jspdf-autotable, landscape orientation, includes report header with org name + date
- Filename format: `avalon-inventory-export-YYYY-MM-DD.csv`

---

### 24. Settings

**Acceptance criteria:**
- Organization name: saves to `settings` table
- Currency: saves, all price displays update globally via context
- Low Stock Threshold: "Per-item" (use `min_level`) or global override (e.g. "below 10") — saves and recalculates all stock status badges immediately
- ID Prefix: changing prefix applies to new items only; shows warning "Existing IDs will not change"
- Custom Fields management: full CRUD for field definitions (see Custom Fields spec)
- User Management: invite by email, assign role (Admin / Editor / Viewer), revoke access — powered by Supabase Auth invitations
- Save confirmation: "Settings saved" flash toast

---

### 25. Authentication

**Acceptance criteria:**
- Supabase Auth (email + password, or magic link)
- `/admin/inventory` route protected — redirects to `/admin/login` if not authenticated
- Login page: email + password form, "Sign in with magic link" option
- Session persists via Supabase JWT in localStorage
- Logout: clears session, redirects to login
- Role-based: Admin can manage users + settings; Editor can create/edit/delete items; Viewer can only read
- `created_by` populated on all inserts from `auth.uid()`

---

## Build Order (Phases)

### Phase A — Foundation (must be first, everything else depends on it)
1. Supabase project setup — create tables, RLS policies, Storage bucket
2. Auth — login page, route protection, session management
3. Data layer — replace all `useState(SEED_*)` with Supabase queries (`useSWR` or React Query for caching)
4. Write transaction on every state mutation
5. Optimistic UI pattern established (update local state → write to DB → rollback on error)

**Done when:** refresh shows same state as before refresh, all mutations write transactions

---

### Phase B — Item completeness
1. Photo upload (Supabase Storage + react-dropzone)
2. Custom fields (definition CRUD in Settings, value save on item edit)
3. Variants (sub-items data model + UI)
4. All existing stub buttons wired: Download barcode, Print barcode (label CSS)

**Done when:** every field on the Add/Edit item page saves and persists

---

### Phase C — Scanning & Import/Export
1. Camera barcode/QR scanner (zxing-wasm)
2. Bluetooth scanner listener (global keydown handler)
3. CSV import (upload → map → preview → confirm)
4. CSV export (all views + bulk selection)
5. PDF export (reports only)

**Done when:** scan any item's barcode and it opens that item; import a CSV and items appear

---

### Phase D — Reports (real data)
1. Activity History — live query from `transactions`
2. Transactions — live query filtered to check_in/check_out
3. Item Flow — aggregate query grouped by item, date range
4. Move Summary — aggregate query from move transactions
5. User Activity — aggregate grouped by user
6. Date range pickers on all reports
7. Export buttons on all reports

**Done when:** every number in every report reflects actual DB state

---

### Phase E — Polish
1. Tag filtering (click tag → filter item list)
2. Advanced filter panel (category, status, expiry, tag multi-select)
3. Filter state in URL params
4. Drag-to-folder (dnd-kit)
5. Sticky table column headers
6. Jump-to-page input in pagination
7. Bulk tag + bulk qty update in bulk action bar
8. Email alerts (Supabase Edge Function + CRON)
9. Realtime sync (Supabase Realtime channel on `items` table)
10. Select all across pages
11. "New" badge clearing after 7 days (DB function)

**Done when:** every acceptance criterion in this spec passes

---

## File Structure Changes

```
src/
  lib/
    supabase.js          — client init
    queries/
      items.js           — all item CRUD functions
      folders.js         — folder CRUD
      tags.js            — tag CRUD
      transactions.js    — transaction writes + queries
      reports.js         — report aggregate queries
      settings.js        — settings read/write
  hooks/
    useItems.js          — data fetching hook with optimistic updates
    useFolders.js
    useTags.js
    useSettings.js
  components/
    inventory/
      Scanner.jsx        — camera barcode modal
      PhotoUpload.jsx    — dropzone component
      LabelPrint.jsx     — print stylesheet + trigger
      CSVImport.jsx      — multi-step import modal
  pages/
    admin/
      Inventory.jsx      — existing file, swap seed data for hooks
      Login.jsx          — new auth page
```

---

## What Does NOT Change

- All existing component UI (layout, styling, animations, Tailwind classes)
- Framer Motion easing and transition specs
- Icon set and color tokens
- The `EASE = [0.16, 1, 0.3, 1]` constant
- Component structure (ItemGridCard, ItemListRow, etc.)

The entire UI layer stays as-is. Every change in this spec is either a new file, a new hook, or swapping a `useState` call for a `useQuery` call.

---

## Acceptance: Definition of Done

The build is complete when:
1. A fresh page load shows all existing data
2. Every button triggers a real action with real DB persistence
3. Every number in every report reflects live DB state
4. A barcode scan finds or creates an item
5. A photo upload appears on the item detail page after refresh
6. CSV import creates real persistent items
7. CSV export downloads a real file with real data
8. Label print opens a print dialog with a real label
9. Trash, restore, and permanent delete all persist
10. Two browser sessions show the same state within 2 seconds
