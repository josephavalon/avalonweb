import crypto from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const SCENARIO_KEY = 'nurse-route-2026-09-02-v1';
const ROUTE_DATE = '2026-09-02';
const TIMEZONE = 'America/Los_Angeles';
const APPLY = process.argv.includes('--apply');
const CHECK = process.argv.includes('--check');

const APPOINTMENTS = Object.freeze([
  {
    key: 'joseph',
    displayName: '[BETA TEST] Joseph',
    address: '24327 Alves Street, Hayward, CA',
    protocolKey: 'hydration',
    serviceLabel: 'Generic hydration',
    durationMinutes: 60,
    startsAt: '2026-09-02T12:00:00-07:00',
    endsAt: '2026-09-02T13:00:00-07:00',
    latitudeEnv: 'AVALON_BETA_JOSEPH_LATITUDE',
    longitudeEnv: 'AVALON_BETA_JOSEPH_LONGITUDE',
  },
  {
    key: 'joshua',
    displayName: '[BETA TEST] Joshua',
    address: '540 Anita Boulevard, Millbrae, CA',
    protocolKey: 'nad',
    serviceLabel: 'NAD+',
    durationMinutes: 120,
    startsAt: '2026-09-02T14:00:00-07:00',
    endsAt: '2026-09-02T16:00:00-07:00',
    latitudeEnv: 'AVALON_BETA_JOSHUA_LATITUDE',
    longitudeEnv: 'AVALON_BETA_JOSHUA_LONGITUDE',
  },
]);

const OFFICE = Object.freeze({
  label: '[BETA TEST] Avalon SF office',
  address: '275 8th Street, Third Floor, San Francisco, CA 94103',
  latitudeEnv: 'AVALON_BETA_SF_OFFICE_LATITUDE',
  longitudeEnv: 'AVALON_BETA_SF_OFFICE_LONGITUDE',
});

function value(name) {
  return String(process.env[name] || '').trim();
}

function stop(message) {
  throw new Error(`Seed refused: ${message}`);
}

function deterministicUuid(projectRef, key) {
  const bytes = Buffer.from(crypto.createHash('sha256').update(`${projectRef}:${SCENARIO_KEY}:${key}`).digest('hex').slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha256(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function coordinate(name, min, max) {
  const raw = value(name);
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed < min || parsed > max) {
    stop(`${name} must be a verified coordinate between ${min} and ${max}`);
  }
  return parsed;
}

function assertTestEmail(name, email) {
  if (!/^[^@\s]+@[^@\s]+\.test$/i.test(email)) stop(`${name} must be a .test email address`);
}

function assertRouteConstraints(policy) {
  const constraints = policy?.rules?.route_constraints;
  const integers = [
    ['maxStops', 1, 100],
    ['maxWorkMinutes', 1, 1440],
    ['maxTravelMinutes', 0, 1440],
    ['parkingBufferMinutes', 0, 240],
    ['serviceBufferMinutes', 0, 240],
    ['observationBufferMinutes', 0, 240],
    ['coldChainMaxElapsedMinutes', 1, 1440],
  ];
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) {
    stop('the approved route_release policy has no route_constraints object');
  }
  for (const [key, min, max] of integers) {
    if (!Number.isInteger(Number(constraints[key])) || Number(constraints[key]) < min || Number(constraints[key]) > max) {
      stop(`the approved route_release policy has an invalid ${key}`);
    }
  }
  if (!Array.isArray(constraints.requiredBreaks)) stop('the approved route_release policy has no requiredBreaks array');
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(constraints.dayStartLocalTime || ''))
      || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(constraints.dayEndLocalTime || ''))) {
    stop('the approved route_release policy has invalid route-day bounds');
  }
  if (!['allow', 'avoid'].includes(constraints.tollPolicy)) stop('the approved route_release policy has no valid toll policy');
}

async function must(result, label) {
  if (result.error) stop(`${label}: ${result.error.message}`);
  return result.data;
}

async function one(db, table, columns, filters, label) {
  let query = db.from(table).select(columns);
  for (const [column, expected] of Object.entries(filters)) query = query.eq(column, expected);
  const data = await must(await query.limit(1).maybeSingle(), label);
  if (!data) stop(`${label} is missing`);
  return data;
}

async function approvedPolicy(db, tenantId, policyType) {
  const rows = await must(await db.from('nurse_marketplace_policies')
    .select('id,policy_type,version,rules,effective_at')
    .eq('tenant_id', tenantId)
    .eq('policy_type', policyType)
    .eq('status', 'approved')
    .is('retired_at', null)
    .lte('effective_at', new Date().toISOString())
    .order('version', { ascending: false })
    .limit(1), `approved ${policyType} policy`);
  if (!rows?.[0]) stop(`an effective approved ${policyType} policy is required`);
  return rows[0];
}

