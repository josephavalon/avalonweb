/**
 * GET/POST /api/admin/events/management
 *
 * Avalon-only event control plane. Organizers use /api/events/organizer,
 * which cannot publish events, configure clinical tiers, or change an
 * Avalon-locked admission price.
 */
import { requireAdmin } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';

const STATUSES = new Set(['draft', 'presale', 'public', 'sold_out', 'closed']);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function text(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function count(value, { nullable = false, max = 1_000_000 } = {}) {
  if (nullable && (value === '' || value == null)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : undefined;
}

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function payload(db, tenantId) {
  let query = db.from('event_containers').select('*').order('created_at', { ascending: false });
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const { data: containers, error } = await query;
  if (error) throw error;
  const ids = (containers || []).map((item) => item.id);
  if (!ids.length) return { events: [] };

  const [{ data: tiers }, { data: visits }, { data: promoters }, { data: privateRows }, { data: documents }] = await Promise.all([
    db.from('event_tiers').select('id, container_id, name, description, price_cents, allocation, service_id, experience_only, price_locked, active').in('container_id', ids).order('price_cents'),
    db.from('event_visits').select('container_id, tier_id, status').in('container_id', ids).in('status', ['held', 'pending', 'confirmed', 'served']),
    db.from('event_promoters').select('container_id, profile_id').in('container_id', ids),
    db.from('event_container_private').select('container_id, run_of_show').in('container_id', ids),
    db.from('event_documents').select('container_id, kind, status').in('container_id', ids),
  ]);

  const profileIds = [...new Set((promoters || []).map((item) => item.profile_id))];
  const serviceIds = [...new Set((tiers || []).map((item) => item.service_id).filter(Boolean))];
  const [{ data: profiles }, { data: services }] = await Promise.all([
    profileIds.length ? db.from('profiles').select('id, email').in('id', profileIds) : Promise.resolve({ data: [] }),
    serviceIds.length ? db.from('event_services').select('id, slug, name, requires_gfe, back_on_floor_minutes').in('id', serviceIds) : Promise.resolve({ data: [] }),
  ]);
  const emails = new Map((profiles || []).map((item) => [item.id, item.email]));
  const serviceMap = new Map((services || []).map((item) => [item.id, item]));
  const sold = new Map();
  for (const visit of visits || []) sold.set(visit.tier_id, (sold.get(visit.tier_id) || 0) + 1);

  return {
    events: (containers || []).map((container) => {
      const organizer = (promoters || []).find((item) => item.container_id === container.id);
      const eventPrivate = (privateRows || []).find((item) => item.container_id === container.id);
      const eventDocuments = (documents || []).filter((item) => item.container_id === container.id);
      const eventTiers = (tiers || []).filter((item) => item.container_id === container.id).map((item) => {
        const service = item.service_id ? serviceMap.get(item.service_id) : null;
        return {
          id: item.id, name: item.name, description: item.description || '', priceCents: item.price_cents,
          allocation: item.allocation, sold: sold.get(item.id) || 0, serviceId: service?.slug || item.service_id || '',
          requiresGfe: Boolean(service?.requires_gfe), backOnFloorMinutes: service?.back_on_floor_minutes ?? null,
          priceLocked: Boolean(item.price_locked), active: item.active,
        };
      });
      return {
        id: container.id, slug: container.slug, name: container.name, status: container.status,
        capacity: container.capacity, startsAt: container.starts_at, endsAt: container.ends_at,
        venue: container.venue || '', hostName: container.host_name || '', clinicalLead: container.clinical_lead_id ? 'Assigned' : '',
        organizerEmail: organizer ? emails.get(organizer.profile_id) || '' : '', organizerStatus: organizer ? 'active' : 'none',
        logistics: eventPrivate?.run_of_show?.organizer_logistics || {},
        documents: {
          coiCount: eventDocuments.filter((item) => item.kind === 'coi').length,
          coiStatus: eventDocuments.find((item) => item.kind === 'coi')?.status || 'not_uploaded',
          floorPlanCount: eventDocuments.filter((item) => item.kind === 'floor_plan').length,
          venuePhotoCount: eventDocuments.filter((item) => item.kind === 'venue_photo').length,
          venueRequirementCount: eventDocuments.filter((item) => item.kind === 'venue_requirements').length,
        },
        experienceTickets: eventTiers.filter((item) => !item.serviceId),
        clinicalTickets: eventTiers.filter((item) => Boolean(item.serviceId)),
      };
    }),
  };
}

export default async function handler(req, res) {
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  const { db, tenantId } = authed;
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await payload(db, tenantId)) });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const action = text(body.action, 40);
    if (action === 'create_event') {
      const name = text(body.name, 120);
      const slug = text(body.slug, 120).toLowerCase();
      const capacity = count(body.capacity, { nullable: true, max: 100_000 });
      const startsAt = iso(body.startsAt);
      const endsAt = iso(body.endsAt);
      if (!name || !SLUG_RE.test(slug)) return res.status(400).json({ error: 'A valid event name and URL slug are required.' });
      if (capacity === undefined || startsAt === undefined || endsAt === undefined) return res.status(400).json({ error: 'Review the capacity and event dates.' });
      if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return res.status(400).json({ error: 'End time must be after start time.' });
      const { data: created, error } = await db.from('event_containers').insert({
        tenant_id: tenantId, name, slug, status: 'draft', capacity, starts_at: startsAt, ends_at: endsAt,
        venue: text(body.venue, 180) || null, host_name: text(body.hostName, 120) || null,
        description_blocks: {}, created_by: authed.user?.id || null,
      }).select('id').single();
      if (error) throw error;
      await writeAuditEvent(db, { tenantId, actorProfileId: authed.user?.id || null, action: 'event_admin_create', entityType: 'event_container', entityId: created.id, payload: { slug } });
      return res.status(200).json({ ok: true, ...(await payload(db, tenantId)) });
    }

    const containerId = text(body.containerId, 80);
    let containerQuery = db.from('event_containers').select('*').eq('id', containerId);
    if (tenantId) containerQuery = containerQuery.eq('tenant_id', tenantId);
    const { data: container } = await containerQuery.maybeSingle();
    if (!container) return res.status(404).json({ error: 'Event not found.' });

    if (action === 'set_status') {
      const status = text(body.status, 30);
      if (!STATUSES.has(status)) return res.status(400).json({ error: 'Invalid event status.' });
      const { error } = await db.from('event_containers').update({ status, updated_at: new Date().toISOString() }).eq('id', container.id);
      if (error) throw error;
      await writeAuditEvent(db, { tenantId: container.tenant_id, actorProfileId: authed.user?.id || null, action: 'event_admin_status', entityType: 'event_container', entityId: container.id, payload: { from: container.status, to: status } });
    } else if (action === 'save_tier') {
      const clinical = body.clinical === true;
      const tierId = text(body.tierId, 80);
      const priceCents = count(body.priceCents, { max: 10_000_000 });
      const allocation = count(body.allocation, { nullable: true, max: 100_000 });
      const name = text(body.name, 100);
      if (!name || priceCents === undefined || allocation === undefined) return res.status(400).json({ error: 'Review the tier name, price, and allocation.' });

      let service = null;
      if (clinical) {
        const serviceRef = text(body.serviceId, 120);
        const serviceQuery = db.from('event_services').select('*').eq('active', true);
        const { data } = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(serviceRef)
          ? await serviceQuery.eq('id', serviceRef).maybeSingle()
          : await serviceQuery.eq('slug', serviceRef).maybeSingle();
        if (!data) return res.status(400).json({ error: 'Choose an active Avalon clinical service.' });
        service = data;
        const servicePatch = {
          default_price_cents: priceCents,
          back_on_floor_minutes: count(body.backOnFloorMinutes, { nullable: true, max: 1440 }),
          requires_gfe: body.requiresGfe !== false,
        };
        if (servicePatch.back_on_floor_minutes === undefined) return res.status(400).json({ error: 'Enter a valid back-on-floor estimate.' });
        const { error } = await db.from('event_services').update(servicePatch).eq('id', service.id);
        if (error) throw error;
      }

      const tierPatch = {
        name, description: text(body.description, 320) || null, price_cents: priceCents, allocation,
        service_id: clinical ? service.id : null, experience_only: !clinical,
        member_gated: false, application_gated: false, price_locked: clinical ? true : body.priceLocked === true,
        active: body.active !== false,
      };
      const result = tierId
        ? await db.from('event_tiers').update(tierPatch).eq('id', tierId).eq('container_id', container.id)
        : await db.from('event_tiers').insert({ ...tierPatch, tenant_id: container.tenant_id, container_id: container.id });
      if (result.error) throw result.error;
      await writeAuditEvent(db, { tenantId: container.tenant_id, actorProfileId: authed.user?.id || null, action: clinical ? 'event_admin_clinical_tier' : 'event_admin_experience_tier', entityType: 'event_tier', entityId: tierId || null, payload: { container_id: container.id, price_locked: tierPatch.price_locked } });
    } else {
      return res.status(400).json({ error: 'Unknown event action.' });
    }

    return res.status(200).json({ ok: true, ...(await payload(db, tenantId)) });
  } catch (error) {
    console.error('[admin/events/management]', error?.message || error);
    return res.status(error?.status || 500).json({ error: 'Event administration failed.', code: safeErrorCode(error, 'event_admin_failed') });
  }
}
