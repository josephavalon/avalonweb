/**
 * Inventory burndown — decrement on-hand stock for items consumed by a visit.
 *
 * Called by the Acuity webhook when an appointment transitions to "completed"
 * (or, when Acuity doesn't fire a completed event, when scheduled/rescheduled
 * fires AND the visit's start time has already passed — treated as completed).
 *
 * IDEMPOTENCY (mandatory):
 *   Insert a row into `inventory_consumption_events` (appointment_id UNIQUE)
 *   BEFORE applying decrements. If the insert violates the unique constraint
 *   we've already processed this appointment → no-op return. This protects
 *   against double-decrement on webhook re-fires.
 *
 * SHAPE WE PARSE — appointment.external_payload may contain either:
 *   Single visit:
 *     { items: [{ key, label, quantity, ... }], membership: null }
 *   Plan (Membership/PlanCheckout):
 *     { peopleManifest: [{ visits: [
 *         { therapyKey, ivQty: {key:n}, imQty: {key:n}, addons: [{label,qty}] }
 *       ]}] }
 *   Acuity-only (no checkout context): nothing to burn down → skip.
 *
 * MATCHING — items in the `items` inventory table are matched by:
 *   1. exact lowercased SKU
 *   2. exact lowercased name
 *   3. slug(name) === slug(key/label)
 *   Unknown keys are logged and skipped (NEVER throw).
 *
 * NEVER THROWS from decrementForAppointment — wrap in try/catch upstream as
 * belt-and-suspenders. All per-item errors are swallowed + logged so a single
 * bad row can't poison the whole sweep.
 */

import { writeAuditEvent } from './audit-events.js';
import { safeErrorCode, safeLogContext } from './safe-error.js';