async function assertProtocolGovernance(db, tenantId, mappingPolicy, appointment) {
  const mapping = mappingPolicy?.rules?.protocols?.[appointment.protocolKey];
  if (!mapping || mapping.mobile_enabled !== true) stop(`protocol ${appointment.protocolKey} is not enabled by the approved appointment mapping`);
  if (Number(mapping.duration_minutes) !== appointment.durationMinutes) {
    stop(`protocol ${appointment.protocolKey} must have an approved ${appointment.durationMinutes}-minute duration`);
  }
  if (!String(mapping.role_required || '').trim() || !String(mapping.manifest_key || '').trim()) {
    stop(`protocol ${appointment.protocolKey} has an incomplete approved appointment mapping`);
  }

  const manifest = await one(db, 'nurse_supply_manifests', 'id,manifest_key,active', {
    tenant_id: tenantId, manifest_key: mapping.manifest_key, active: true,
  }, `active supply manifest for ${appointment.protocolKey}`);
  const manifestVersion = await one(db, 'nurse_supply_manifest_versions', 'id,status,requirements_hash,content_hash', {
    tenant_id: tenantId, manifest_id: manifest.id, status: 'approved',
  }, `approved supply manifest version for ${appointment.protocolKey}`);
  if (!manifestVersion.requirements_hash && !manifestVersion.content_hash) {
    stop(`approved supply manifest for ${appointment.protocolKey} has no governed hash`);
  }
  const requirements = await must(await db.from('nurse_supply_manifest_requirements').select('id')
    .eq('tenant_id', tenantId).eq('manifest_version_id', manifestVersion.id).limit(1),
  `supply requirements for ${appointment.protocolKey}`);
  if (!requirements?.length) stop(`approved supply manifest for ${appointment.protocolKey} has no requirements`);

  const templates = await must(await db.from('shift_guide_templates').select('id,role_required')
    .eq('tenant_id', tenantId).eq('protocol_key', appointment.protocolKey)
    .eq('work_kind', 'mobile_appointment').eq('active', true),
  `guide template for ${appointment.protocolKey}`);
  if (!templates?.length) stop(`an active mobile guide template for ${appointment.protocolKey} is required`);
  const published = await must(await db.from('shift_guide_versions').select('id,template_id,publication_status,content_hash')
    .eq('tenant_id', tenantId).in('template_id', templates.map((row) => row.id))
    .eq('publication_status', 'published').limit(1), `published guide for ${appointment.protocolKey}`);
  if (!published?.[0]?.content_hash) stop(`a content-hashed published guide for ${appointment.protocolKey} is required`);
}

async function insertOnce(db, table, row, label) {
  const existing = await must(await db.from(table).select('id').eq('id', row.id).limit(1).maybeSingle(), `check ${label}`);
  if (existing) return { id: existing.id, created: false };
  const inserted = await must(await db.from(table).insert(row).select('id').single(), `insert ${label}`);
  return { id: inserted.id, created: true };
}

function configuration() {
  const url = value('SUPABASE_URL');
  const serviceKey = value('SUPABASE_SERVICE_ROLE_KEY');
  const projectRef = value('AVALON_BETA_SUPABASE_PROJECT_REF');
  const target = value('AVALON_BETA_TARGET');
  const nurseEmail = (value('AVALON_BETA_NURSE_EMAIL') || 'avalon-beta-nurse@example.test').toLowerCase();
  const approverEmail = (value('AVALON_BETA_COORDINATES_APPROVED_BY_EMAIL') || 'avalon-beta-admin@example.test').toLowerCase();

  if (!url || !serviceKey || !projectRef) stop('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and AVALON_BETA_SUPABASE_PROJECT_REF are required');
  let hostname;
  try { hostname = new URL(url).hostname; } catch { stop('SUPABASE_URL is invalid'); }
  if (hostname !== `${projectRef}.supabase.co`) stop('SUPABASE_URL does not exactly match AVALON_BETA_SUPABASE_PROJECT_REF');
  if (target !== 'avalonweb-beta') stop('AVALON_BETA_TARGET must equal avalonweb-beta');
  if (/prod|production|main|live/i.test(`${projectRef} ${hostname}`)) stop('the Supabase target looks like main or production');
  if (value('AVALON_BETA_COORDINATES_APPROVED') !== 'true') stop('AVALON_BETA_COORDINATES_APPROVED must equal true');
  if (value('AVALON_BETA_SYNTHETIC_GFE_PAYMENT_APPROVED') !== 'true') {
    stop('AVALON_BETA_SYNTHETIC_GFE_PAYMENT_APPROVED must equal true before synthetic appointments can be admitted');
  }
  assertTestEmail('AVALON_BETA_NURSE_EMAIL', nurseEmail);
  assertTestEmail('AVALON_BETA_COORDINATES_APPROVED_BY_EMAIL', approverEmail);

  return {
    url, serviceKey, projectRef, nurseEmail, approverEmail,
    office: {
      ...OFFICE,
      latitude: coordinate(OFFICE.latitudeEnv, -90, 90),
      longitude: coordinate(OFFICE.longitudeEnv, -180, 180),
    },
    appointments: APPOINTMENTS.map((appointment) => ({
      ...appointment,
      latitude: coordinate(appointment.latitudeEnv, -90, 90),
      longitude: coordinate(appointment.longitudeEnv, -180, 180),
    })),
  };
}

