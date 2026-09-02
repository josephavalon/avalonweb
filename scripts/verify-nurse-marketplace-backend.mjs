import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canonicalTermsHash,
  nurseMarketplaceCapabilities,
  parseMarketplaceCursor,
  sanitizeMarketplaceCounter,
} from '../api/_lib/nurse-marketplace.js';
import {
  buildGoogleRouteRequest,
  routeProviderConfiguration,
  sanitizeRouteOptimizationInput,
} from '../api/_lib/nurse-route-provider.js';
import {
  READINESS_DOMAINS,
  READINESS_DOMAINS_BY_STAGE,
} from '../api/_lib/nurse-workflow.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

for (const key of [
  'NURSE_AUTO_SHIFT_CREATION_ENABLED', 'NURSE_SHIFT_OFFERS_ENABLED',
  'NURSE_REALTIME_OFFER_ALERTS_ENABLED', 'NURSE_WEB_PUSH_ENABLED',
  'NURSE_ROUTE_PLANNING_ENABLED', 'NURSE_INVENTORY_RESERVATIONS_ENABLED',
  'NURSE_PICKUP_ROUTING_ENABLED', 'NURSE_ROUTE_AUTO_RELEASE_ENABLED',
]) delete process.env[key];
delete process.env.NURSE_ROUTE_PROVIDER;
delete process.env.NURSE_ROUTE_PROVIDER_KILL_SWITCH;

const capabilities = nurseMarketplaceCapabilities();
for (const [key, value] of Object.entries(capabilities)) {
  if (key === 'route_provider') assert.equal(value, 'disabled');
  else if (key === 'route_provider_kill_switch') assert.equal(value, true);
  else assert.equal(value, false, `${key} must fail closed`);
}
assert.equal(routeProviderConfiguration().ready, false);

assert.deepEqual(READINESS_DOMAINS_BY_STAGE.route_release, READINESS_DOMAINS);
assert.deepEqual(READINESS_DOMAINS_BY_STAGE.run_start, READINESS_DOMAINS);
assert.ok(!READINESS_DOMAINS_BY_STAGE.claim.includes('route'));
assert.ok(!READINESS_DOMAINS_BY_STAGE.claim.includes('kit'));

const sanitized = sanitizeRouteOptimizationInput({
  routeDayId: 'route_123',
  origin: { latitude: 37.77, longitude: -122.42, address: 'must not leave Avalon' },
  stops: [
    {
      id: 'pickup_1', kind: 'pickup', latitude: 37.76, longitude: -122.41,
      windowStart: '2026-09-02T16:00:00Z', windowEnd: '2026-09-02T17:00:00Z',
      durationMinutes: 10, load: 2, label: 'must not leave Avalon',
    },
    {
      id: 'pickup_2', kind: 'pickup', latitude: 37.755, longitude: -122.405,
      windowStart: '2026-09-02T16:00:00Z', windowEnd: '2026-09-02T17:00:00Z',
      durationMinutes: 10, load: 1,
    },
    {
      id: 'appointment_1', kind: 'appointment', latitude: 37.75, longitude: -122.40,
      windowStart: '2026-09-02T17:00:00Z', windowEnd: '2026-09-02T19:00:00Z',
      durationMinutes: 45, load: 1, pickupPredecessorIds: ['pickup_1', 'pickup_2'], patientName: 'must not leave Avalon',
    },
  ],
  capacity: 5,
  shiftStart: '2026-09-02T15:30:00Z',
  shiftEnd: '2026-09-02T22:00:00Z',
  routePolicyId: '11111111-1111-4111-8111-111111111111',
  constraintsHash: 'a'.repeat(64),
  constraints: {
    maxStops: 5,
    maxWorkMinutes: 480,
    maxTravelMinutes: 240,
    requiredBreaks: [],
    parkingBufferMinutes: 5,
    serviceBufferMinutes: 5,
    observationBufferMinutes: 10,
    coldChainMaxElapsedMinutes: 180,
    tollPolicy: 'avoid',
    depotHours: { start: '2026-09-02T15:30:00Z', end: '2026-09-02T18:00:00Z' },
  },
});
const serialized = JSON.stringify(sanitized);
assert.doesNotMatch(serialized, /address|label|patient|must not leave Avalon/i);
assert.deepEqual(sanitized.stops[2].pickupPredecessorIds, ['pickup_1', 'pickup_2']);
assert.equal(sanitized.constraints.tollPolicy, 'avoid');
assert.equal(sanitized.stops[2].durationMinutes, 65);
const googleModel = buildGoogleRouteRequest(sanitized).model;
assert.equal(buildGoogleRouteRequest(sanitized).populatePolylines, true);
assert.equal(googleModel.globalStartTime, sanitized.shiftStart);
assert.equal(googleModel.globalEndTime, sanitized.shiftEnd);
assert.equal(googleModel.precedenceRules.length, 2);
assert.deepEqual(googleModel.precedenceRules.map((rule) => rule.firstIndex), [0, 1]);
assert.equal(googleModel.vehicles[0].routeModifiers.avoidTolls, true);
assert.equal(googleModel.vehicles[0].routeDurationLimit.maxDuration, '28800s');
assert.equal(googleModel.vehicles[0].travelDurationLimit.maxDuration, '14400s');
assert.equal(googleModel.vehicles[0].endWaypoint, undefined);