function slug(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

/**
 * Walk the external_payload and produce a flat array of
 * { key, label, qty } entries to decrement. Both `key` and `label` are kept so
 * we can match against either inventory.sku or inventory.name.
 */
export function parseConsumedItems(externalPayload = {}) {
  const out = [];
  const safe = externalPayload && typeof externalPayload === 'object' ? externalPayload : {};

  // ── Single-visit cart (checkout/verify writes `items`) ─────────────────────
  if (Array.isArray(safe.items)) {
    for (const it of safe.items) {
      if (!it || typeof it !== 'object') continue;
      const key = it.key || it.sku || it.id || '';
      const label = it.label || it.name || '';
      const qty = Math.max(1, Number(it.quantity || it.qty || 1));
      if (!key && !label) continue;
      out.push({ key: String(key || ''), label: String(label || ''), qty });
    }
  }

  // ── Plan-checkout per-visit picks (peopleManifest[].visits[]) ──────────────
  const people = Array.isArray(safe.peopleManifest) ? safe.peopleManifest : [];
  for (const person of people) {
    const visits = Array.isArray(person?.visits) ? person.visits : [];
    for (const visit of visits) {
      if (!visit || typeof visit !== 'object') continue;
      // Primary IV therapy (1 bag per visit unless explicitly multiplied)
      if (visit.therapyKey) {
        out.push({
          key: String(visit.therapyKey),
          label: String(visit.therapyLabel || ''),
          qty: 1,
        });
      }
      // IV add-ons (ivQty: { key: n })
      const ivQty = visit.ivQty && typeof visit.ivQty === 'object' ? visit.ivQty : {};
      for (const [k, n] of Object.entries(ivQty)) {
        const q = Math.max(0, Number(n) || 0);
        if (q > 0) out.push({ key: String(k), label: '', qty: q });
      }
      // IM shots (imQty: { key: n })
      const imQty = visit.imQty && typeof visit.imQty === 'object' ? visit.imQty : {};
      for (const [k, n] of Object.entries(imQty)) {
        const q = Math.max(0, Number(n) || 0);
        if (q > 0) out.push({ key: String(k), label: '', qty: q });
      }
      // Resolved addon labels (when present, gives us a name-match fallback)
      const addons = Array.isArray(visit.addons) ? visit.addons : [];
      for (const a of addons) {
        const label = a?.label || '';
        const q = Math.max(0, Number(a?.qty) || 0);
        if (label && q > 0) {
          // De-dupe: if an ivQty/imQty entry already covered this, the label
          // match below will resolve to the same inventory row and we'd
          // double-decrement. Skip when we already pushed a slug-matching key.
          const labelSlug = slug(label);
          const alreadyKeyed = out.some((row) => row.qty === q && (row.key === labelSlug || slug(row.label) === labelSlug));
          if (!alreadyKeyed) {
            out.push({ key: labelSlug, label, qty: q });
          }
        }
      }
    }
  }

  // Collapse identical (key|label) entries — sum qty.
  const merged = new Map();
  for (const row of out) {
    const k = `${normKey(row.key)}|${normKey(row.label)}`;
    const prev = merged.get(k);
    if (prev) prev.qty += row.qty;
    else merged.set(k, { ...row });
  }
  return Array.from(merged.values());
}

/**
 * Match a consumed entry to an inventory row. Returns the row or null.
 */
function findInventoryRow(rows, entry) {
  if (!rows || !rows.length) return null;
  const candidates = [normKey(entry.key), normKey(entry.label), slug(entry.key), slug(entry.label)]
    .filter(Boolean);
  if (!candidates.length) return null;
  for (const row of rows) {
    const sku = normKey(row.sku);
    const name = normKey(row.name);
    const nameSlug = slug(row.name);
    const skuSlug = slug(row.sku);
    if (sku && candidates.includes(sku)) return row;
    if (name && candidates.includes(name)) return row;
    if (nameSlug && candidates.includes(nameSlug)) return row;
    if (skuSlug && candidates.includes(skuSlug)) return row;
  }
  return null;
}

/**
 * decrementForAppointment — idempotent stock decrement for one appointment.
 *
 * Returns:
 *   { ok: true, processed: false, reason }  — nothing to do (idempotent hit
 *                                              or empty payload)
 *   { ok: true, processed: true, decremented: N, skipped: [{key, reason}] }
 *   { ok: false, code }                     — only on unexpected outer error
 *                                              (still does NOT throw)
 */
export async function decrementForAppointment({ db, appointment } = {}) {
  try {
    if (!db || !appointment?.id) {
      return { ok: true, processed: false, reason: 'missing_db_or_appointment' };
    }

    const tenantId = appointment.tenant_id || appointment.tenantId || null;
    const externalPayload = appointment.external_payload || appointment.externalPayload || {};
    const consumed = parseConsumedItems(externalPayload);

    // ── Idempotency gate ─────────────────────────────────────────────────────
    // Insert FIRST so we own the slot before mutating any rows. If another
    // webhook re-fire raced us, the unique constraint on appointment_id will
    // reject the duplicate and we exit early.
    const { error: insertErr } = await db.from('inventory_consumption_events').insert({
      appointment_id: appointment.id,
      tenant_id:      tenantId,
      payload:        { consumed, externalPayloadKeys: Object.keys(externalPayload || {}) },
      created_at:     new Date().toISOString(),
    });
    if (insertErr) {
      // 23505 = unique_violation → already processed. Anything else is real.
      const code = insertErr.code || insertErr.details || '';
      if (String(code).includes('23505') || /duplicate key/i.test(String(insertErr.message || ''))) {
        return { ok: true, processed: false, reason: 'already_processed' };
      }
      // If the table doesn't exist yet (migration not applied), treat as a
      // soft no-op rather than break the webhook.
      if (/relation .* does not exist/i.test(String(insertErr.message || '')) || code === '42P01') {
        console.warn('[inventory-burndown] inventory_consumption_events table missing — skipping');
        return { ok: true, processed: false, reason: 'table_missing' };
      }
      console.warn('[inventory-burndown] consumption-event insert failed',
        safeLogContext(insertErr, 'inventory_consumption_insert_failed'));
      return { ok: false, code: safeErrorCode(insertErr, 'inventory_consumption_insert_failed') };
    }

    if (!consumed.length) {
      return { ok: true, processed: true, decremented: 0, skipped: [] };
    }

    // ── Load inventory rows we might decrement ───────────────────────────────
    let inventoryRows = [];
    try {
      const { data, error } = await db.from('items')
        .select('id, name, sku, qty, min_level')
        .is('deleted_at', null);
      if (error) throw error;
      inventoryRows = data || [];
    } catch (err) {
      // If items table is missing or RLS blocks us, skip gracefully.
      console.warn('[inventory-burndown] items lookup failed',
        safeLogContext(err, 'inventory_items_lookup_failed'));
      return { ok: true, processed: true, decremented: 0, skipped: consumed.map((c) => ({ key: c.key, reason: 'items_lookup_failed' })) };
    }

    let decremented = 0;
    const skipped = [];
    const applied = [];

    for (const entry of consumed) {
      const row = findInventoryRow(inventoryRows, entry);
      if (!row) {
        skipped.push({ key: entry.key || entry.label, reason: 'unknown_item' });
        continue;
      }
      const before = Number(row.qty || 0);
      const after = before - entry.qty; // allow negative — operator surfaces as "out" + alert
      try {
        const { error: updErr } = await db.from('items')
          .update({ qty: after, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        if (updErr) throw updErr;
        decremented += entry.qty;
        applied.push({
          itemId:   row.id,
          itemName: row.name,
          sku:      row.sku || null,
          qtyBefore: before,
          qtyAfter:  after,
          qtyDelta:  -entry.qty,
          matchedFrom: entry.key || entry.label,
        });
        // Mirror to the inventory `transactions` activity log if present.
        try {
          await db.from('transactions').insert({
            item_id:    row.id,
            item_name:  row.name,
            type:       'check_out',
            qty_before: before,
            qty_after:  after,
            note:       `Auto-decrement: visit completed (appt ${appointment.id})`,
            user_name:  'System (Acuity)',
          });
        } catch (txErr) {
          // Activity log is best-effort — main decrement already succeeded.
          console.warn('[inventory-burndown] transaction log failed',
            safeLogContext(txErr, 'inventory_transaction_log_failed'));
        }
        // Locally update the row's qty so subsequent same-key entries in this
        // loop see the new value (defensive; we already merged duplicates).
        row.qty = after;
      } catch (err) {
        skipped.push({ key: entry.key || entry.label, reason: safeErrorCode(err, 'item_update_failed') });
        console.warn('[inventory-burndown] item update failed',
          safeLogContext(err, 'inventory_item_update_failed'));
      }
    }

    // ── Audit ────────────────────────────────────────────────────────────────
    try {
      await writeAuditEvent(db, {
        tenantId,
        action: 'inventory_burndown',
        entityType: 'appointment',
        entityId: appointment.id,
        phiTouched: false,
        payload: {
          appointmentId: appointment.id,
          decrementedUnits: decremented,
          applied,
          skipped,
        },
      });
    } catch (err) {
      // Audit is best-effort.
      console.warn('[inventory-burndown] audit write failed',
        safeLogContext(err, 'inventory_burndown_audit_failed'));
    }

    return { ok: true, processed: true, decremented, applied, skipped };
  } catch (err) {
    // Belt-and-suspenders: this helper MUST NOT throw.
    console.warn('[inventory-burndown] unhandled', safeLogContext(err, 'inventory_burndown_unhandled'));
    return { ok: false, code: safeErrorCode(err, 'inventory_burndown_unhandled') };
  }
}

export default decrementForAppointment;
