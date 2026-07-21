/**
 * /api/admin/clients/[id]
 *
 * God-view of a single client/patient for staff and admin operators. Mirrors
 * the shape of /api/me/profile (so the admin Client Detail page can reuse the
 * Account form primitives) but joins in the admin-only context: recent
 * appointments, the credit ledger, Stripe payment methods, and the most
 * recent audit events scoped to this profile.
 *
 * GET  — requireStaff. Returns the fat detail object. Always emits an
 *        `admin_client_read` audit row (PHI-touched).
 * PATCH — staff may edit the `phi.nurseNotes` field only. Admin tier may edit
 *        identity, address, DOB, emergency contact, the rest of PHI, comm
 *        prefs, status, and role. Every accepted patch emits an
 *        `admin_client_edit` audit row with hashes of the before/after values
 *        — we never store the raw values in the audit payload because the
 *        audit log is queryable by staff and would re-leak PHI.
 *
 * The route param `id` may be a profile UUID or an email — we try UUID first
 * (the common case from the master list) and fall back to email lookup so the
 * page can be linked from anywhere that has just the customer email.
 */

import crypto from 'crypto';
import Stripe from 'stripe';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { requireStaff } from '../../_lib/supabase-auth.js';
import {
  getMemberCreditBalance,
  listMemberCreditLedger,
} from '../../_lib/member-credits.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROFILE_COLUMNS = `
  id, email, phone, role, status, tenant_id,
  full_name, preferred_name, address, date_of_birth,
  emergency_contact, phi, comm_prefs, stripe_customer_id,
  guest_profile, hubspot_contact_id, hubspot_synced_at,
  created_at, updated_at
