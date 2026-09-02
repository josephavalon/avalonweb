import crypto from 'crypto';
import {
  callNurseRpc,
  cleanText,
  requestError,
  requirePositiveVersion,
  requireUuid,
} from './nurse-workflow.js';
import {
  consumeRouteProviderQuota,
  geocodeTypedNurseOrigin,
  optimizeNurseRoute,
  sanitizeRouteOptimizationInput,
} from './nurse-route-provider.js';
import { enqueueMarketplaceJob } from './nurse-marketplace.js';

const DAY_SELECT = 'id,provider_profile_id,route_date,origin_kind,origin_id,origin_label,origin_address,origin_latitude,origin_longitude,status,assignment_revision,acknowledged_revision,active_appointment_id,version,current_plan_version_id,released_at,released_by,release_reason_code,created_at,updated_at';
const PLAN_SELECT = 'id,route_day_id,provider_profile_id,origin_consent_id,plan_version,status,provider,request_hash,response_hash,overview_polyline,expected_stop_count,planned_stop_count,skipped_stop_count,validation_error_count,total_duration_seconds,total_distance_meters,infeasibility_code,planned_at,released_at,released_by,created_at';

export async function loadOwnedRouteDay(db, { tenantId, providerProfileId, routeDayId = null, routeDate = null }) {
  let query = db.from('provider_route_days').select(DAY_SELECT)
    .eq('tenant_id', tenantId).eq('provider_profile_id', providerProfileId);
  if (routeDayId) query = query.eq('id', routeDayId);
  if (routeDate) query = query.eq('route_date', routeDate);
  const result = await query.limit(1).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data && routeDayId) throw requestError('Route day not found.', 'route_day_not_found', 404);
  return result.data || null;
}

function navigationForStop(stop) {
  if (!Number.isFinite(Number(stop?.latitude)) || !Number.isFinite(Number(stop?.longitude))) return null;
  const destination = `${Number(stop.latitude)},${Number(stop.longitude)}`;
  return {
    google_maps_url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
    apple_maps_url: `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=d`,
  };
}