async function preflight(db, config) {
  const nurse = await one(db, 'profiles', 'id,tenant_id,email,role,status,app_metadata', {
    email: config.nurseEmail,
  }, 'restricted beta Nurse profile');
  if (!['nurse', 'rn'].includes(nurse.role) || nurse.status !== 'active') stop('the beta Nurse profile is not an active Nurse');
  if (nurse.app_metadata?.synthetic_beta !== true) stop('the beta Nurse profile is not marked synthetic_beta');

  const approver = await one(db, 'profiles', 'id,tenant_id,email,role,status,app_metadata', {
    email: config.approverEmail,
  }, 'beta coordinate approver profile');
  if (approver.tenant_id !== nurse.tenant_id || !['admin', 'founder', 'ops_manager'].includes(approver.role) || approver.status !== 'active') {
    stop('the coordinate approver must be an active beta operator in the Nurse tenant');
  }
  if (approver.app_metadata?.synthetic_beta !== true) stop('the coordinate approver is not marked synthetic_beta');

  const tenant = await one(db, 'tenants', 'id,status,brand_config', { id: nurse.tenant_id }, 'beta tenant');
  if (tenant.status !== 'active' || tenant.brand_config?.synthetic_only !== true) {
    stop('the target tenant must be active and explicitly synthetic_only');
  }

  const mappingPolicy = await approvedPolicy(db, tenant.id, 'appointment_mapping');
  const routePolicy = await approvedPolicy(db, tenant.id, 'route_release');
  assertRouteConstraints(routePolicy);
  for (const appointment of config.appointments) {
    await assertProtocolGovernance(db, tenant.id, mappingPolicy, appointment);
  }
  await must(await db.from('nurse_appointment_route_locations').select('id').limit(0), 'migration 079 route-location schema');
  await must(await db.from('nurse_marketplace_jobs').select('id').limit(0), 'migration 080 marketplace-job schema');

  const providerRows = await must(await db.from('provider_profiles').select('id,provider_role,credential_status,nursys_status,active')
    .eq('tenant_id', tenant.id).eq('profile_id', nurse.id).limit(2), 'beta Nurse provider profile');
  if (providerRows.length > 1) stop('the beta Nurse has duplicate provider profiles');
  if (providerRows[0] && (providerRows[0].provider_role !== 'rn' || providerRows[0].active !== true)) {
    stop('the beta Nurse provider profile must be an active RN');
  }
  return { tenant, nurse, approver, provider: providerRows[0] || null };
}

