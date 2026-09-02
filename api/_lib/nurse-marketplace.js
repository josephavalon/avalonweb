import crypto from 'crypto';
import { callNurseRpc, cleanText, requestError } from './nurse-workflow.js';

const OFFER_SELECT = 'id,shift_id,provider_profile_id,offer_terms_id,cohort_key,status,wave_key,expires_at,version,created_at,updated_at,acted_at';
const OFFER_STATUSES = Object.freeze(['pending', 'offered', 'delivered', 'viewed', 'accepted', 'declined', 'ignored', 'countered', 'expired', 'revoked']);

export function envEnabled(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return ['true', '1', 'yes'].includes(String(raw).trim().toLowerCase());
}

export function nurseMarketplaceCapabilities() {
  return {
    auto_shift_creation: envEnabled('NURSE_AUTO_SHIFT_CREATION_ENABLED'),
    offers: envEnabled('NURSE_SHIFT_OFFERS_ENABLED'),
    realtime_offer_alerts: envEnabled('NURSE_REALTIME_OFFER_ALERTS_ENABLED'),
    web_push: envEnabled('NURSE_WEB_PUSH_ENABLED'),
    route_planning: envEnabled('NURSE_ROUTE_PLANNING_ENABLED'),
    inventory_reservations: envEnabled('NURSE_INVENTORY_RESERVATIONS_ENABLED'),
    pickup_routing: envEnabled('NURSE_PICKUP_ROUTING_ENABLED'),
    route_auto_release: envEnabled('NURSE_ROUTE_AUTO_RELEASE_ENABLED'),
    route_provider: String(process.env.NURSE_ROUTE_PROVIDER || 'disabled').trim().toLowerCase(),
    route_provider_kill_switch: envEnabled('NURSE_ROUTE_PROVIDER_KILL_SWITCH', true),
    continuous_location_tracking: false,
  };
}

export function marketplaceCursor(row) {
  if (!row?.updated_at || !row?.id) return null;
  return Buffer.from(JSON.stringify({ updatedAt: row.updated_at, id: row.id }), 'utf8').toString('base64url');
}

export function parseMarketplaceCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!parsed?.id || !parsed?.updatedAt || !Number.isFinite(Date.parse(parsed.updatedAt))) throw new Error('invalid');
    return { id: String(parsed.id), updatedAt: new Date(parsed.updatedAt).toISOString() };
  } catch {
    throw requestError('Offer cursor is invalid.', 'invalid_offer_cursor');
  }
}

export async function loadNurseOffers(db, {
  tenantId,
  providerProfileId,
  cursor = null,
  limit = 100,
}) {
  const parsed = parseMarketplaceCursor(cursor);
  let query = db.from('nurse_shift_offers').select(OFFER_SELECT)
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .in('status', OFFER_STATUSES)
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(Math.max(1, Math.min(200, Number(limit) || 100)));
  if (parsed) query = query.gte('updated_at', parsed.updatedAt);
  const result = await query;
  if (result.error) throw result.error;
  const rows = (result.data || []).filter((row) => !parsed
    || row.updated_at > parsed.updatedAt
    || (row.updated_at === parsed.updatedAt && row.id > parsed.id));
  const termsIds = [...new Set(rows.map((row) => row.offer_terms_id).filter(Boolean))];
  let termsRows = [];
  if (termsIds.length) {
    const termsResult = await db.from('nurse_offer_terms').select('*')
      .eq('tenant_id', tenantId)
      .eq('provider_profile_id', providerProfileId)
      .in('id', termsIds);
    if (termsResult.error) throw termsResult.error;
    termsRows = termsResult.data || [];
  }
  const termsById = new Map(termsRows.map((terms) => [terms.id, terms]));
  const publicRows = rows.filter((row) => (
    termsById.get(row.offer_terms_id)?.engagement_model === 'approved_contractor'
  )).map((row) => {
    const terms = termsById.get(row.offer_terms_id) || null;
    return {
      ...row,
      terms: terms ? {
        id: terms.id,
        status: terms.status,
        claim_eligible: terms.status === 'proposed'
          && Boolean(terms.terms_hash)
          && Date.parse(terms.expires_at) > Date.now(),
        terms_version: terms.terms_version,
        engagement_model: terms.engagement_model,
        gross_pay_cents: terms.gross_pay_cents,
        hourly_rate_cents: terms.hourly_rate_cents,
        currency: terms.currency,
        estimated_work_minutes: terms.estimated_work_minutes,
        estimated_travel_minutes: terms.estimated_travel_minutes,
        mileage_rate_cents: terms.mileage_rate_cents,
        guaranteed_minimum_cents: terms.guaranteed_minimum_cents,
        cancellation_terms_code: terms.cancellation_terms_code,
        expense_policy_code: terms.expense_policy_code,
        expires_at: terms.expires_at,
      } : null,
      terms_hash: terms?.terms_hash || null,
    };
  });
  return { offers: publicRows, cursor: marketplaceCursor(rows.at(-1)) || cursor || null };
}