export async function hydrateRouteDay(db, tenantId, day) {
  if (!day) return null;
  let plan = null;
  let currentLeg = null;
  let activeShiftId = null;
  if (day.current_plan_version_id) {
    const result = await db.from('nurse_route_plan_versions').select(PLAN_SELECT)
      .eq('tenant_id', tenantId).eq('id', day.current_plan_version_id).maybeSingle();
    if (result.error) throw result.error;
    plan = result.data || null;
  }
  let stops = [];
  let legs = [];
  if (plan) {
    const [stopResult, legResult] = await Promise.all([
      db.from('nurse_route_plan_stops').select('id,stop_key,stop_type,sequence_number,appointment_id,pickup_task_id,predecessor_stop_id,latitude,longitude,window_starts_at,window_ends_at,service_duration_seconds,load_demands,planned_arrival_at,planned_departure_at')
        .eq('tenant_id', tenantId).eq('plan_version_id', plan.id).order('sequence_number'),
      db.from('nurse_route_plan_legs').select('id,leg_number,from_stop_id,to_stop_id,duration_seconds,distance_meters,planned_departure_at,planned_arrival_at,navigation_state')
        .eq('tenant_id', tenantId).eq('plan_version_id', plan.id).order('leg_number'),
    ]);
    if (stopResult.error) throw stopResult.error;
    if (legResult.error) throw legResult.error;
    legs = legResult.data || [];
    const appointmentIds = (stopResult.data || []).map((stop) => stop.appointment_id).filter(Boolean);
    let sourceLinks = [];
    if (appointmentIds.length) {
      const linksResult = await db.from('nurse_work_source_links').select('appointment_id,shift_id,status')
        .eq('tenant_id', tenantId).in('appointment_id', appointmentIds);
      if (linksResult.error) throw linksResult.error;
      sourceLinks = linksResult.data || [];
    }
    const shiftByAppointment = new Map(sourceLinks.map((link) => [link.appointment_id, link.shift_id]));
    const legByStop = new Map(legs.map((leg) => [leg.to_stop_id, leg]));
    stops = (stopResult.data || []).map((stop) => ({
      ...stop,
      kind: stop.stop_type,
      shift_id: stop.appointment_id ? shiftByAppointment.get(stop.appointment_id) || null : null,
      status: legByStop.get(stop.id)?.navigation_state || 'pending',
      current: legByStop.get(stop.id)?.navigation_state === 'active',
      navigation: navigationForStop(stop),
    }));
    currentLeg = legs.find((leg) => leg.navigation_state === 'active')
      || legs.find((leg) => leg.navigation_state === 'pending') || null;
    activeShiftId = stops.find((stop) => legByStop.get(stop.id)?.navigation_state === 'active')?.shift_id || null;
  }
  const pickupResult = await db.from('nurse_pickup_tasks')
    .select('id,shift_id,location_id,status,window_starts_at,window_ends_at,evidence_hash,version,completed_at')
    .eq('tenant_id', tenantId).eq('route_day_id', day.id).order('created_at');
  if (pickupResult.error) throw pickupResult.error;
  const pickupTasks = pickupResult.data || [];
  let hydratedPickups = [];
  if (pickupTasks.length) {
    const reservationsResult = await db.from('nurse_inventory_reservations')
      .select('id,shift_id,provider_profile_id,requirement_id,location_id,item_id,variant_id,lot_id,quantity,status,expires_at')
      .eq('tenant_id', tenantId)
      .eq('provider_profile_id', day.provider_profile_id)
      .in('shift_id', [...new Set(pickupTasks.map((task) => task.shift_id))])
      .in('status', ['reserved', 'consumed']);
    if (reservationsResult.error) throw reservationsResult.error;
    const reservations = reservationsResult.data || [];
    const itemIds = [...new Set(reservations.map((row) => row.item_id).filter(Boolean))];
    const variantIds = [...new Set(reservations.map((row) => row.variant_id).filter(Boolean))];
    const lotIds = [...new Set(reservations.map((row) => row.lot_id).filter(Boolean))];
    const requirementIds = [...new Set(reservations.map((row) => row.requirement_id).filter(Boolean))];
    const locationIds = [...new Set(pickupTasks.map((task) => task.location_id).filter(Boolean))];
    const [itemsResult, variantsResult, lotsResult, requirementsResult, locationsResult, routeLocationsResult] = await Promise.all([
      itemIds.length ? db.from('os_inventory_items').select('id,name,unit').eq('tenant_id', tenantId).in('id', itemIds)
        : Promise.resolve({ data: [] }),
      variantIds.length ? db.from('os_inventory_variants').select('id,name').eq('tenant_id', tenantId).in('id', variantIds)
        : Promise.resolve({ data: [] }),
      lotIds.length ? db.from('os_inventory_lots')
        .select('id,lot_code,expires_on,temperature_controlled,temperature_evidence_expires_at,calibration_required,calibration_expires_at,disposition_status')
        .eq('tenant_id', tenantId).in('id', lotIds) : Promise.resolve({ data: [] }),
      requirementIds.length ? db.from('nurse_supply_manifest_requirements')
        .select('id,temperature_evidence_required,calibration_evidence_required')
        .eq('tenant_id', tenantId).in('id', requirementIds) : Promise.resolve({ data: [] }),
      db.from('os_inventory_locations').select('id,name,location_code,status')
        .eq('tenant_id', tenantId).in('id', locationIds),
      db.from('nurse_inventory_location_route_locations')
        .select('inventory_location_id,safe_label,safe_address,hours_label,expires_at')
        .eq('tenant_id', tenantId).in('inventory_location_id', locationIds)
        .is('invalidated_at', null).gt('expires_at', new Date().toISOString()),
    ]);
    for (const result of [itemsResult, variantsResult, lotsResult, requirementsResult, locationsResult, routeLocationsResult]) {
      if (result.error) throw result.error;
    }
    const items = new Map((itemsResult.data || []).map((row) => [row.id, row]));
    const variants = new Map((variantsResult.data || []).map((row) => [row.id, row]));
    const lots = new Map((lotsResult.data || []).map((row) => [row.id, row]));
    const requirements = new Map((requirementsResult.data || []).map((row) => [row.id, row]));
    const locations = new Map((locationsResult.data || []).map((row) => [row.id, row]));
    const routeLocations = new Map((routeLocationsResult.data || []).map((row) => [row.inventory_location_id, row]));
    hydratedPickups = pickupTasks.map((task) => {
      const location = locations.get(task.location_id);
      const routeLocation = routeLocations.get(task.location_id);
      const taskLines = reservations.filter((reservation) => (
        reservation.shift_id === task.shift_id && reservation.location_id === task.location_id
      )).map((reservation) => {
        const item = items.get(reservation.item_id);
        const variant = variants.get(reservation.variant_id);
        const lot = lots.get(reservation.lot_id);
        const requirement = requirements.get(reservation.requirement_id);
        return {
          reservation_id: reservation.id,
          item_id: reservation.item_id,
          variant_id: reservation.variant_id,
          lot_id: reservation.lot_id,
          item_label: [item?.name, variant?.name].filter(Boolean).join(' · ') || 'Supply item',
          lot_label: lot?.lot_code || null,
          quantity: reservation.quantity,
          unit: item?.unit || 'unit',
          cold_chain_required: Boolean(lot?.temperature_controlled || requirement?.temperature_evidence_required),
          calibration_required: Boolean(lot?.calibration_required || requirement?.calibration_evidence_required),
          expires_on: lot?.expires_on || null,
          disposition_status: lot?.disposition_status || (reservation.lot_id ? 'unavailable' : 'not_lot_controlled'),
          count_verified: false,
        };
      });
      return {
        ...task,
        location: {
          safe_label: routeLocation?.safe_label || location?.name || location?.location_code || 'Approved pickup location',
          safe_address: routeLocation?.safe_address || null,
          hours_label: routeLocation?.hours_label || null,
        },
        reservation_lines: taskLines,
        cold_chain_required: taskLines.some((line) => line.cold_chain_required),
        allowed_actions: task.status === 'arrived' && taskLines.length && routeLocation
          ? ['complete_pickup'] : [],
      };
    });
    const pickupById = new Map(hydratedPickups.map((task) => [task.id, task]));
    stops = stops.map((stop) => {
      const pickup = stop.pickup_task_id ? pickupById.get(stop.pickup_task_id) : null;
      return pickup ? { ...stop, safe_label: pickup.location.safe_label } : stop;
    });
  }
  return {
    ...day,
    plan: plan ? { ...plan, stops, legs } : null,
    current_leg: currentLeg,
    active_shift_id: activeShiftId,
    pickup_tasks: hydratedPickups,
    continuous_location_tracking: false,
  };
}

