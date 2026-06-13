import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildStripeCheckoutMetadata,
  isLegacyStripeMetadataPayload,
} from '../api/_checkout-fulfillment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL: ${message}`);
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function isTextBuildFile(filePath) {
  return /\.(?:html|js|css|json|txt|xml|svg|webmanifest)$/i.test(filePath);
}

function relative(filePath) {
  return path.relative(repoRoot, filePath);
}

function scanDist() {
  const indexPath = path.join(distRoot, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fail('dist/index.html is missing. Run npm run build before npm run test:launch-blockers.');
    return;
  }

  const forbiddenLiterals = [
    {
      value: ['Jon', 'Jones', '1986'].join(''),
      label: 'retired hardcoded demo password',
    },
    {
      value: 'summary_token',
      label: 'appointment summary token query transport',
    },
    {
      value: 'AVALON_INTERNAL_API_SECRET',
      label: 'internal API secret env name',
    },
    {
      value: 'STRIPE_SECRET_KEY',
      label: 'Stripe secret env name',
    },
    {
      value: 'APPOINTMENT_SUMMARY_TOKEN_SECRET',
      label: 'summary-token signing secret env name',
    },
    {
      value: 'SUPABASE_SERVICE_ROLE_KEY',
      label: 'Supabase service-role secret env name',
    },
    {
      value: 'ACUITY_API_KEY',
      label: 'Acuity secret env name',
    },
    {
      value: 'RESEND_API_KEY',
      label: 'Resend secret env name',
    },
    {
      value: 'ATTIO_ACCESS_TOKEN',
      label: 'Attio secret env name',
    },
  ];

  const liveDemoPassword =
    process.env.VITE_AVALON_ENABLE_LIVE_API === 'true'
      ? String(process.env.VITE_AVALON_DEMO_PASSWORD || '')
      : '';
  if (liveDemoPassword) {
    forbiddenLiterals.push({
      value: liveDemoPassword,
      label: 'live build demo password value',
    });
  }

  for (const filePath of walkFiles(distRoot).filter(isTextBuildFile)) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const { value, label } of forbiddenLiterals) {
      if (value && source.includes(value)) {
        fail(`${relative(filePath)} contains ${label}`);
      }
    }
  }
}

function checkStripeMetadataShape() {
  const metadata = buildStripeCheckoutMetadata({
    appointmentRecordId: 'appt_live_guard',
    contact: {
      name: 'Jane Patient',
      firstName: 'Jane',
      lastName: 'Patient',
      email: 'jane@example.com',
      phone: '4155551212',
      dob: '1980-01-01',
      emergencyContact: 'Care Partner',
    },
    appointment: {
      localBookingId: 'AV-123',
      reference: 'ref_123',
      acuityDatetime: '2026-06-20T17:00:00Z',
      acuityTimezone: 'America/Los_Angeles',
      address: '123 Health St',
      zip: '94107',
      guests: '2',
      locationType: 'home',
      orderType: 'visit',
      paymentType: 'one_time_deposit',
      notes: 'Sensitive intake note',
      clientType: 'new',
      clinicalReviewOnFile: true,
      gfeRequired: true,
      dob: '1980-01-01',
      emergencyContact: 'Care Partner',
    },
    items: [
      {
        key: 'nad_1000',
        cartKey: 'nad_1000',
        label: 'NAD+ (1000mg)',
        type: 'addon',
        price: 800,
      },
    ],
    membership: {
      name: 'Recovery',
      billing: 'monthly',
      price: 499,
    },
    paymentMethod: 'card',
    primaryService: 'NAD+ (1000mg)',
    visitSubtotalCents: 80000,
    depositCents: 5000,
    balanceDueCents: 75000,
  });

  const forbiddenKeys = [
    'customerName',
    'customerEmail',
    'firstName',
    'lastName',
    'phone',
    'dob',
    'emergencyContact',
    'address',
    'zip',
    'notes',
    'clientType',
    'clinicalReviewOnFile',
    'gfeRequired',
    'itemPrices',
  ];

  for (const key of forbiddenKeys) {
    if (Object.hasOwn(metadata, key)) {
      fail(`Stripe checkout metadata still emits PHI/high-risk key: ${key}`);
    }
  }

  for (const requiredKey of [
    'fulfillment',
    'appointmentRecordId',
    'paymentMethod',
    'paymentType',
    'itemLabels',
    'itemKeys',
    'itemTypes',
    'visitSubtotalCents',
    'depositAmountCents',
    'balanceDueCents',
  ]) {
    if (!Object.hasOwn(metadata, requiredKey)) {
      fail(`Stripe checkout metadata dropped operational key: ${requiredKey}`);
    }
  }

  if (isLegacyStripeMetadataPayload(metadata)) {
    fail('Current Stripe checkout metadata must not be treated as a legacy PHI-rich fulfillment payload');
  }

  if (!isLegacyStripeMetadataPayload({
    customerEmail: 'legacy@example.com',
    address: '123 Legacy St',
    acuityDatetime: '2026-06-20T17:00:00Z',
  })) {
    fail('Legacy Stripe metadata detection must still recognize old PHI-rich sessions');
  }
}