assert.deepEqual(sanitizeMarketplaceCounter({ proposedRateCents: 12500 }), { proposed_rate_cents: 12500 });
assert.throws(() => sanitizeMarketplaceCounter({ note: 'free text is not accepted' }), /unsupported field/);
assert.throws(() => parseMarketplaceCursor('not-a-cursor'), /cursor is invalid/);
assert.equal(canonicalTermsHash({ id: 'x', terms_version: 1 }), canonicalTermsHash({ id: 'x', terms_version: 1 }));
assert.notEqual(
  canonicalTermsHash({ id: 'x', terms_version: 1, gross_pay_cents: 10000 }),
  canonicalTermsHash({ id: 'x', terms_version: 1, gross_pay_cents: 10001 }),
  'material offer changes must change the canonical hash',
);

const routeDays = read('../api/_lib/nurse-route-days.js');
assert.match(routeDays, /p_origin_latitude: originKind === 'current' \? null/);
assert.match(routeDays, /current_location_persisted: false/);
assert.match(routeDays, /get_nurse_route_plan_request_v1/);
assert.match(routeDays, /reserve_nurse_route_plan_request_v1/);
assert.match(routeDays, /replay\.status !== 'failed'/);
assert.match(routeDays, /route_plan_persist_failed/);
assert.match(routeDays, /persist_nurse_route_plan_v1[\s\S]*fail_nurse_route_plan_request_v1/);
assert.match(routeDays, /p_constraint_evidence: optimized\.constraintEvidence/);
assert.match(routeDays, /complete_nurse_pickup_task_v1/);
assert.match(routeDays, /report_nurse_pickup_mismatch_v1/);
assert.match(routeDays, /damaged: 'package_damaged'/);
assert.match(routeDays, /other: 'other_operational_mismatch'/);
assert.match(routeDays, /reservation_lines: taskLines/);
assert.match(routeDays, /allowed_actions: task\.status === 'arrived'/);
assert.match(routeDays, /kind: stop\.stop_type/);
assert.match(routeDays, /safe_label: pickup\.location\.safe_label/);
assert.doesNotMatch(routeDays, /location_address/);

const workflow = read('../api/_lib/nurse-workflow.js');
assert.match(workflow, /evaluation_stage: normalizedStage/);
assert.match(workflow, /nurse_route_plan_stops/);
assert.match(workflow, /loadCanonicalKitEvidence/);
assert.match(workflow, /inventory_lot_evidence_stale/);
assert.match(workflow, /pickup_custody_incomplete/);
assert.match(workflow, /\['route_release', 'run_start'\]\.includes\(normalizedStage\)[\s\S]*loadCanonicalKitEvidence/);
assert.doesNotMatch(workflow.slice(workflow.indexOf('export async function loadRouteForShift')), /shift\.location_address/);

const routeProvider = read('../api/_lib/nurse-route-provider.js');
for (const constraint of [
  'maxStops', 'maxWorkMinutes', 'maxTravelMinutes', 'requiredBreaks', 'depotHours',
  'parkingBufferMinutes', 'serviceBufferMinutes', 'observationBufferMinutes',
  'coldChainMaxElapsedMinutes', 'tollPolicy', 'constraintEvidence',
]) assert.ok(routeProvider.includes(constraint), `route provider missing ${constraint}`);
assert.match(routeProvider, /globalStartTime: input\.shiftStart/);
assert.match(routeProvider, /globalEndTime: input\.shiftEnd/);
assert.match(routeProvider, /routeDurationLimit/);
assert.match(routeProvider, /travelDurationLimit/);
assert.match(routeProvider, /breakRule/);
assert.match(routeProvider, /routeModifiers/);