function consentHash({ routeDayId, providerProfileId, originKind, textVersion, idempotencyKey }) {
  return crypto.createHash('sha256').update(JSON.stringify({
    routeDayId, providerProfileId, originKind, textVersion, idempotencyKey,
  })).digest('hex');
}

export async function setTypedRouteOrigin(db, {
  tenantId,
  actorProfileId,
  providerProfileId,
  routeDay,
  body,
}) {
  const address = cleanText(body.address, 300);
  const idempotencyKey = requireUuid(body.idempotencyKey, 'Idempotency key');
  const hashSecret = String(process.env.NURSE_ROUTE_REQUEST_HASH_SECRET || '');
  if (hashSecret.length < 32) {
    throw requestError('Typed-origin request hashing is not configured.', 'route_request_hash_secret_missing', 503);
  }
  const inputHash = crypto.createHmac('sha256', hashSecret).update(JSON.stringify({
    routeDayId: routeDay.id, idempotencyKey, address,
  })).digest('hex');
  const existing = await callNurseRpc(db, 'get_nurse_typed_origin_geocode_v1', {
    p_tenant_id: tenantId,
    p_actor_profile_id: actorProfileId,
    p_provider_profile_id: providerProfileId,
    p_route_day_id: routeDay.id,
    p_idempotency_key: idempotencyKey,
  });
  if (existing && existing.input_hash !== inputHash) {
    throw requestError('Idempotency key was used for a different typed origin.', 'route_idempotency_conflict', 409);
  }
  let resolved = existing?.status === 'resolved' ? {
    latitude: existing.latitude,
    longitude: existing.longitude,
    formattedAddress: existing.formatted_address,
    provider: 'google',
  } : null;
  if (!resolved) {
    const reservation = await callNurseRpc(db, 'reserve_nurse_typed_origin_geocode_v1', {
      p_tenant_id: tenantId,
      p_actor_profile_id: actorProfileId,
      p_provider_profile_id: providerProfileId,
      p_route_day_id: routeDay.id,
      p_idempotency_key: idempotencyKey,
      p_input_hash: inputHash,
    });
    if (reservation?.reserved_now === false || reservation?.reservedNow === false) {
      throw requestError('This typed origin is already being processed.', 'typed_origin_in_progress', 409);
    }
    try {
      resolved = await geocodeTypedNurseOrigin(db, {
        tenantId, actorProfileId, routeDayId: routeDay.id, address, idempotencyKey,
      });
      await callNurseRpc(db, 'complete_nurse_typed_origin_geocode_v1', {
        p_tenant_id: tenantId,
        p_actor_profile_id: actorProfileId,
        p_provider_profile_id: providerProfileId,
        p_route_day_id: routeDay.id,
        p_idempotency_key: idempotencyKey,
        p_input_hash: inputHash,
        p_latitude: resolved.latitude,
        p_longitude: resolved.longitude,
        p_formatted_address: resolved.formattedAddress,
      });
    } catch (error) {
      try {
        await callNurseRpc(db, 'fail_nurse_typed_origin_geocode_v1', {
          p_tenant_id: tenantId,
          p_actor_profile_id: actorProfileId,
          p_provider_profile_id: providerProfileId,
          p_route_day_id: routeDay.id,
          p_idempotency_key: idempotencyKey,
          p_input_hash: inputHash,
          p_failure_code: String(error?.code || 'typed_origin_geocoding_failed').slice(0, 100),
        });
      } catch { /* preserve the geocoding failure */ }
      throw error;
    }
  }
  return planOwnedRouteDay(db, {
    tenantId,
    actorProfileId,
    providerProfileId,
    routeDay,
    body: { ...body, origin: { kind: 'manual' } },
    resolvedOrigin: resolved,
  });
}