`;

function dollarsFromCents(cents) {
  if (cents == null) return null;
  return Math.round(Number(cents)) / 100;
}

function hashValue(value) {
  const json = JSON.stringify(value ?? null);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

function toClientShape(row) {
  if (!row) return null;
  return {
    id: row.id || null,
    email: row.email || null,
    phone: row.phone || null,
    fullName: row.full_name || null,
    preferredName: row.preferred_name || null,
    address: row.address || null,
    dateOfBirth: row.date_of_birth || null,
    role: row.role || 'client',
    status: row.status || 'active',
    emergencyContact: row.emergency_contact || null,
    phi: row.phi || null,
    commPrefs: row.comm_prefs || null,
    stripeCustomerId: row.stripe_customer_id || null,
    tenantId: row.tenant_id || null,
    guestProfile: row.guest_profile || null,
    hubspotContactId: row.hubspot_contact_id || null,
    hubspotSyncedAt: row.hubspot_synced_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function shapeAppointment(row) {
  const payload = row.external_payload || {};
  const appointment = payload.appointment || {};
  return {
    id: row.id,
    status: row.status,
    startsAt: row.starts_at,
    service: payload.primaryService || row.protocol_key || 'Avalon Visit',
    provider: appointment.assignedNurseName || appointment.providerName || '',
    paymentStatus: row.payment_status,
    visitSubtotal: dollarsFromCents(row.visit_subtotal_cents),
    depositAmount: dollarsFromCents(row.deposit_amount_cents),
    balanceDue: dollarsFromCents(row.balance_due_cents),
    acuityAppointmentId: row.acuity_appointment_id,
    createdAt: row.created_at,
  };
}

function shapeAuditRow(row) {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    phiTouched: !!row.phi_touched,
    actorProfileId: row.actor_profile_id,
    occurredAt: row.created_at,
    fields: Array.isArray(row.payload?.fields) ? row.payload.fields : null,
  };
}

async function loadProfile(db, idOrEmail) {
  const id = String(idOrEmail || '').trim();
  if (!id) return { data: null, error: null };
  if (UUID_RE.test(id)) {
    const { data, error } = await db.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
    if (data || error) return { data, error };
  }
  // Fallback to email match.
  const { data, error } = await db.from('profiles').select(PROFILE_COLUMNS).ilike('email', id).maybeSingle();
  return { data, error };
}

async function listRecentAppointments(db, { tenantId, email, profileId }) {
  if (!db) return [];
  let query = db.from('appointments')
    .select('id, tenant_id, status, starts_at, protocol_key, payment_status, visit_subtotal_cents, deposit_amount_cents, balance_due_cents, acuity_appointment_id, external_payload, created_at')
    .order('starts_at', { ascending: false, nullsFirst: false })
    .limit(50);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  // Appointments are anonymous at booking — they're matched to a client by
  // email (in external_payload.contact.email) primarily, profile_id only if
  // we've already linked them. We match on either to be safe.
  if (email) {
    query = query.or(`external_payload->contact->>email.eq.${email},profile_id.eq.${profileId || '00000000-0000-0000-0000-000000000000'}`);
  } else if (profileId) {
    query = query.eq('profile_id', profileId);
  } else {
    return [];
  }
  const { data, error } = await query;
  if (error) {
    console.warn('[admin/clients/[id]] appointments query failed', safeLogContext(error, 'admin_client_appts_failed'));
    return [];
  }
  return (data || []).map(shapeAppointment);
}

async function listPaymentMethods(stripeCustomerId) {
  if (!stripeCustomerId || !process.env.STRIPE_SECRET_KEY) return [];
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const page = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
      limit: 5,
    });
    return (page?.data || []).map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || '',
      last4: pm.card?.last4 || '',
      expMonth: pm.card?.exp_month || null,
      expYear: pm.card?.exp_year || null,
    }));
  } catch (err) {
    console.warn('[admin/clients/[id]] stripe paymentMethods.list failed', safeLogContext(err, 'admin_client_pm_failed'));
    return [];
  }
}

async function loadSubscriptionSummary(stripeCustomerId) {
  if (!stripeCustomerId || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, limit: 3, status: 'all' });
    const live = (subs?.data || []).find((s) => ['active', 'trialing', 'past_due', 'paused'].includes(s.status))
      || (subs?.data || [])[0];
    if (!live) return null;
    const item = live.items?.data?.[0];
    return {
      id: live.id,
      status: live.status,
      currentPeriodEnd: live.current_period_end ? new Date(live.current_period_end * 1000).toISOString() : null,
      priceId: item?.price?.id || null,
      priceNickname: item?.price?.nickname || item?.price?.lookup_key || null,
      unitAmount: dollarsFromCents(item?.price?.unit_amount),
      interval: item?.price?.recurring?.interval || null,
    };
  } catch (err) {
    console.warn('[admin/clients/[id]] stripe subscriptions.list failed', safeLogContext(err, 'admin_client_sub_failed'));
    return null;
  }
}

async function listAuditTrail(db, { tenantId, profileId }) {
  if (!db || !profileId) return [];
  // Two passes — by entity_id (the canonical link for our own writes) and by
  // payload.profileId for older rows. Merge and sort, take 20.
  let q1 = db.from('audit_events')
    .select('id, action, entity_type, entity_id, phi_touched, actor_profile_id, payload, created_at')
    .eq('entity_id', profileId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (tenantId) q1 = q1.eq('tenant_id', tenantId);
  const { data: byEntity, error: byEntityErr } = await q1;
  if (byEntityErr) {
    console.warn('[admin/clients/[id]] audit query failed', safeLogContext(byEntityErr, 'admin_client_audit_failed'));
    return [];
  }
  return (byEntity || []).map(shapeAuditRow);
}

function buildAdminPatch(body = {}) {
  const patch = {};
  const fields = [];
  let phiTouched = false;
  const set = (key, dbCol, value, { phi = false } = {}) => {
    patch[dbCol] = value ?? null;
    fields.push(key);
    if (phi) phiTouched = true;
  };
  if (Object.prototype.hasOwnProperty.call(body, 'fullName')) set('fullName', 'full_name', body.fullName);
  if (Object.prototype.hasOwnProperty.call(body, 'preferredName')) set('preferredName', 'preferred_name', body.preferredName);
  if (Object.prototype.hasOwnProperty.call(body, 'phone')) set('phone', 'phone', body.phone);
  if (Object.prototype.hasOwnProperty.call(body, 'address')) set('address', 'address', body.address);
  if (Object.prototype.hasOwnProperty.call(body, 'dateOfBirth')) set('dateOfBirth', 'date_of_birth', body.dateOfBirth || null);
  if (Object.prototype.hasOwnProperty.call(body, 'emergencyContact')) set('emergencyContact', 'emergency_contact', body.emergencyContact, { phi: true });
  if (Object.prototype.hasOwnProperty.call(body, 'phi')) set('phi', 'phi', body.phi, { phi: true });
  if (Object.prototype.hasOwnProperty.call(body, 'commPrefs')) set('commPrefs', 'comm_prefs', body.commPrefs);
  if (Object.prototype.hasOwnProperty.call(body, 'status')) set('status', 'status', body.status);
  if (Object.prototype.hasOwnProperty.call(body, 'role')) set('role', 'role', body.role);
  return { patch, fields, phiTouched };
}

// Staff (non-admin) patch surface: nurseNotes only. We accept either
// `body.nurseNotes` (convenience) or `body.phi.nurseNotes` (Account-style)
// and merge into the existing phi blob without overwriting other clinical
// fields.
function buildStaffPatch(body = {}, current) {
  const explicitNotes = Object.prototype.hasOwnProperty.call(body, 'nurseNotes')
    ? body.nurseNotes
    : (body.phi && Object.prototype.hasOwnProperty.call(body.phi, 'nurseNotes') ? body.phi.nurseNotes : undefined);
  if (explicitNotes === undefined) {
    return { patch: {}, fields: [], phiTouched: false };
  }
  const existingPhi = (current && current.phi && typeof current.phi === 'object') ? current.phi : {};
  const nextPhi = { ...existingPhi, nurseNotes: explicitNotes ?? '' };
  return {
    patch: { phi: nextPhi },
    fields: ['phi.nurseNotes'],
    phiTouched: true,
  };
}

async function buildDetailPayload(db, profile) {
  if (!profile) return null;
  const client = toClientShape(profile);
  const tenantId = client.tenantId;
  const email = (client.email || '').toLowerCase();

  const [appointments, paymentMethods, subscription, creditBalance, creditLedger, auditTrail] = await Promise.all([
    listRecentAppointments(db, { tenantId, email, profileId: client.id }),
    listPaymentMethods(client.stripeCustomerId),
    loadSubscriptionSummary(client.stripeCustomerId),
    getMemberCreditBalance(db, { tenantId, profileId: client.id, email }).catch(() => 0),
    listMemberCreditLedger(db, { tenantId, profileId: client.id, email, limit: 20 }).catch(() => []),
    listAuditTrail(db, { tenantId, profileId: client.id }),
  ]);

  return {
    client,
    appointments,
    creditBalance,
    creditLedger,
    paymentMethods,
    subscription,
    auditTrail,
  };
}

export default async function handler(req, res) {
  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'Missing client id.' });

  if (req.method === 'GET') {
    const authed = await requireStaff(req, res);
    if (!authed) return;
    const { db, tenantId, user } = authed;
    try {
      const { data: row, error } = await loadProfile(db, id);
      if (error) throw error;
      if (!row) return res.status(404).json({ error: 'Client not found.' });
      // Tenant isolation: a staff/admin at tenant A may not read tenant B.
      if (tenantId && row.tenant_id && row.tenant_id !== tenantId) {
        return res.status(404).json({ error: 'Client not found.' });
      }
      const payload = await buildDetailPayload(db, row);
      await writeAuditEvent(db, {
        tenantId: row.tenant_id || tenantId || null,
        actorProfileId: user?.id || null,
        action: 'admin_client_read',
        entityType: 'profiles',
        entityId: row.id,
        phiTouched: true,
        payload: { route: 'api/admin/clients/[id]' },
      });
      return res.status(200).json(payload);
    } catch (err) {
      console.warn('[admin/clients/[id]] GET failed', safeLogContext(err, 'admin_client_get_failed'));
      return res.status(500).json({
        error: 'Could not load client.',
        code: safeErrorCode(err, 'admin_client_get_failed'),
      });
    }
  }

  if (req.method === 'PATCH') {
    // Staff may edit nurse notes; admin may edit everything else. We allow the
    // operator tier through requireStaff and then narrow per-field below.
    const authed = await requireStaff(req, res);
    if (!authed) return;
    const { db, tenantId, user, role } = authed;
    const body = (req.body && typeof req.body === 'object') ? req.body : {};

    try {
      const { data: current, error: readErr } = await loadProfile(db, id);
      if (readErr) throw readErr;
      if (!current) return res.status(404).json({ error: 'Client not found.' });
      if (tenantId && current.tenant_id && current.tenant_id !== tenantId) {
        return res.status(404).json({ error: 'Client not found.' });
      }

      // Determine patch surface by role.
      let patch;
      let fields;
      let phiTouched;
      if (role === 'admin') {
        ({ patch, fields, phiTouched } = buildAdminPatch(body));
      } else {
        // Staff: nurseNotes only. Reject anything else they try to send.
        const allowedKeys = new Set(['nurseNotes', 'phi']);
        const extraKeys = Object.keys(body).filter((k) => !allowedKeys.has(k));
        const phiExtras = body.phi && typeof body.phi === 'object'
          ? Object.keys(body.phi).filter((k) => k !== 'nurseNotes')
          : [];
        if (extraKeys.length || phiExtras.length) {
          return res.status(403).json({ error: 'Staff may edit nurse notes only. Ask an admin to change other fields.' });
        }
        ({ patch, fields, phiTouched } = buildStaffPatch(body, current));
      }

      if (!Object.keys(patch).length) {
        return res.status(400).json({ error: 'No editable fields in request body.' });
      }

      const beforeSnapshot = fields.reduce((acc, key) => {
        // Map back to a hashable view of the old value for each field.
        const map = {
          fullName: current.full_name,
          preferredName: current.preferred_name,
          phone: current.phone,
          address: current.address,
          dateOfBirth: current.date_of_birth,
          emergencyContact: current.emergency_contact,
          phi: current.phi,
          commPrefs: current.comm_prefs,
          status: current.status,
          role: current.role,
          'phi.nurseNotes': current.phi?.nurseNotes,
        };
        acc[key] = hashValue(map[key]);
        return acc;
      }, {});

      const { data: updated, error: writeErr } = await db.from('profiles')
        .update(patch)
        .eq('id', current.id)
        .select(PROFILE_COLUMNS)
        .maybeSingle();
      if (writeErr) throw writeErr;
      if (!updated) return res.status(500).json({ error: 'Update did not return a row.' });

      const afterSnapshot = fields.reduce((acc, key) => {
        const map = {
          fullName: updated.full_name,
          preferredName: updated.preferred_name,
          phone: updated.phone,
          address: updated.address,
          dateOfBirth: updated.date_of_birth,
          emergencyContact: updated.emergency_contact,
          phi: updated.phi,
          commPrefs: updated.comm_prefs,
          status: updated.status,
          role: updated.role,
          'phi.nurseNotes': updated.phi?.nurseNotes,
        };
        acc[key] = hashValue(map[key]);
        return acc;
      }, {});

      await writeAuditEvent(db, {
        tenantId: updated.tenant_id || tenantId || null,
        actorProfileId: user?.id || null,
        action: 'admin_client_edit',
        entityType: 'profiles',
        entityId: updated.id,
        phiTouched,
        // Never store raw values — only field names + before/after hashes.
        payload: {
          fields,
          beforeHash: beforeSnapshot,
          afterHash: afterSnapshot,
          actorRole: role,
        },
      });

      const payload = await buildDetailPayload(db, updated);
      return res.status(200).json(payload);
    } catch (err) {
      console.warn('[admin/clients/[id]] PATCH failed', safeLogContext(err, 'admin_client_patch_failed'));
      return res.status(500).json({
        error: 'Could not save client.',
        code: safeErrorCode(err, 'admin_client_patch_failed'),
      });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}

// Re-exported so siblings (credits route) can resolve a profile the same way
// without duplicating the UUID/email lookup.
export { loadProfile, buildDetailPayload, UUID_RE };
