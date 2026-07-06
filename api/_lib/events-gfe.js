/**
 * Events GFE pathway resolution + Acuity GFE appointment sync (ET3).
 *
 * PHI LAW: this module never reads or writes health content. GFE intake lives
 * in Acuity/Qualiphy under their BAAs; event_visits carries only the pointer
 * (gfe_acuity_appt_id / gfe_qualiphy_ref) and the gfe_status enum, and every
 * status change goes through the audited transition_event_visit RPC.
 */
import { safeLogContext } from './safe-error.js';

const GFE_PATHWAYS = new Set(['acuity_np', 'qualiphy_auto']);

/**
 * Resolve which GFE pathway a visit should take. Precedence (10A):
 *   1. per-event override      — container.gfe_overrides.pathway
 *   2. service default         — event_services.gfe_pathway
 *   3. category default        — the tenant GFE settings store
 *      (api/admin/gfe/settings.js → gfe_settings row): the `events` toggle ON
 *      means Qualiphy auto-conducts the GFE; OFF means an Avalon NP does it in
 *      Acuity. Accepts both the API shape ({events}) and the raw row
 *      ({require_events}). No settings at all → 'acuity_np'.
 */
export function resolveGfePathway({ settings = null, container = null, service = null } = {}) {
  const override = container?.gfe_overrides?.pathway;
  if (GFE_PATHWAYS.has(override)) return override;
  if (GFE_PATHWAYS.has(service?.gfe_pathway)) return service.gfe_pathway;
  if (settings?.events === true || settings?.require_events === true) return 'qualiphy_auto';
  return 'acuity_np';
}

/**
 * PLACEHOLDER — Qualiphy auto-conduct is not wired yet (plan placeholder
 * rule). Env-gated on QUALIPHY_API_KEY: without credentials it reports the
 * standard not-configured reason; with credentials present it still refuses
 * (not implemented) rather than pretending a GFE happened. Callers must treat
 * `placeholder: true` as "fall back to the acuity_np pathway".
 */
export async function conductQualiphyGfe(visit, { env = process.env } = {}) {
  if (!env.QUALIPHY_API_KEY) {
    return { ok: false, placeholder: true, reason: 'qualiphy_credentials_not_configured' };
  }
  return {
    ok: false,
    placeholder: true,
    reason: 'qualiphy_conduct_not_implemented',
    visitId: visit?.id || null,
  };
}

/** Pure: parse ACUITY_EVENTS_GFE_TYPE_IDS (comma-separated) into id strings. */
export function parseEventsGfeTypeIds(envValue = '') {
  return String(envValue || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Pure: is this Acuity appointment an EVENTS GFE appointment? Matches the
 * appointment's type id against the known events GFE type ids (numbers and
 * strings compare loosely — Acuity sends both).
 */
export function isEventsGfeAppointment(appt, typeIds = []) {
  const id = String(appt?.appointmentTypeID ?? appt?.appointmentTypeId ?? '').trim();
  if (!id) return false;
  return typeIds.map((t) => String(t).trim()).includes(id);
}

/**
 * Known events GFE appointment type ids: event_services rows with an
 * acuity_appointment_type_id, unioned with the ACUITY_EVENTS_GFE_TYPE_IDS env
 * escape hatch. Called once per webhook invocation (the per-invocation cache).
 */
export async function loadEventsGfeTypeIds(db, { env = process.env } = {}) {
  const ids = parseEventsGfeTypeIds(env.ACUITY_EVENTS_GFE_TYPE_IDS);
  if (!db) return [...new Set(ids)];
  try {
    const { data, error } = await db
      .from('event_services')
      .select('acuity_appointment_type_id')
      .not('acuity_appointment_type_id', 'is', null);
    if (error) throw error;
    for (const row of data || []) {
      const id = String(row.acuity_appointment_type_id || '').trim();
      if (id) ids.push(id);
    }
  } catch (err) {
    console.warn('[events-gfe] type-id load failed', safeLogContext(err, 'events_gfe_type_ids_failed'));
  }
  return [...new Set(ids)];
}

async function transitionGfe(db, visitId, to, meta) {
  const { data, error } = await db.rpc('transition_event_visit', {
    p_visit_id: visitId, p_field: 'gfe_status', p_to: to, p_actor: null, p_meta: meta,
  });
  if (error) throw error;
  return data;
}

/**
 * Sync one events GFE Acuity appointment onto its event_visit:
 *   scheduled/rescheduled/changed → invited → scheduled
 *   canceled                      → scheduled → invited (reset)
 *
 * Match order: pointer (gfe_acuity_appt_id) first; then attendee email on a
 * FUTURE container with gfe_status in (invited, scheduled), closest start
 * first — and stamp the pointer for next time. Returns { matched, visitId?,
 * transitioned? }.
 */
export async function syncEventsGfeAppointment(db, { apptId, action, email = '', now = new Date() }) {
  const idStr = String(apptId);

  let { data: visit, error } = await db
    .from('event_visits')
    .select('id, gfe_status, container_id')
    .eq('gfe_acuity_appt_id', idStr)
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (!visit && email) {
    const { data: candidates, error: candErr } = await db
      .from('event_visits')
      .select('id, gfe_status, container_id, event_containers:container_id (starts_at)')
      .ilike('attendee_email', String(email).trim())
      .in('gfe_status', ['invited', 'scheduled']);
    if (candErr) throw candErr;
    const nowMs = new Date(now).getTime();
    const upcoming = (candidates || [])
      .filter((c) => {
        const startsAt = c.event_containers?.starts_at;
        return startsAt && new Date(startsAt).getTime() > nowMs;
      })
      .sort((a, b) => new Date(a.event_containers.starts_at) - new Date(b.event_containers.starts_at));
    visit = upcoming[0] || null;
    if (visit) {
      const { error: stampErr } = await db
        .from('event_visits')
        .update({ gfe_acuity_appt_id: idStr, updated_at: new Date(now).toISOString() })
        .eq('id', visit.id);
      if (stampErr) throw stampErr;
    }
  }

  if (!visit) return { matched: false };

  const meta = { via: 'acuity_webhook', action, acuity_appt_id: idStr };
  if (action === 'canceled') {
    if (visit.gfe_status === 'scheduled') {
      await transitionGfe(db, visit.id, 'invited', meta);
      return { matched: true, visitId: visit.id, transitioned: 'scheduled->invited' };
    }
    return { matched: true, visitId: visit.id, transitioned: null };
  }

  // scheduled | rescheduled | changed
  if (visit.gfe_status === 'invited') {
    await transitionGfe(db, visit.id, 'scheduled', meta);
    return { matched: true, visitId: visit.id, transitioned: 'invited->scheduled' };
  }
  return { matched: true, visitId: visit.id, transitioned: null };
}