export function canonicalTermsHash(terms) {
  const canonical = {
    id: terms?.id || null,
    shift_id: terms?.shift_id || null,
    provider_profile_id: terms?.provider_profile_id || null,
    terms_version: Number(terms?.terms_version || 0),
    engagement_model: terms?.engagement_model || null,
    gross_pay_cents: terms?.gross_pay_cents ?? null,
    hourly_rate_cents: terms?.hourly_rate_cents ?? null,
    currency: terms?.currency || null,
    estimated_work_minutes: terms?.estimated_work_minutes ?? null,
    estimated_travel_minutes: terms?.estimated_travel_minutes ?? null,
    mileage_rate_cents: terms?.mileage_rate_cents ?? null,
    guaranteed_minimum_cents: terms?.guaranteed_minimum_cents ?? null,
    cancellation_terms_code: terms?.cancellation_terms_code || null,
    expense_policy_code: terms?.expense_policy_code || null,
    expires_at: terms?.expires_at || null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function requireTermsHash(value) {
  const hash = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw requestError('Accepted terms hash is required. Refresh and review the offer.', 'accepted_terms_hash_required', 409);
  }
  return hash;
}

export function sanitizeMarketplaceCounter(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const aliases = new Set([
    'proposedRateCents', 'proposed_rate_cents',
    'proposedStartAt', 'proposed_start_at',
    'proposedEndAt', 'proposed_end_at',
  ]);
  if (Object.keys(input).some((key) => !aliases.has(key))) {
    throw requestError('Counter terms contain an unsupported field.', 'counter_terms_invalid');
  }
  const output = {};
  const rate = input.proposedRateCents ?? input.proposed_rate_cents;
  if (rate != null) {
    const cents = Number(rate);
    if (!Number.isInteger(cents) || cents < 0 || cents > 1_000_000) {
      throw requestError('Proposed rate must be a valid amount.', 'counter_terms_invalid');
    }
    output.proposed_rate_cents = cents;
  }
  for (const [camel, snake] of [
    ['proposedStartAt', 'proposed_start_at'],
    ['proposedEndAt', 'proposed_end_at'],
  ]) {
    const raw = input[camel] ?? input[snake];
    if (raw != null) {
      const timestamp = Date.parse(String(raw));
      if (!Number.isFinite(timestamp)) throw requestError('Proposed shift time is invalid.', 'counter_terms_invalid');
      output[snake] = new Date(timestamp).toISOString();
    }
  }
  if (!Object.keys(output).length) throw requestError('Counter terms are required.', 'counter_terms_required');
  if (output.proposed_start_at && output.proposed_end_at
    && Date.parse(output.proposed_end_at) <= Date.parse(output.proposed_start_at)) {
    throw requestError('Counter shift times are invalid.', 'counter_terms_invalid');
  }
  return output;
}

export async function loadOffer(db, tenantId, providerProfileId, offerId) {
  const result = await db.from('nurse_shift_offers').select(OFFER_SELECT)
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('id', offerId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw requestError('Offer not found.', 'offer_not_found', 404);
  return result.data;
}

export async function loadOfferTermsForAction(db, tenantId, providerProfileId, offer) {
  if (!offer.offer_terms_id) throw requestError('Current offer terms are required.', 'offer_terms_required', 409);
  const result = await db.from('nurse_offer_terms').select('*')
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('id', offer.offer_terms_id)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw requestError('Current offer terms are required.', 'offer_terms_required', 409);
  if (result.data.engagement_model !== 'approved_contractor') {
    throw requestError('W-2 assignments are not nurse marketplace offers.', 'offer_unavailable', 409);
  }
  return result.data;
}

export async function actOnNurseOffer(db, {
  tenantId,
  actorProfileId,
  providerProfileId,
  offer,
  shiftVersion,
  offerVersion,
  idempotencyKey,
  action,
  acceptedTermsHash = null,
  requestedTerms = null,
}) {
  if (!envEnabled('NURSE_SHIFT_OFFERS_ENABLED')) {
    throw requestError('Shift offers are unavailable.', 'nurse_shift_offers_disabled', 503);
  }
  const normalized = String(action || '').trim().toLowerCase();
  if (!['claim', 'decline', 'counter', 'view'].includes(normalized)) {
    throw requestError('Unsupported offer action.', 'invalid_offer_action');
  }
  let termsHash = null;
  if (normalized === 'claim') {
    const terms = await loadOfferTermsForAction(db, tenantId, providerProfileId, offer);
    termsHash = requireTermsHash(acceptedTermsHash);
    if (!terms.terms_hash || terms.terms_hash !== termsHash) {
      throw requestError('Offer terms changed. Refresh and review them before accepting.', 'accepted_terms_hash_mismatch', 409);
    }
  }
  return callNurseRpc(db, 'act_on_nurse_shift_offer_v1', {
    p_tenant_id: tenantId,
    p_actor_profile_id: actorProfileId,
    p_provider_profile_id: providerProfileId,
    p_offer_id: offer.id,
    p_expected_offer_version: offerVersion,
    p_expected_shift_version: shiftVersion,
    p_idempotency_key: idempotencyKey,
    p_request_hash: crypto.createHash('sha256').update(JSON.stringify({
      offerId: offer.id,
      action: normalized,
      offerVersion,
      shiftVersion,
      acceptedTermsHash: termsHash,
      requestedTerms: requestedTerms || {},
    })).digest('hex'),
    p_action: normalized === 'claim' ? 'accept' : normalized,
    p_accepted_terms_hash: termsHash,
    p_requested_terms: requestedTerms || {},
  });
}

export async function enqueueAppointmentSourceEvent(db, {
  tenantId,
  provider,
  sourceAppointmentId,
  sourceRevision,
  eventType,
  payloadHash,
  payload,
  signatureVerifiedAt = new Date().toISOString(),
  eventOccurredAt = new Date().toISOString(),
}) {
  const row = {
    tenant_id: tenantId,
    source_provider: cleanText(provider, 40).toLowerCase(),
    source_appointment_id: cleanText(sourceAppointmentId, 160),
    source_revision: cleanText(sourceRevision || payloadHash, 160),
    event_type: cleanText(eventType, 60).toLowerCase(),
    payload_hash: cleanText(payloadHash, 128),
    payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {},
    signature_verified_at: signatureVerifiedAt,
    event_occurred_at: eventOccurredAt,
    status: 'pending',
  };
  const result = await db.from('nurse_appointment_source_events').upsert(row, {
    onConflict: 'tenant_id,source_provider,source_appointment_id,source_revision,event_type',
    ignoreDuplicates: true,
  }).select('id,status').maybeSingle();
  if (result.error) throw result.error;
  if (result.data) return result.data;
  const existing = await db.from('nurse_appointment_source_events')
    .select('id,status')
    .eq('tenant_id', row.tenant_id)
    .eq('source_provider', row.source_provider)
    .eq('source_appointment_id', row.source_appointment_id)
    .eq('source_revision', row.source_revision)
    .eq('event_type', row.event_type)
    .maybeSingle();
  if (existing.error) throw existing.error;
  return existing.data || null;
}

export async function enqueueMarketplaceJob(db, {
  tenantId,
  jobType,
  idempotencyKey,
  payload = {},
  availableAt = new Date().toISOString(),
}) {
  const result = await db.from('nurse_marketplace_jobs').upsert({
    tenant_id: tenantId,
    job_type: jobType,
    idempotency_key: idempotencyKey,
    payload,
    status: 'pending',
    available_at: availableAt,
  }, { onConflict: 'tenant_id,job_type,idempotency_key', ignoreDuplicates: true })
    .select('id,status').maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

export async function recordInAppOfferDelivery(db, {
  tenantId,
  offerId,
  providerProfileId,
  idempotencyKey,
}) {
  const result = await db.from('nurse_offer_deliveries').upsert({
    tenant_id: tenantId,
    offer_id: offerId,
    provider_profile_id: providerProfileId,
    channel: 'in_app',
    status: 'queued',
    idempotency_key: idempotencyKey,
  }, { onConflict: 'tenant_id,idempotency_key', ignoreDuplicates: true })
    .select('id,status').maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}