async function preparePlan(db, context) {
  return callNurseRpc(db, 'prepare_nurse_route_plan_v1', {
    p_tenant_id: context.tenantId,
    p_actor_profile_id: context.actorProfileId,
    p_provider_profile_id: context.providerProfileId,
    p_route_day_id: context.routeDay.id,
    p_expected_version: context.expectedVersion,
  });
}

export async function planOwnedRouteDay(db, {
  tenantId,
  actorProfileId,
  providerProfileId,
  routeDay,
  body,
  resolvedOrigin = null,
}) {
  const expectedVersion = requirePositiveVersion(
    body.expectedRouteDayVersion ?? body.expectedVersion ?? body.version,
    'Route version',
  );
  const idempotencyKey = requireUuid(body.idempotencyKey, 'Idempotency key');
  const originKind = String(body.origin?.kind || body.originKind || routeDay.origin_kind || '').trim().toLowerCase();
  let origin;
  let originLabel = routeDay.origin_label || null;
  let originAddress = routeDay.origin_address || null;
  if (originKind === 'current') {
    origin = {
      latitude: body.origin?.latitude,
      longitude: body.origin?.longitude,
    };
    originLabel = 'Current location';
    originAddress = null;
  } else if (['manual', 'office'].includes(originKind)) {
    origin = resolvedOrigin || { latitude: routeDay.origin_latitude, longitude: routeDay.origin_longitude };
    if (resolvedOrigin) {
      originLabel = resolvedOrigin.formattedAddress;
      originAddress = resolvedOrigin.formattedAddress;
    }
  } else {
    throw requestError('Choose a current, typed, or approved office origin.', 'route_origin_required', 409);
  }
  const prepared = await preparePlan(db, {
    tenantId, actorProfileId, providerProfileId, routeDay, expectedVersion,
  });
  if (!prepared || !['kit_ready', 'pickup_required'].includes(prepared.inventory_state)) {
    throw requestError('Inventory is not ready for route planning.', prepared?.inventory_reason || 'route_inventory_not_ready', 409);
  }
  const input = sanitizeRouteOptimizationInput({
    routeDayId: routeDay.id,
    origin,
    stops: prepared.stops,
    capacity: prepared.capacity,
    shiftStart: prepared.shift_start,
    shiftEnd: prepared.shift_end,
    constraints: prepared.constraints,
    constraintsHash: prepared.constraints_hash,
    routePolicyId: prepared.route_policy_id,
  });
  const hashSecret = String(process.env.NURSE_ROUTE_REQUEST_HASH_SECRET || '');
  if (hashSecret.length < 32) {
    throw requestError('Route request hashing is not configured.', 'route_request_hash_secret_missing', 503);
  }
  const requestHash = crypto.createHmac('sha256', hashSecret).update(JSON.stringify(input)).digest('hex');
  const replay = await callNurseRpc(db, 'get_nurse_route_plan_request_v1', {
    p_tenant_id: tenantId,
    p_actor_profile_id: actorProfileId,
    p_provider_profile_id: providerProfileId,
    p_route_day_id: routeDay.id,
    p_idempotency_key: idempotencyKey,
  });
  if (replay) {
    if (replay.request_hash !== requestHash) {
      throw requestError('Idempotency key was used for a different route request.', 'route_idempotency_conflict', 409);
    }
    if (replay.status === 'pending') {
      throw requestError('This route-plan request is not safe to repeat.', 'route_idempotency_conflict', 409);
    }
    if (replay.status === 'persisted' && replay.plan_version_id) {
      return { replayed: true, plan_version_id: replay.plan_version_id };
    }
    if (replay.status !== 'failed') {
      throw requestError('This route-plan request is not safe to repeat.', 'route_idempotency_conflict', 409);
    }
  }
  const reservation = await callNurseRpc(db, 'reserve_nurse_route_plan_request_v1', {
    p_tenant_id: tenantId,
    p_actor_profile_id: actorProfileId,
    p_provider_profile_id: providerProfileId,
    p_route_day_id: routeDay.id,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_origin_kind: originKind,
  });
  if (reservation?.reserved_now === false || reservation?.reservedNow === false) {
    throw requestError('This route plan is already being processed.', 'route_plan_in_progress', 409);
  }
  let optimized;
  try {
    await consumeRouteProviderQuota(db, {
      tenantId,
      actorProfileId,
      routeDayId: routeDay.id,
      idempotencyKey,
      requestHash,
    });
    optimized = await optimizeNurseRoute(input);
  } catch (error) {
    try {
      await callNurseRpc(db, 'fail_nurse_route_plan_request_v1', {
        p_tenant_id: tenantId,
        p_actor_profile_id: actorProfileId,
        p_provider_profile_id: providerProfileId,
        p_route_day_id: routeDay.id,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
        p_failure_code: String(error?.code || 'route_provider_failed').slice(0, 100),
      });
    } catch { /* preserve the provider failure; request remains safely reserved */ }
    throw error;
  }
  const textVersion = cleanText(body.consentTextVersion || 'route-origin-consent-v1', 80);
  const hash = consentHash({ routeDayId: routeDay.id, providerProfileId, originKind, textVersion, idempotencyKey });
  let persisted;
  try {
    persisted = await callNurseRpc(db, 'persist_nurse_route_plan_v1', {
      p_tenant_id: tenantId,
      p_actor_profile_id: actorProfileId,
      p_provider_profile_id: providerProfileId,
      p_route_day_id: routeDay.id,
      p_expected_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
      p_origin_kind: originKind,
      p_origin_label: originLabel,
      p_origin_address: originAddress,
      p_origin_latitude: originKind === 'current' ? null : Number(origin.latitude),
      p_origin_longitude: originKind === 'current' ? null : Number(origin.longitude),
      p_consent_text_version: textVersion,
      p_consent_hash: hash,
      p_request_hash: requestHash,
      p_response_hash: optimized.responseHash,
      p_ordered_stop_ids: optimized.orderedStopIds,
      p_visits: optimized.visits,
      p_transitions: optimized.transitions,
      p_route_policy_id: input.routePolicyId,
      p_constraints_hash: input.constraintsHash,
      p_constraint_evidence: optimized.constraintEvidence,
    });
  } catch (error) {
    try {
      await callNurseRpc(db, 'fail_nurse_route_plan_request_v1', {
        p_tenant_id: tenantId,
        p_actor_profile_id: actorProfileId,
        p_provider_profile_id: providerProfileId,
        p_route_day_id: routeDay.id,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
        p_failure_code: String(error?.code || 'route_plan_persist_failed').slice(0, 100),
      });
    } catch { /* preserve the persist failure without leaking route input */ }
    throw error;
  }
  // Map geometry is optional presentation evidence. A failure to store it must
  // never strand or mislabel an otherwise valid persisted route plan.
  if (optimized.overviewPolyline && persisted?.plan_version_id) {
    try {
      await callNurseRpc(db, 'store_nurse_route_plan_polyline_v1', {
        p_tenant_id: tenantId,
        p_actor_profile_id: actorProfileId,
        p_provider_profile_id: providerProfileId,
        p_route_day_id: routeDay.id,
        p_plan_version_id: persisted.plan_version_id,
        p_response_hash: optimized.responseHash,
        p_overview_polyline: optimized.overviewPolyline,
      });
    } catch { /* Today falls back to the verified stop order without road geometry. */ }
  }
  await enqueueMarketplaceJob(db, {
    tenantId,
    jobType: 'readiness_evaluate',
    idempotencyKey: `route-release:${routeDay.id}:${persisted?.plan_version_id || optimized.responseHash}`,
    payload: {
      stage: 'route_release',
      routeDayId: routeDay.id,
      providerProfileId,
      planVersionId: persisted?.plan_version_id || null,
    },
  });
  return { persisted, provider: 'google', current_location_persisted: false };
}