function checkStripeMetadataFallbackIsLegacyOnly() {
  const verifySource = readRepoFile('api/checkout/verify.js');
  const webhookSource = readRepoFile('api/integrations/stripe/webhook.js');
  const summarySource = readRepoFile('api/appointment-summary.js');
  for (const [label, source] of [
    ['api/checkout/verify.js', verifySource],
    ['api/integrations/stripe/webhook.js', webhookSource],
    ['api/appointment-summary.js', summarySource],
  ]) {
    if (!source.includes('isLegacyStripeMetadataPayload')) {
      fail(`${label} must guard Stripe metadata fallback as legacy-only`);
    }
  }
  if (!verifySource.includes('checkout_record_missing_or_redacted')) {
    fail('checkout/verify must reconcile paid sessions whose Supabase checkout payload is missing');
  }
  if (!webhookSource.includes('deposit_paid_checkout_record_missing')) {
    fail('Stripe webhook must not schedule from current redacted metadata when the appointment record is missing');
  }
  if (!summarySource.includes('summary_payload_missing')) {
    fail('appointment-summary must not render identifiable details from current redacted metadata alone');
  }
}

function checkSchedulingRaceLoserDefers() {
  const verifySource = readRepoFile('api/checkout/verify.js');
  const webhookSource = readRepoFile('api/integrations/stripe/webhook.js');

  for (const [label, source] of [
    ['api/checkout/verify.js', verifySource],
    ['api/integrations/stripe/webhook.js', webhookSource],
  ]) {
    for (const required of [
      'claimSchedulingCreation',
      'readAcuityAppointmentId',
      'async function pollAcuityAppointmentId(db, recordId, attempts = 5, delayMs = 1000)',
      'for (let attempt = 0; attempt < attempts; attempt += 1)',
      'if (attempt < attempts - 1)',
      'setTimeout(resolve, delayMs)',
      'if (!wonSchedulingClaim)',
      'const existingId = await pollAcuityAppointmentId',
      'schedulingDeferred = true',
    ]) {
      if (!source.includes(required)) {
        fail(`${label} missing scheduling race loser guard: ${required}`);
      }
    }
  }

  if (!verifySource.includes('pendingFulfillment: paid && !fulfillment.appointmentId')) {
    fail('checkout/verify must surface pendingFulfillment when the race winner has not persisted an Acuity id yet');
  }
  if (!verifySource.includes("fulfillment.fulfillmentStatus !== 'acuity_failed'")) {
    fail('checkout/verify pendingFulfillment must not hide confirmed Acuity failures');
  }
  if (!webhookSource.includes("action: 'deposit_paid_checkout_record_missing'")) {
    fail('Stripe webhook must defer current redacted sessions with missing checkout records instead of scheduling from metadata');
  }
}

function checkAppointmentSummaryAuth() {
  const source = readRepoFile('api/appointment-summary.js');
  if (!source.includes("req.headers?.['x-appointment-summary-token']")) {
    fail('appointment-summary must read signed summary tokens from a header');
  }
  if (source.includes("req.query?.summary_token\n    ||") || source.includes("req.query?.summary_token ||")) {
    fail('appointment-summary must not authorize signed summary tokens from query strings');
  }
  for (const required of [
    'summary_auth_required',
    'summary_token_query',
    'verifyAppointmentSummaryToken',
    'appointment_summary_read',
    'appointment_summary_denied',
  ]) {
    if (!source.includes(required)) {
      fail(`appointment-summary missing launch auth/audit guard: ${required}`);
    }
  }
}

