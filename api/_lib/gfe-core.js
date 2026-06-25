/**
 * gfe-core — shared logic for the GFE auto-assign + Acuity-as-record + profile
 * cache flow. No changes are required in Acuity: we discover the existing GFE
 * intake form's fields by matching their labels (status/date/provider/expiry/
 * pdf), so reads and writes adapt to whatever the clinic already has.
 */
import { getAppointment, acuityFetch } from '../_acuity.js';
import { createExamInvite, isQualiphyConfigured } from './qualiphy.js';

const GFE_VALID_DAYS = 365;

// ── booking category (Mobile / Plan / Events) from our appointment payload ──
export function bookingCategory(externalPayload = {}) {
  const appt = externalPayload.appointment || {};
  const type = String(appt.orderType || appt.appointmentType || '').toLowerCase();
  if (externalPayload.membership || type.includes('subscription') || type.includes('plan') || type.includes('member')) return 'plan';
  if (type.includes('event') || type.includes('group')) return 'events';
  return 'mobile';
}

// ── GFE validity (the fast-checkout gate) ──
export function gfeValid(gfe, now = new Date()) {
  if (!gfe || typeof gfe !== 'object') return false;
  const status = String(gfe.status || '').toLowerCase();
  if (!['approved', 'cleared', 'complete'].some((s) => status.includes(s))) return false;
  const exp = gfe.expiresAt ? new Date(gfe.expiresAt) : null;
  if (exp && !Number.isNaN(exp.getTime())) return exp.getTime() > now.getTime();
  // No explicit expiry — derive from clearedAt + 1yr.
  const cleared = gfe.clearedAt ? new Date(gfe.clearedAt) : null;
  if (cleared && !Number.isNaN(cleared.getTime())) return cleared.getTime() + GFE_VALID_DAYS * 86400000 > now.getTime();
  return false;
}

export function deriveExpiry(clearedAtIso) {
  const d = clearedAtIso ? new Date(clearedAtIso) : new Date();
  return new Date(d.getTime() + GFE_VALID_DAYS * 86400000).toISOString();
}

// ── Acuity GFE intake form discovery (by label keyword) ──
const FIELD_MATCHERS = {
  status: (n) => /status|approv|good\s*faith|gfe\b/i.test(n) && !/date|provider|expir|pdf|link|url/i.test(n),
  date: (n) => /gfe.*date|date.*gfe|exam.*date|cleared/i.test(n),
  provider: (n) => /provider|clinician|np\b|md\b|physician/i.test(n),
  expiry: (n) => /expir|valid.*(until|through)/i.test(n),
  pdf: (n) => /pdf|document|link|url|attachment/i.test(n),
};

// Read the GFE fields off an appointment's forms[] (no field ids needed).
export function readGfeFromAppointment(appt = {}) {
  const out = {};
  const forms = Array.isArray(appt.forms) ? appt.forms : [];
  for (const form of forms) {
    const isGfeForm = /gfe|good\s*faith/i.test(String(form.name || ''));
    const values = Array.isArray(form.values) ? form.values : [];
    for (const v of values) {
      const name = String(v.name || '');
      const value = String(v.value || '').trim();
      if (!value) continue;
      // Within a clearly-GFE form, the first matcher wins; otherwise require the
      // field name itself to mention GFE/good-faith to avoid cross-form bleed.
      for (const [key, match] of Object.entries(FIELD_MATCHERS)) {
        if (out[key]) continue;
        if (match(name) && (isGfeForm || /gfe|good\s*faith/i.test(name))) out[key] = value;
      }
    }
  }
  return out; // { status?, date?, provider?, expiry?, pdf? }
}

// Resolve our logical GFE fields → Acuity field IDs (for writing via PUT).
// Cached per warm lambda. Returns { status, date, provider, expiry, pdf } → id.
let _gfeFieldIdCache = null;
export async function resolveGfeFieldIds() {
  if (_gfeFieldIdCache) return _gfeFieldIdCache;
  let forms;
  try { forms = await acuityFetch('/forms'); } catch { return {}; }
  const ids = {};
  for (const form of (Array.isArray(forms) ? forms : [])) {
    const isGfeForm = /gfe|good\s*faith/i.test(String(form.name || ''));
    for (const f of (Array.isArray(form.fields) ? form.fields : [])) {
      const name = String(f.name || '');
      if (!isGfeForm && !/gfe|good\s*faith/i.test(name)) continue;
      for (const [key, match] of Object.entries(FIELD_MATCHERS)) {
        if (!ids[key] && match(name)) ids[key] = f.id;
      }
    }
  }
  _gfeFieldIdCache = ids;
  return ids;
}

