/**
 * Organizer Event Hub API.
 *
 * Promoters only receive commercial/event content and aggregate sales facts.
 * No attendee identity, health-check state, clinical record, medical reason,
 * or staffing decision is selected or returned from this endpoint.
 *
 * Organizer-managed tickets are deliberately `experience_only` with no
 * clinical service_id. Avalon retains clinical catalog, pricing, publishing,
 * medical staffing, eligibility, care, billing, and refunds.
 */
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeErrorCode } from '../_lib/safe-error.js';

const ACTIVE_EVENT_STATUSES = new Set(['draft', 'presale', 'public', 'sold_out']);
const EDITABLE_EVENT_STATUSES = new Set(['draft', 'presale', 'public']);

const cleanText = (value, max) => String(value ?? '').trim().slice(0, max);
const cleanIso = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const cleanCount = (value, max) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= max ? number : null;
};

async function assignedContainer(authed, containerId) {
  let query = authed.db.from('event_containers').select('*').eq('id', containerId);
  if (authed.tenantId) query = query.eq('tenant_id', authed.tenantId);
  const { data: container, error } = await query.maybeSingle();
  if (error) throw error;
  if (!container) return null;
  if (authed.role === 'admin') return container;
  const { data: assignment } = await authed.db.from('event_promoters')
    .select('id').eq('profile_id', authed.user.id).eq('container_id', container.id).maybeSingle();
  return assignment ? container : null;
}