async function applySeed(db, config, context) {
  const ids = (key) => deterministicUuid(config.projectRef, key);
  const verifiedAt = new Date().toISOString();
  const evidenceExpiresAt = '2026-10-02T23:59:59.000Z';
  const providerId = context.provider?.id || ids('provider:nora-nurse');
  if (!context.provider) {
    await insertOnce(db, 'provider_profiles', {
      id: providerId,
      tenant_id: context.tenant.id,
      profile_id: context.nurse.id,
      provider_role: 'rn',
      credential_status: 'pending',
      nursys_status: 'placeholder',
      scope_tags: ['synthetic_beta'],
      active: true,
    }, 'pending synthetic Nurse provider profile');
  }

  await insertOnce(db, 'provider_route_origins', {
    id: ids('origin:sf-office'),
    tenant_id: context.tenant.id,
    owner_profile_id: null,
    kind: 'office',
    label: config.office.label,
    address: config.office.address,
    latitude: config.office.latitude,
    longitude: config.office.longitude,
    is_default: false,
  }, 'verified beta office origin');

  let created = 0;
  for (const appointment of config.appointments) {
    const personId = ids(`person:${appointment.key}`);
    const appointmentId = ids(`appointment:${appointment.key}`);
    const eventId = ids(`source-event:${appointment.key}:v1`);
    created += Number((await insertOnce(db, 'people', {
      id: personId,
      tenant_id: context.tenant.id,
      display_name: appointment.displayName,
      source_of_truth: 'manual',
      phi_classification: 'non_phi',
      status: 'active',
    }, `synthetic ${appointment.key} person`)).created);
    await insertOnce(db, 'person_roles', {
      id: ids(`person-role:${appointment.key}:patient`),
      tenant_id: context.tenant.id,
      person_id: personId,
      role: 'patient',
      active: true,
    }, `synthetic ${appointment.key} patient role`);
    await insertOnce(db, 'appointments', {
      id: appointmentId,
      tenant_id: context.tenant.id,
      patient_person_id: personId,
      status: 'scheduled',
      starts_at: new Date(appointment.startsAt).toISOString(),
      service_mode: 'mobile',
      protocol_key: appointment.protocolKey,
      gfe_status: 'not_required',
      payment_status: 'not_required',
      acuity_appointment_id: `synthetic-beta-${SCENARIO_KEY}-${appointment.key}`,
      reconciliation_status: 'pending',
      external_payload: {
        synthetic_beta: true,
        synthetic_scenario_key: SCENARIO_KEY,
        service_label: appointment.serviceLabel,
        duration_minutes: appointment.durationMinutes,
        service_address: appointment.address,
      },
    }, `synthetic ${appointment.key} appointment`);
    await insertOnce(db, 'nurse_appointment_route_locations', {
      id: ids(`route-location:${appointment.key}:v1`),
      tenant_id: context.tenant.id,
      appointment_id: appointmentId,
      version: 1,
      latitude: appointment.latitude,
      longitude: appointment.longitude,
      provenance_source: 'approved_operations_entry',
      provenance_hash: sha256({
        scenario: SCENARIO_KEY,
        appointment: appointment.key,
        address: appointment.address,
        latitude: appointment.latitude,
        longitude: appointment.longitude,
        approvedBy: context.approver.id,
      }),
      verified_by: context.approver.id,
      verified_at: verifiedAt,
      expires_at: evidenceExpiresAt,
    }, `verified ${appointment.key} route coordinates`);
    const eventPayload = {
      synthetic_beta: true,
      synthetic_scenario_key: SCENARIO_KEY,
      verification_mode: 'explicit_beta_operator_attestation_not_external_signature',
      canonical_appointment_id: appointmentId,
      protocol_key: appointment.protocolKey,
      duration_minutes: appointment.durationMinutes,
    };
    await insertOnce(db, 'nurse_appointment_source_events', {
      id: eventId,
      tenant_id: context.tenant.id,
      source_provider: 'synthetic_beta_seed',
      source_appointment_id: `synthetic-beta-${SCENARIO_KEY}-${appointment.key}`,
      source_revision: 'seed-v1',
      event_type: 'scheduled',
      event_occurred_at: '2026-09-02T15:00:00.000Z',
      signature_verified_at: verifiedAt,
      payload: eventPayload,
      payload_hash: sha256(eventPayload),
      status: 'pending',
    }, `synthetic ${appointment.key} appointment source event`);
    await insertOnce(db, 'nurse_marketplace_jobs', {
      id: ids(`job:reconcile:${appointment.key}:v1`),
      tenant_id: context.tenant.id,
      job_type: 'appointment_reconcile',
      idempotency_key: `synthetic-beta-route:${ROUTE_DATE}:${appointment.key}:v1`,
      payload: {
        event_id: eventId,
        source_provider: 'synthetic_beta_seed',
        source_appointment_id: `synthetic-beta-${SCENARIO_KEY}-${appointment.key}`,
        source_revision: 'seed-v1',
        canonical_appointment_id: appointmentId,
        approvedCandidates: [],
      },
      status: 'pending',
      available_at: new Date().toISOString(),
    }, `synthetic ${appointment.key} reconciliation job`);
  }
  return { created, providerCredentialStatus: context.provider?.credential_status || 'pending' };
}

async function main() {
  if (!APPLY && !CHECK) {
    console.log('Dry run only: would bootstrap the 2026-09-02 synthetic Nurse route upstream records in an explicitly isolated beta Supabase project.');
    console.log('No database or provider call was made. Use --check for a read-only preflight or --apply after completing the documented beta gates.');
    return;
  }
  const config = configuration();
  const db = createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const context = await preflight(db, config);
  if (CHECK) {
    console.log('Beta route seed preflight passed. Target isolation, test identities, governed policies, manifests, guides, and coordinate attestation are present.');
    return;
  }
  const outcome = await applySeed(db, config, context);
  console.log(`Synthetic beta route upstream seed completed for ${ROUTE_DATE}; ${outcome.created} new patient record(s).`);
  console.log('No readiness, offer, assignment, route feasibility, route plan, or release decision was fabricated. Run the authenticated beta worker and complete the remaining human/provider gates.');
  if (outcome.providerCredentialStatus !== 'clear') {
    console.log('The synthetic Nurse provider remains credential-blocked until beta credential evidence is explicitly approved.');
  }
}

main().catch((error) => {
  console.error(error?.message || 'Seed refused.');
  process.exitCode = 1;
});