const runtimeMigration = read('../supabase/migrations/080_nurse_marketplace_runtime.sql');
const claimStart = runtimeMigration.indexOf('create or replace function public.claim_nurse_shift_offer_v1');
const claimEnd = runtimeMigration.indexOf('create or replace function public.assign_w2_nurse_shift_v1', claimStart);
assert.ok(claimStart >= 0 && claimEnd > claimStart, 'canonical offer claim RPC must exist');
const claimBody = runtimeMigration.slice(claimStart, claimEnd);
assert.doesNotMatch(claimBody, /claim_operational_shift\s*\(/i,
  'marketplace claim must not call the legacy route/start-gated claim RPC');
assert.match(claimBody, /evaluation_stage\s*=\s*'claim'/,
  'marketplace claim must require a fresh claim-stage readiness snapshot');

const shiftsApi = read('../api/me/shifts.js');
for (const contract of [
  'expectedShiftVersion', 'expectedOfferVersion', 'acceptedTermsHash', 'idempotencyKey',
  'offer_required', 'recovery_poll_seconds', 'nurse_shift_offers',
]) assert.ok(shiftsApi.includes(contract), `shift API missing ${contract}`);
assert.match(shiftsApi, /same[\s\S]{0,180}idempotency key[\s\S]{0,500}actOnNurseOffer/,
  'explicit offer retries must reach the canonical idempotent RPC');
assert.match(shiftsApi, /route_day: routeDay/);

const worker = read('../api/_lib/nurse-marketplace-worker.js');
assert.doesNotMatch(worker, /evaluate_nurse_marketplace_readiness_v1/,
  'worker must use the canonical server readiness evaluator');
assert.match(worker, /evaluateShiftReadiness/);
assert.match(worker, /approved_candidates_required/);
assert.match(worker, /jobType: 'notification_deliver'/);

const acuityWebhook = read('../api/integrations/acuity/webhook.js');
assert.match(acuityWebhook, /enqueueNurseAppointmentReconcile/);
assert.match(acuityWebhook, /jobType: 'appointment_reconcile'/);
assert.match(acuityWebhook, /event_id: sourceEvent\.id/);
assert.match(acuityWebhook, /existingEvent\.webhook_event_hash === hash/);
assert.match(acuityWebhook, /isEventsGfeAppointment\(preclassifiedAppointment/);
assert.match(acuityWebhook, /eventOccurredAt: sourceChangeOccurredAt/);
assert.doesNotMatch(acuityWebhook, /eventOccurredAt:\s*(?:appt|body)\.(?:datetime|date)/,
  'source-event ordering must not use the mutable appointment service time');

const cronApi = read('../api/cron/nurse-marketplace.js');
assert.match(cronApi, /timingSafeEqual/);
assert.match(cronApi, /purge_nurse_typed_origin_retention_v1/);
assert.match(cronApi, /p_retention_hours: 24/);

const adminMarketplace = read('../api/admin/nurse-marketplace.js');
assert.match(adminMarketplace, /action === 'prepare_offer_candidate'/);
assert.match(adminMarketplace, /prepare_nurse_offer_candidate_v1/);
assert.match(adminMarketplace, /engagementModel !== 'approved_contractor'/);
assert.match(adminMarketplace, /\.toLowerCase\(\)/);
assert.match(adminMarketplace, /jobType: 'readiness_evaluate'/);
assert.match(adminMarketplace, /offerCandidate/);
assert.match(adminMarketplace, /offer_candidate_contexts: offerCandidateContexts/);
assert.match(adminMarketplace, /terms_policies: termsPolicies/);
assert.doesNotMatch(adminMarketplace, /\.select\([^\n]*business_profile/);
assert.doesNotMatch(adminMarketplace, /resolve_pickup/,
  'admin inventory must not expose a transfer action without exact nurse handoff evidence');

for (const path of [
  '../api/me/route-days.js',
  '../api/me/route-days/[id]/origin.js',
  '../api/me/route-days/[id]/plan.js',
  '../api/me/route-days/[id]/actions.js',
  '../api/admin/nurse-marketplace.js',
  '../api/cron/nurse-marketplace.js',
]) assert.ok(read(path).length > 100, `${path} must exist`);

console.log('Nurse marketplace backend QA passed: staged gates, fail-closed flags, PHI-minimized routing, idempotent contracts, and APIs.');