async function loadContainers(authed) {
  if (authed.role === 'admin') {
    let query = authed.db.from('event_containers').select('*').in('status', [...ACTIVE_EVENT_STATUSES]).order('starts_at', { ascending: true });
    if (authed.tenantId) query = query.eq('tenant_id', authed.tenantId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
  const { data: assignments, error: assignmentError } = await authed.db.from('event_promoters')
    .select('container_id').eq('profile_id', authed.user.id);
  if (assignmentError) throw assignmentError;
  const ids = (assignments || []).map((row) => row.container_id).filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await authed.db.from('event_containers').select('*').in('id', ids).order('starts_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

function salesByContainer(orders = [], experienceOrderIds = new Set()) {
  const result = new Map();
  for (const order of orders) {
    if (!experienceOrderIds.has(order.id)) continue;
    const current = result.get(order.container_id) || { paidOrders: 0, experienceSalesCents: 0, refundedOrders: 0 };
    if (['paid', 'partial_refund'].includes(order.status)) {
      current.paidOrders += 1;
      current.experienceSalesCents += Number(order.total_cents) || 0;
    }
    if (order.status === 'refunded') current.refundedOrders += 1;
    result.set(order.container_id, current);
  }
  return result;
}

function soldByTier(visits = []) {
  const result = new Map();
  for (const visit of visits) {
    if (!['confirmed', 'served'].includes(visit.status)) continue;
    result.set(visit.tier_id, (result.get(visit.tier_id) || 0) + 1);
  }
  return result;
}

async function hubPayload(authed) {
  const containers = await loadContainers(authed);
  const ids = containers.map((event) => event.id);
  if (!ids.length) return { events: [], privacyMode: 'aggregate-only', clinicalCommerce: 'avalon-controlled' };

  const [{ data: tiers, error: tierError }, { data: visits, error: visitError }, { data: orders, error: orderError }, { data: assets, error: assetError }, { data: privateRows, error: privateError }, { data: documents, error: documentError }] = await Promise.all([
    authed.db.from('event_tiers').select('id, container_id, name, description, price_cents, allocation, presale_opens_at, public_opens_at, experience_only, service_id, price_locked, active').in('container_id', ids).order('price_cents', { ascending: true }),
    authed.db.from('event_visits').select('container_id, tier_id, order_id, status').in('container_id', ids),
    authed.db.from('event_orders').select('id, container_id, total_cents, status').in('container_id', ids),
    authed.db.from('event_assets').select('container_id, status, kind').in('container_id', ids),
    authed.db.from('event_container_private').select('container_id, run_of_show').in('container_id', ids),
    authed.db.from('event_documents').select('container_id, kind, status').in('container_id', ids),
  ]);
  if (tierError || visitError || orderError || assetError || privateError || documentError) throw tierError || visitError || orderError || assetError || privateError || documentError;

  const experienceTierIds = new Set((tiers || [])
    .filter((tier) => tier.experience_only && !tier.service_id)
    .map((tier) => tier.id));
  const tierIdsByOrder = new Map();
  for (const visit of visits || []) {
    if (!visit.order_id) continue;
    const tierIds = tierIdsByOrder.get(visit.order_id) || [];
    tierIds.push(visit.tier_id);
    tierIdsByOrder.set(visit.order_id, tierIds);
  }
  // Only expose revenue from orders composed entirely of experience tickets.
  // Mixed or clinical orders remain Avalon-private, preventing even aggregate
  // clinical-service uptake from leaking into the organizer portal.
  const experienceOrderIds = new Set([...tierIdsByOrder.entries()]
    .filter(([, tierIds]) => tierIds.length > 0 && tierIds.every((tierId) => experienceTierIds.has(tierId)))
    .map(([orderId]) => orderId));
  const sales = salesByContainer(orders || [], experienceOrderIds);
  const sold = soldByTier(visits || []);
  return {
    privacyMode: 'aggregate-only',
    clinicalCommerce: 'avalon-controlled',
    events: containers.map((event) => {
      const eventTiers = (tiers || []).filter((tier) => (
        tier.container_id === event.id && tier.experience_only && !tier.service_id
      )).map((tier) => ({
        id: tier.id,
        name: tier.name,
        description: tier.description || '',
        priceCents: tier.price_cents,
        priceLocked: tier.price_locked,
        allocation: tier.allocation,
        presaleOpensAt: tier.presale_opens_at,
        publicOpensAt: tier.public_opens_at,
        experienceOnly: tier.experience_only,
        active: tier.active,
        sold: sold.get(tier.id) || 0,
      }));
      const eventAssets = (assets || []).filter((asset) => asset.container_id === event.id);
      const eventPrivate = (privateRows || []).find((row) => row.container_id === event.id);
      const eventDocuments = (documents || []).filter((document) => document.container_id === event.id);
      const sale = sales.get(event.id) || { paidOrders: 0, experienceSalesCents: 0, refundedOrders: 0 };
      return {
        id: event.id,
        slug: event.slug,
        name: event.name,
        status: event.status,
        capacity: event.capacity,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        venue: event.venue || '',
        hostName: event.host_name || '',
        cohosts: Array.isArray(event.cohosts) ? event.cohosts : [],
        descriptionBlocks: event.description_blocks || {},
        logistics: eventPrivate?.run_of_show?.organizer_logistics || {},
        documents: {
          coiCount: eventDocuments.filter((document) => document.kind === 'coi').length,
          coiStatus: eventDocuments.find((document) => document.kind === 'coi')?.status || 'not_uploaded',
          floorPlanCount: eventDocuments.filter((document) => document.kind === 'floor_plan').length,
          venuePhotoCount: eventDocuments.filter((document) => document.kind === 'venue_photo').length,
          venueRequirementCount: eventDocuments.filter((document) => document.kind === 'venue_requirements').length,
        },
        tickets: eventTiers,
        ticketsSold: eventTiers.reduce((sum, tier) => sum + tier.sold, 0),
        ...sale,
        assets: {
          live: eventAssets.filter((asset) => asset.status === 'live').length,
          pending: eventAssets.filter((asset) => asset.status === 'pending').length,
          pulled: eventAssets.filter((asset) => asset.status === 'pulled').length,
        },
      };
    }),
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const limit = await checkRateLimit({ key: `events-organizer:${clientIp(req)}`, windowMs: 60_000, max: 80 });
  if (!limit.ok) return res.status(429).json({ ok: false, error: 'Too many requests. Try again shortly.' });
  const authed = await getAuthedUser(req);
  if (!authed?.user) return res.status(401).json({ ok: false, error: 'Sign in required.' });
  const portalAccess = Array.isArray(authed.user.app_metadata?.portal_access) ? authed.user.app_metadata.portal_access : [];
  if (!['promoter', 'admin'].includes(authed.role) && !portalAccess.includes('organizer')) {
    return res.status(403).json({ ok: false, error: 'Organizer access required.' });
  }

  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await hubPayload(authed)) });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const action = cleanText(body.action, 40);
    const container = await assignedContainer(authed, cleanText(body.containerId, 80));
    if (!container) return res.status(404).json({ ok: false, error: 'Assigned event not found.' });
    if (!EDITABLE_EVENT_STATUSES.has(container.status)) {
      return res.status(409).json({ ok: false, error: 'This event is no longer editable.' });
    }

    if (action === 'update_details') {
      const startsAt = cleanIso(body.startsAt);
      const endsAt = cleanIso(body.endsAt);
      if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
        return res.status(400).json({ ok: false, error: 'End time must be after start time.' });
      }
      const description = cleanText(body.description, 1600);
      const vibe = cleanText(body.vibe, 320);
      const existingBlocks = container.description_blocks && !Array.isArray(container.description_blocks) ? container.description_blocks : {};
      const patch = {
        name: cleanText(body.name, 120) || container.name,
        host_name: cleanText(body.hostName, 120) || null,
        venue: cleanText(body.venue, 180) || null,
        starts_at: startsAt,
        ends_at: endsAt,
        cohosts: Array.isArray(body.cohosts) ? body.cohosts.slice(0, 12).map((value) => cleanText(value, 80)).filter(Boolean) : [],
        description_blocks: { ...existingBlocks, description, vibe },
        updated_at: new Date().toISOString(),
      };
      const { error } = await authed.db.from('event_containers').update(patch).eq('id', container.id);
      if (error) throw error;
      await authed.db.from('event_audit_log').insert({
        tenant_id: container.tenant_id, actor: authed.user.id, action: 'organizer_details_update',
        target_type: 'event_container', target_id: container.id, meta: { fields: Object.keys(patch) },
      });
      return res.status(200).json({ ok: true, ...(await hubPayload(authed)) });
    }

    if (action === 'update_logistics') {
      const eventType = ['private_party', 'venue_company', 'company_offsite', 'public_event'].includes(body.eventType)
        ? body.eventType
        : 'private_party';
      const expectedGuests = cleanCount(body.expectedGuests, 100_000);
      const requestedServiceCapacity = cleanCount(body.requestedServiceCapacity, 100_000);
      const logistics = {
        eventType,
        companyLegalName: cleanText(body.companyLegalName, 180),
        venueLegalName: cleanText(body.venueLegalName, 180),
        onsiteContactName: cleanText(body.onsiteContactName, 120),
        onsiteContactPhone: cleanText(body.onsiteContactPhone, 40),
        coiRequested: eventType === 'private_party' ? false : body.coiRequested === true,
        certificateHolder: cleanText(body.certificateHolder, 500),
        insuranceRequirements: cleanText(body.insuranceRequirements, 2000),
        coiDueDate: cleanText(body.coiDueDate, 20),
        coiPolicyExpiresAt: cleanText(body.coiPolicyExpiresAt, 20),
        expectedGuests,
        requestedServiceCapacity,
        loadInWindow: cleanText(body.loadInWindow, 160),
        layoutNotes: cleanText(body.layoutNotes, 2400),
        venueProvides: cleanText(body.venueProvides, 1600),
        avalonBringItems: Array.isArray(body.avalonBringItems) ? body.avalonBringItems.slice(0, 24).map((item) => cleanText(item, 100)).filter(Boolean) : [],
        avalonBrings: cleanText(body.avalonBrings, 1600),
        furnitureNeeded: body.furnitureNeeded === true,
        signageNeeded: body.signageNeeded === true,
        accessNotes: cleanText(body.accessNotes, 2400),
        upgradeRequests: cleanText(body.upgradeRequests, 2400),
      };
      const { data: existingPrivate } = await authed.db.from('event_container_private')
        .select('run_of_show').eq('container_id', container.id).maybeSingle();
      const runOfShow = existingPrivate?.run_of_show && !Array.isArray(existingPrivate.run_of_show)
        ? existingPrivate.run_of_show
        : {};
      const { error } = await authed.db.from('event_container_private').upsert({
        container_id: container.id,
        tenant_id: container.tenant_id,
        run_of_show: { ...runOfShow, organizer_logistics: logistics },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'container_id' });
      if (error) throw error;
      await authed.db.from('event_audit_log').insert({
        tenant_id: container.tenant_id, actor: authed.user.id, action: 'organizer_logistics_update',
        target_type: 'event_container_private', target_id: container.id,
        meta: { event_type: eventType, coi_requested: logistics.coiRequested, furniture_needed: logistics.furnitureNeeded, signage_needed: logistics.signageNeeded },
      });
      return res.status(200).json({ ok: true, ...(await hubPayload(authed)) });
    }

    if (action === 'save_ticket') {
      const priceCents = cleanCount(body.priceCents, 10_000_000);
      const allocation = body.allocation === '' || body.allocation == null ? null : cleanCount(body.allocation, 100_000);
      if (priceCents == null) return res.status(400).json({ ok: false, error: 'Enter a valid ticket price.' });
      if (body.allocation !== '' && body.allocation != null && allocation == null) return res.status(400).json({ ok: false, error: 'Enter a valid ticket allocation.' });
      const tierId = cleanText(body.tierId, 80);
      const tierPatch = {
        name: cleanText(body.name, 100),
        description: cleanText(body.description, 320) || null,
        price_cents: priceCents,
        allocation,
        presale_opens_at: cleanIso(body.presaleOpensAt),
        public_opens_at: cleanIso(body.publicOpensAt),
        experience_only: true,
        service_id: null,
        member_gated: false,
        application_gated: false,
        active: body.active !== false,
      };
      if (!tierPatch.name) return res.status(400).json({ ok: false, error: 'Ticket name is required.' });
      if (tierId) {
        const { data: existing } = await authed.db.from('event_tiers').select('id, experience_only, service_id, price_locked, price_cents')
          .eq('id', tierId).eq('container_id', container.id).maybeSingle();
        if (!existing) return res.status(404).json({ ok: false, error: 'Ticket tier not found.' });
        if (!existing.experience_only || existing.service_id) {
          return res.status(403).json({ ok: false, error: 'Clinical service pricing is managed by Avalon.' });
        }
        if (existing.price_locked && priceCents !== existing.price_cents) {
          return res.status(403).json({ ok: false, error: 'This admission price is locked by Avalon.' });
        }
        const { error } = await authed.db.from('event_tiers').update(tierPatch).eq('id', tierId).eq('container_id', container.id);
        if (error) throw error;
      } else {
        const { error } = await authed.db.from('event_tiers').insert({
          ...tierPatch, tenant_id: container.tenant_id, container_id: container.id,
        });
        if (error) throw error;
      }
      await authed.db.from('event_audit_log').insert({
        tenant_id: container.tenant_id, actor: authed.user.id, action: tierId ? 'organizer_ticket_update' : 'organizer_ticket_create',
        target_type: 'event_tier', target_id: tierId || null, meta: { container_id: container.id, experience_only: true },
      });
      return res.status(200).json({ ok: true, ...(await hubPayload(authed)) });
    }

    return res.status(400).json({ ok: false, error: 'Unknown organizer action.' });
  } catch (error) {
    console.error('[events/organizer]', error?.message || error);
    return res.status(error?.status || 500).json({ ok: false, error: 'Event Hub action failed.', code: safeErrorCode(error, 'organizer_hub_failed') });
  }
}
