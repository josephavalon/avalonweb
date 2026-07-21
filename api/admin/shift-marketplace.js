/**
 * GET /api/admin/shift-marketplace
 *
 * Read-only snapshot for the nurse shift marketplace admin surface. Pulls the
 * live data sources (upcoming open appointments, nurse roster, inventory) and
 * hands them to `buildShiftMarketplaceSnapshot` from src/lib/shiftMarketplaceBrain.js.
 *
 * Output shape: { ...snapshot, dataSources: { appointments, nurses, inventory } }
 * — `snapshot` is whatever the brain produces; `dataSources` carries row counts
 * and `tableMissing` hints so the UI can call out empty sources gracefully.
 *
 * NOTE: this is a READ-ONLY surface today. The brain produces offer objects but
 * we DO NOT broadcast them — Y/N reply, payroll, and Acuity wiring are still
 * placeholder handoffs (see SHIFT_MARKETPLACE_RULES).
 */

import { requireStaff } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import {
  buildShiftMarketplaceSnapshot,
  SHIFT_MARKETPLACE_VERSION,
  SHIFT_MARKETPLACE_MODE,
  SHIFT_MARKETPLACE_RULES,
} from '../../src/lib/shiftMarketplaceBrain.js';

const APPT_LIMIT = 200;
const NURSE_LIMIT = 100;
const INVENTORY_LIMIT = 500;
const HORIZON_DAYS = 14; // upcoming window

// Profile roles that count as field clinicians on a shift offer board.
const NURSE_ROLES = ['nurse', 'rn', 'np'];