function checkDemoAuthHardening() {
  const authStoreSource = readRepoFile('src/lib/useAuthStore.js');
  const preApiSecuritySource = readRepoFile('src/lib/preApiSecurity.js');
  const viteConfigSource = readRepoFile('vite.config.js');
  const loginQaSource = readRepoFile('scripts/login-qa.mjs');
  const releaseQaSource = readRepoFile('scripts/release-qa.mjs');
  const oldDemoPassword = ['Jon', 'Jones', '1986'].join('');
  if (fs.existsSync(path.join(repoRoot, 'app-modules/pages/Login 2.jsx'))) {
    fail('Stale duplicate login page must not ship; it can preserve retired demo shortcuts or password display logic');
  }

  for (const [label, source] of [
    ['src/lib/useAuthStore.js', authStoreSource],
    ['scripts/login-qa.mjs', loginQaSource],
  ]) {
    if (source.includes(oldDemoPassword)) {
      fail(`${label} still contains the retired hardcoded demo password`);
    }
  }

  if (!authStoreSource.includes('VITE_AVALON_DEMO_PASSWORD')) {
    fail('Demo auth must be sourced from VITE_AVALON_DEMO_PASSWORD');
  }
  if (!preApiSecuritySource.includes('isLiveApiArmed') || !preApiSecuritySource.includes('!isLiveApiArmed()')) {
    fail('Demo auth must be disabled when live API mode is enabled');
  }
  if (!viteConfigSource.includes('redactDemoPasswordPlugin')) {
    fail('Vite build must redact demo credentials from live API bundles');
  }
  if (!loginQaSource.includes("requireDemoPassword('LOGIN_QA_PASSWORD'")) {
    fail('Login QA must require env-provided demo credentials');
  }
  for (const required of [
    'randomUUID',
    'releaseQaEnv',
    "VITE_AVALON_ENABLE_LIVE_API: 'false'",
    "AVALON_ENABLE_LIVE_API: 'false'",
    "VITE_SUPABASE_URL: ''",
    "VITE_SUPABASE_ANON_KEY: ''",
    'VITE_AVALON_DEMO_PASSWORD: RELEASE_QA_DEMO_PASSWORD',
    'LOGIN_QA_PASSWORD: RELEASE_QA_DEMO_PASSWORD',
    'INTERACTION_QA_PASSWORD: RELEASE_QA_DEMO_PASSWORD',
  ]) {
    if (!releaseQaSource.includes(required)) {
      fail(`Release QA must use one ephemeral demo password for build/login checks: ${required}`);
    }
  }
}

function checkBalanceChargeIntegrity() {
  const endpoints = [
    {
      label: 'api/admin/collect-balance.js',
      source: readRepoFile('api/admin/collect-balance.js'),
      actorNeedle: 'actorProfileId: authed.user?.id || null',
    },
    {
      label: 'api/charge-balance.js',
      source: readRepoFile('api/charge-balance.js'),
      actorNeedle: "actor: 'internal_service'",
    },
  ];

  for (const { label, source, actorNeedle } of endpoints) {
    for (const required of [
      'function resolveChargeAmount',
      'const amount = hasOverride ? Number(requestedOverride) : balance',
      'if (hasOverride && amount > balance)',
      'override_exceeds_balance',
      'requestedOverride: amountCentsOverride',
      'balanceDue: appt.balance_due_cents',
      'writeAuditEvent',
      "action: 'balance_charge_rejected'",
      "action: 'balance_charge_attempt'",
      'appointmentId: appt.id',
      'amountCents: amount',
      'balanceDueCents: Number(appt.balance_due_cents || 0)',
      'mode,',
      'override: Boolean(resolved.hasOverride)',
      'resultCode:',
      actorNeedle,
    ]) {
      if (!source.includes(required)) {
        fail(`${label} missing balance-charge integrity guard: ${required}`);
      }
    }

    for (const forbiddenAuditField of [
      'customerEmail',
      'customerName',
      'firstName',
      'lastName',
      'phone',
      'dob',
      'emergencyContact',
      'address',
      'zip',
      'notes',
      'clinicalReviewOnFile',
      'gfeRequired',
    ]) {
      if (source.includes(forbiddenAuditField)) {
        fail(`${label} balance audit path must not include PHI field: ${forbiddenAuditField}`);
      }
    }
  }
}