export async function transitionOwnedRouteDay(db, {
  tenantId,
  actorProfileId,
  providerProfileId,
  routeDay,
  body,
}) {
  const action = String(body.action || '').trim().toLowerCase();
  if (action === 'complete_pickup') {
    const pickupTaskId = requireUuid(body.pickupTaskId || body.entityId, 'Pickup task id');
    const expectedPickupVersion = requirePositiveVersion(
      body.expectedPickupVersion ?? body.expectedVersion,
      'Pickup version',
    );
    const idempotencyKey = requireUuid(body.idempotencyKey, 'Idempotency key');
    const rawLines = Array.isArray(body.confirmations)
      ? body.confirmations : Array.isArray(body.confirmations?.lines)
        ? body.confirmations.lines : Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length > 200) {
      throw requestError('Too many pickup line confirmations.', 'pickup_line_confirmations_invalid');
    }
    const taskResult = await db.from('nurse_pickup_tasks').select('id,route_day_id,status')
      .eq('tenant_id', tenantId).eq('id', pickupTaskId)
      .eq('provider_profile_id', providerProfileId).maybeSingle();
    if (taskResult.error) throw taskResult.error;
    if (!taskResult.data || taskResult.data.route_day_id !== routeDay.id) {
      throw requestError('Pickup task was not found on this route.', 'pickup_task_not_found', 404);
    }
    const mismatch = body.mismatch === true || body.confirmations?.mismatch === true;
    if (mismatch) {
      const reason = String(body.reason || body.confirmations?.reason || '').trim().toLowerCase();
      const allowedReasons = new Set(['count_mismatch', 'lot_mismatch', 'damaged', 'temperature_out_of_range', 'other']);
      if (!allowedReasons.has(reason)) throw requestError('Pickup mismatch reason is invalid.', 'pickup_mismatch_reason_invalid');
      const mismatchReason = {
        damaged: 'package_damaged',
        other: 'other_operational_mismatch',
      }[reason] || reason;
      const mismatchLines = rawLines.map((line) => {
        const quantity = Number(line?.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw requestError('Pickup mismatch quantities are invalid.', 'pickup_mismatch_lines_invalid');
        }
        return {
          reservationId: requireUuid(line?.reservationId || line?.reservation_id, 'Reservation id'),
          itemId: requireUuid(line?.itemId || line?.item_id, 'Item id'),
          variantId: line?.variantId || line?.variant_id
            ? requireUuid(line.variantId || line.variant_id, 'Variant id') : null,
          lotId: line?.lotId || line?.lot_id ? requireUuid(line.lotId || line.lot_id, 'Lot id') : null,
          quantity,
        };
      });
      return callNurseRpc(db, 'report_nurse_pickup_mismatch_v1', {
        p_tenant_id: tenantId,
        p_actor_profile_id: actorProfileId,
        p_provider_profile_id: providerProfileId,
        p_pickup_task_id: pickupTaskId,
        p_expected_version: expectedPickupVersion,
        p_idempotency_key: idempotencyKey,
        p_reason_code: mismatchReason,
        p_lines: mismatchLines,
      });
    }
    if (!rawLines.length || rawLines.length > 250) {
      throw requestError('Exact pickup line confirmations are required.', 'pickup_line_confirmations_required');
    }
    const lines = rawLines.map((line) => {
      const quantity = Number(line?.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0
          || (line?.countVerified ?? line?.count_verified ?? line?.confirmed) !== true) {
        throw requestError('Every pickup quantity must be verified.', 'pickup_exact_count_mismatch', 409);
      }
      return {
        reservationId: requireUuid(line?.reservationId || line?.reservation_id, 'Reservation id'),
        itemId: requireUuid(line?.itemId || line?.item_id, 'Item id'),
        variantId: line?.variantId || line?.variant_id
          ? requireUuid(line.variantId || line.variant_id, 'Variant id') : null,
        lotId: line?.lotId || line?.lot_id ? requireUuid(line.lotId || line.lot_id, 'Lot id') : null,
        quantity,
        countVerified: true,
      };
    });
    const countConfirmed = body.countConfirmed ?? body.confirmations?.countConfirmed;
    const handoffConfirmed = body.handoffConfirmed ?? body.confirmations?.handoffConfirmed;
    if (countConfirmed !== true || handoffConfirmed !== true) {
      throw requestError('Count and handoff confirmations are required.', 'pickup_handoff_evidence_invalid', 409);
    }
    const handoffMaterial = { pickupTaskId, idempotencyKey, lines, countConfirmed, handoffConfirmed };
    const handoffEvidence = {
      countConfirmed: true,
      handoffConfirmed: true,
      evidenceHash: crypto.createHash('sha256').update(JSON.stringify(handoffMaterial)).digest('hex'),
    };
    const rawColdChain = body.coldChainEvidence || body.confirmations?.coldChain || null;
    let coldChainEvidence = { notRequired: true };
    if (rawColdChain && rawColdChain.notRequired !== true) {
      const temperatureC = Number(rawColdChain.temperatureC ?? rawColdChain.temperature_c);
      const recordedAtMs = Date.parse(String(rawColdChain.recordedAt || rawColdChain.recorded_at || ''));
      if (!Number.isFinite(temperatureC) || temperatureC < -100 || temperatureC > 100
          || !Number.isFinite(recordedAtMs)) {
        throw requestError('Cold-chain evidence is invalid.', 'pickup_cold_chain_evidence_invalid', 409);
      }
      const recordedAt = new Date(recordedAtMs).toISOString();
      coldChainEvidence = {
        temperatureC,
        recordedAt,
        evidenceHash: crypto.createHash('sha256').update(JSON.stringify({
          pickupTaskId, idempotencyKey, temperatureC, recordedAt,
        })).digest('hex'),
      };
    }
    return callNurseRpc(db, 'complete_nurse_pickup_task_v1', {
      p_tenant_id: tenantId,
      p_actor_profile_id: actorProfileId,
      p_provider_profile_id: providerProfileId,
      p_pickup_task_id: pickupTaskId,
      p_expected_version: expectedPickupVersion,
      p_idempotency_key: idempotencyKey,
      p_lines: lines,
      p_handoff_evidence: handoffEvidence,
      p_cold_chain_evidence: coldChainEvidence,
    });
  }
  if (!['acknowledge', 'activate', 'pause', 'resume', 'arrive', 'complete', 'require_recovery'].includes(action)) {
    throw requestError('Unsupported route action.', 'invalid_route_action');
  }
  return callNurseRpc(db, 'transition_nurse_route_day_v1', {
    p_tenant_id: tenantId,
    p_actor_profile_id: actorProfileId,
    p_provider_profile_id: providerProfileId,
    p_route_day_id: routeDay.id,
    p_expected_version: requirePositiveVersion(
      body.expectedRouteDayVersion ?? body.expectedVersion ?? body.version,
      'Route version',
    ),
    p_idempotency_key: requireUuid(body.idempotencyKey, 'Idempotency key'),
    p_action: action,
    p_entity_id: body.entityId || body.stopId
      ? requireUuid(body.entityId || body.stopId, 'Route entity id') : null,
    p_reason_code: cleanText(body.reasonCode || action, 100),
  });
}