// Write the GFE result into the Acuity appointment's form fields.
export async function writeGfeToAcuity(acuityAppointmentId, { status, date, provider, expiry, pdf }) {
  const ids = await resolveGfeFieldIds();
  const fields = [];
  if (ids.status && status) fields.push({ id: ids.status, value: status });
  if (ids.date && date) fields.push({ id: ids.date, value: date });
  if (ids.provider && provider) fields.push({ id: ids.provider, value: provider });
  if (ids.expiry && expiry) fields.push({ id: ids.expiry, value: expiry });
  if (ids.pdf && pdf) fields.push({ id: ids.pdf, value: pdf });
  if (!fields.length) return { ok: false, code: 'no_gfe_fields_resolved' };
  try {
    await acuityFetch(`/appointments/${acuityAppointmentId}?admin=true`, { method: 'PUT', body: JSON.stringify({ fields }) });
    return { ok: true, wrote: fields.length };
  } catch (err) {
    return { ok: false, code: 'acuity_write_failed', error: String(err?.message || err).slice(0, 200) };
  }
}

// Orchestrate on an Acuity appointment event: (1) sync any GFE recorded on the
// Acuity form down to the profile (covers NP-manual AND Qualiphy-written, since
// both write the same form), (2) cache the address, (3) auto-assign a Qualiphy
// GFE when the category toggle is on and the patient has none valid. Fully
// best-effort — the caller wraps it so it can never break the Acuity webhook.
export async function gfeSyncAndAssign({ db, appt, appointmentRow, tenantId, baseUrl, action }) {
  const payload = appointmentRow?.external_payload || {};
  const email = String(payload.contact?.email || appt?.email || '').trim().toLowerCase();
  const now = new Date();

  // (1) Sync GFE from the Acuity form → profile + our appointment row.
  const fromForm = readGfeFromAppointment(appt);
  if (fromForm.status) {
    const approved = /approv|clear|complete/i.test(fromForm.status);
    const clearedAt = (fromForm.date && new Date(fromForm.date).toString() !== 'Invalid Date')
      ? new Date(fromForm.date).toISOString() : now.toISOString();
    const gfeRecord = {
      status: approved ? 'approved' : fromForm.status.toLowerCase(),
      clearedAt,
      expiresAt: fromForm.expiry || (approved ? deriveExpiry(clearedAt) : null),
      provider: fromForm.provider || null,
      pdfUrl: fromForm.pdf || null,
      source: 'acuity',
    };
    await db.from('appointments').update({
      gfe_status: approved ? 'approved' : 'denied',
      external_payload: { ...payload, gfe: { ...(payload.gfe || {}), ...gfeRecord } },
      updated_at: now.toISOString(),
    }).eq('id', appointmentRow.id);
    if (approved && email) await db.from('profiles').update({ gfe: gfeRecord }).eq('email', email);
  }

  // (2) Cache the service address on the profile for fast checkout.
  const addr = payload.appointment?.address;
  if (addr && email) {
    await db.from('profiles').update({ saved_address: { raw: addr, ...(payload.appointment?.zip ? { zip: payload.appointment.zip } : {}) } }).eq('email', email);
  }

  // (3) Auto-assign Qualiphy — only on a fresh booking, only if no GFE yet.
  if (action !== 'scheduled') return;
  if (payload.gfe?.patientExamId || fromForm.status) return; // already assigned or already has a GFE
  if (!isQualiphyConfigured() || !tenantId) return;

  const { data: settings } = await db.from('gfe_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
  if (!settings) return;
  const category = bookingCategory(payload);
  const toggle = { mobile: settings.require_mobile, plan: settings.require_plan, events: settings.require_events }[category];
  if (!toggle) return; // OFF → Avalon NP handles it in Acuity

  // No reassign if the profile already has a valid GFE.
  if (email) {
    const { data: prof } = await db.from('profiles').select('gfe').eq('email', email).maybeSingle();
    if (gfeValid(prof?.gfe, now)) return;
  }

  const dob = payload.contact?.dob || null;
  if (!dob) { console.warn('[gfe] skip auto-assign: no dob on file', { email }); return; }
  const examIds = Array.isArray(settings.qualiphy_exam_ids) && settings.qualiphy_exam_ids.length ? settings.qualiphy_exam_ids : [4106];
  const teleState = (String(payload.appointment?.state || '').slice(0, 2) || 'CA').toUpperCase();
  const secret = process.env.QUALIPHY_WEBHOOK_SECRET;
  const webhookUrl = secret && baseUrl ? `${baseUrl}/api/webhooks/qualiphy-inbound?secret=${encodeURIComponent(secret)}` : undefined;

  const res = await createExamInvite({
    exams: examIds,
    firstName: appt?.firstName || payload.contact?.firstName,
    lastName: appt?.lastName || payload.contact?.lastName,
    email,
    dob,
    phone: appt?.phone || payload.contact?.phone,
    teleState,
    webhookUrl,
  });
  if (res.ok) {
    const patientExamId = res.data?.patient_exams?.[0]?.patient_exam_id || null;
    await db.from('appointments').update({
      gfe_status: 'in_progress',
      external_payload: { ...payload, gfe: { ...(payload.gfe || {}), patientExamId, meetingUrl: res.data?.meeting_url || null, source: 'qualiphy', assignedAt: now.toISOString() } },
      updated_at: now.toISOString(),
    }).eq('id', appointmentRow.id);
  } else {
    console.warn('[gfe] qualiphy exam_invite failed', { code: res.code, status: res.status });
  }
}

export { getAppointment };