function checkGoLiveRunbook() {
  const runbook = readRepoFile('docs/GO_LIVE_STAGING_DRILLS.md');
  for (const required of [
    'Stripe Metadata Inspection',
    'Unauthenticated Appointment Summary Probe',
    'Forced Acuity Failure After Paid Stripe Checkout',
    'Webhook/Verify Race Refresh',
    'Balance Charge Override And Audit Events',
    'Email And CRM Failure Reconciliation',
    'Live Revenue Matrix After Deploy',
    'APPOINTMENT_SUMMARY_TOKEN_SECRET',
    'supabase/migrations/011_launch_messaging_roles.sql',
    'stripe_succeeded_acuity_failed',
    'summary_auth_required',
    'operations_email_failed',
    'customer_email_failed',
    'crm_sync_failed',
    'audit_events',
    'REVENUE_MATRIX_BASE_URL',
  ]) {
    if (!runbook.includes(required)) {
      fail(`Go-live staging runbook missing required launch drill/evidence term: ${required}`);
    }
  }
}

function checkLaunchEnvDocs() {
  const envExample = readRepoFile('.env.example');
  const authSetup = readRepoFile('docs/AUTH_SETUP.md');
  for (const required of [
    'VITE_AVALON_ENABLE_LIVE_API',
    'AVALON_ENABLE_LIVE_API',
    'APPOINTMENT_SUMMARY_TOKEN_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'AVALON_INTERNAL_API_SECRET',
    'ACUITY_API_KEY',
    'RESEND_API_KEY',
    'ATTIO_ACCESS_TOKEN',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
  ]) {
    if (!envExample.includes(required)) {
      fail(`.env.example missing launch-critical environment key: ${required}`);
    }
    if (!authSetup.includes(required)) {
      fail(`docs/AUTH_SETUP.md missing launch-critical environment key: ${required}`);
    }
  }
}

function checkGoLiveStatusLedger() {
  const status = readRepoFile('docs/GO_LIVE_STATUS.md');
  for (const required of [
    'GL-001',
    'GL-002',
    'GL-003',
    'GL-004',
    'GL-005',
    'GL-006',
    'GL-007',
    'GL-008',
    'GL-009',
    'GL-010',
    'GL-011',
    'GL-012',
    'GL-013',
    'GL-014',
    'GL-015',
    'VITE_AVALON_ENABLE_LIVE_API=true',
    'AVALON_ENABLE_LIVE_API=true',
    'APPOINTMENT_SUMMARY_TOKEN_SECRET',
    'supabase/migrations/011_launch_messaging_roles.sql',
    'Stripe metadata drill',
    'Appointment-summary auth drill',
    'Acuity failure drill',
    'Webhook/verify race drill',
    'Balance charge audit drill',
    'Email/CRM failure drill',
    'Post-deploy revenue matrix',
    'Rate-limit backend',
    'BAAs',
    'MFA',
    'key',
    'pending user action',
    'pending staging drill',
  ]) {
    if (!status.includes(required)) {
      fail(`Go-live status ledger missing required launch status term: ${required}`);
    }
  }
}

scanDist();
checkStripeMetadataShape();
checkStripeMetadataFallbackIsLegacyOnly();
checkSchedulingRaceLoserDefers();
checkAppointmentSummaryAuth();
checkDemoAuthHardening();
checkBalanceChargeIntegrity();
checkGoLiveRunbook();
checkLaunchEnvDocs();
checkGoLiveStatusLedger();

if (failed) {
  console.error('\nLaunch-blocker QA failed.');
  process.exit(1);
}

console.log('PASS: launch-blocker build artifact and PHI guardrails are clear.');