function isMissingRelation(err) {
  // Postgres "undefined_table" / PostgREST PGRST 42P01 family.
  const code = String(err?.code || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();
  return code === '42p01'
    || code === 'pgrst205'
    || message.includes('relation') && message.includes('does not exist')
    || message.includes('schema cache');
}

function pickAddress(payload = {}) {
  return payload.address || payload.street || payload.line1 || '';
}
function pickCity(payload = {}) {
  return payload.city || payload.locality || payload.town || '';
}
function pickZip(payload = {}) {
  return payload.zip || payload.postal_code || payload.postcode || '';
}
function pickName(payload = {}) {
  return payload.full_name || payload.name || payload.contact_name || '';
}
function pickTherapy(payload = {}, fallback = '') {
  return payload.protocol_label || payload.therapy || payload.service || payload.plan || fallback;
}

function shapeAppointmentForBrain(row = {}) {
  const ext = row.external_payload || {};
  const customer = ext.customer || ext.contact || {};
  const starts = row.starts_at ? new Date(row.starts_at) : null;
  const timeLabel = starts && !Number.isNaN(starts.getTime())
    ? starts.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : 'Time pending';
  const status = row.status || 'New Request';
  const intakeDone = ext.intakeComplete || row.intake_status === 'complete';
  const consentDone = ext.consentComplete || row.consent_status === 'complete';
  const gfeStatus = row.gfe_status || 'not_started';
  const paymentStatus = row.payment_status || 'pending';

  return {
    id: row.id,
    reference: row.id,
    client: pickName(customer) || ext.client || 'Client',
    address: pickAddress(customer) || pickAddress(ext),
    city: pickCity(customer) || pickCity(ext) || ext.market || '',
    zip: pickZip(customer) || pickZip(ext),
    time: timeLabel,
    therapy: pickTherapy(ext, row.protocol_key || 'Avalon protocol'),
    addons: ext.addons || [],
    guests: Number(ext.guests || 1),
    total: Number(row.visit_subtotal_cents || 0) / 100,
    value: Number(row.visit_subtotal_cents || 0) / 100,
    status,
    intake: intakeDone ? 'Done' : 'Pending',
    consent: consentDone ? 'Done' : 'Pending',
    gfe: gfeStatus === 'cleared' ? 'Cleared' : 'Pending',
    nurse: row._nurseName || 'Unassigned',
    payment: /paid|captured|cleared/i.test(paymentStatus) || row.deposit_paid_at ? 'Paid' : paymentStatus,
    startsAt: row.starts_at || null,
    acuityAppointmentId: row.acuity_appointment_id || null,
  };
}

function shapeNurseForBrain(profile = {}, providerExtras = {}) {
  return {
    id: profile.id,
    name: profile.full_name || profile.preferred_name || profile.email || 'Nurse',
    phone: profile.phone || '',
    email: profile.email || '',
    status: profile.status === 'active' ? 'Available' : (profile.status || 'Unknown'),
    role: profile.role,
    area: providerExtras.area || profile.city || '',
    city: profile.city || '',
    kit: providerExtras.kit || 'Standard',
    certifications: providerExtras.certifications || [],
    protocols: providerExtras.protocols || providerExtras.scope_tags || [],
    skills: providerExtras.skills || [],
    visits: Number(providerExtras.visits || 0),
  };
}

function shapeInventoryForBrain(row = {}) {
  return {
    id: row.id,
    name: row.name || '',
    detail: row.category || row.sku || '',
    note: row.notes || row.supplier || '',
    qty: Number(row.qty || 0),
    minLevel: Number(row.min_level || row.minLevel || 0),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const { db, tenantId } = authed;

  const dataSources = {
    appointments: { table: 'appointments', count: 0, missing: false },
    nurses: { table: 'profiles', count: 0, missing: false },
    inventory: { table: 'items', count: 0, missing: false },
  };

  const horizonIso = new Date(Date.now() + HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const lookbackIso = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  let appointments = [];
  let nurses = [];
  let inventory = [];
  const warnings = [];

  // ── 1. Upcoming open appointments ──────────────────────────────────────────
  try {
    let q = db.from('appointments')
      .select('id, tenant_id, status, starts_at, protocol_key, provider_profile_id, payment_status, deposit_paid_at, gfe_status, visit_subtotal_cents, deposit_amount_cents, balance_due_cents, acuity_appointment_id, external_payload')
      .gte('starts_at', lookbackIso)
      .lte('starts_at', horizonIso)
      .not('status', 'in', '("archived","cancelled","canceled","completed","complete")')
      .order('starts_at', { ascending: true })
      .limit(APPT_LIMIT);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
    if (error) {
      if (isMissingRelation(error)) {
        dataSources.appointments.missing = true;
        warnings.push('appointments table missing — no open requests visible');
      } else { throw error; }
    } else {
      appointments = data || [];
      dataSources.appointments.count = appointments.length;
    }
  } catch (err) {
    console.warn('[admin/shift-marketplace] appointments query failed',
      safeLogContext(err, 'shift_marketplace_appointments_failed'));
    warnings.push(`appointments query failed: ${safeErrorCode(err)}`);
  }

  // ── 2. Nurse roster ─────────────────────────────────────────────────────────
  try {
    let q = db.from('profiles')
      .select('id, email, full_name, phone, role, status, city')
      .in('role', NURSE_ROLES)
      .order('created_at', { ascending: true })
      .limit(NURSE_LIMIT);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
    if (error) {
      if (isMissingRelation(error)) {
        dataSources.nurses.missing = true;
        warnings.push('profiles table missing — no nurses to offer to');
      } else { throw error; }
    } else {
      nurses = data || [];
      dataSources.nurses.count = nurses.length;
    }
  } catch (err) {
    console.warn('[admin/shift-marketplace] profiles query failed',
      safeLogContext(err, 'shift_marketplace_profiles_failed'));
    warnings.push(`profiles query failed: ${safeErrorCode(err)}`);
  }

  // Optional: enrich nurses with provider_profiles (kit/scope/etc). Best-effort.
  const providerById = new Map();
  if (nurses.length) {
    try {
      let q = db.from('provider_profiles')
        .select('profile_id, provider_role, credential_status, scope_tags, active')
        .in('profile_id', nurses.map((n) => n.id));
      if (tenantId) q = q.eq('tenant_id', tenantId);
      const { data, error } = await q;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (row.profile_id) providerById.set(row.profile_id, {
            kit: row.credential_status === 'clear' ? 'Standard' : 'Pending',
            protocols: row.scope_tags || [],
            scope_tags: row.scope_tags || [],
          });
        }
      }
    } catch {
      // Non-fatal: nurses will use defaults from shapeNurseForBrain.
    }
  }

  // ── 3. Inventory (best-effort) ──────────────────────────────────────────────
  try {
    const { data, error } = await db.from('items')
      .select('id, name, category, sku, notes, supplier, qty, min_level')
      .limit(INVENTORY_LIMIT);
    if (error) {
      if (isMissingRelation(error)) {
        dataSources.inventory.missing = true;
        warnings.push('items (inventory) table missing — kit factor scoring degraded');
      } else { throw error; }
    } else {
      inventory = data || [];
      dataSources.inventory.count = inventory.length;
    }
  } catch (err) {
    console.warn('[admin/shift-marketplace] inventory query failed',
      safeLogContext(err, 'shift_marketplace_inventory_failed'));
    warnings.push(`inventory query failed: ${safeErrorCode(err)}`);
  }

  // ── 4. Stitch in nurse names for accepted appts so the brain marks them so. ──
  if (appointments.length && nurses.length) {
    const nameById = new Map(nurses.map((n) => [n.id, n.full_name || n.email]));
    for (const appt of appointments) {
      if (appt.provider_profile_id && nameById.has(appt.provider_profile_id)) {
        appt._nurseName = nameById.get(appt.provider_profile_id);
      }
    }
  }

  // ── 5. Hand off to the brain ────────────────────────────────────────────────
  const shapedRequests = appointments.map(shapeAppointmentForBrain);
  const shapedNurses = nurses.map((n) => shapeNurseForBrain(n, providerById.get(n.id) || {}));
  const shapedInventory = inventory.map(shapeInventoryForBrain);

  let snapshot;
  try {
    snapshot = buildShiftMarketplaceSnapshot({
      requests: shapedRequests,
      nurses: shapedNurses,
      inventory: shapedInventory,
    });
  } catch (err) {
    console.warn('[admin/shift-marketplace] brain failed',
      safeLogContext(err, 'shift_marketplace_brain_failed'));
    snapshot = {
      version: SHIFT_MARKETPLACE_VERSION,
      mode: SHIFT_MARKETPLACE_MODE,
      rules: SHIFT_MARKETPLACE_RULES,
      rows: [], offers: [], sendable: [], accepted: [], backup: [], hold: [],
      acceptedLocks: [], nurseInbox: [], escalations: [],
      metrics: { visits: 0, nurses: shapedNurses.length, offers: 0, sendable: 0, accepted: 0, backup: 0, hold: 0, escalations: 0, avgShiftValue: 0, routeHandoffs: 0 },
    };
    warnings.push(`brain build failed: ${safeErrorCode(err)}`);
  }

  return res.status(200).json({
    ...snapshot,
    dataSources,
    warnings,
    readOnly: true,
    horizonDays: HORIZON_DAYS,
    fetchedAt: new Date().toISOString(),
  });
}
