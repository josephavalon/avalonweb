import assert from 'node:assert/strict';
import {
  OS_ADAPTER_OPERATIONS,
  adapterFailureState,
  adapterHealth,
  csvExport,
  getOsAdapter,
  validateManualImport,
} from '../api/_lib/os-adapters.js';

assert.deepEqual(OS_ADAPTER_OPERATIONS, ['health', 'import', 'export', 'sync', 'retry', 'disconnect']);

for (const provider of ['acuity', 'stripe', 'supabase', 'resend', 'quo', 'hubspot', 'mercury', 'gusto', 'nursys', 'qualiphy']) {
  const adapter = getOsAdapter(provider);
  assert.equal(adapter.provider, provider);
  const health = adapterHealth(adapter);
  assert.ok(['healthy', 'action_required'].includes(health.status));
  assert.ok(['sandbox', 'manual'].includes(health.mode));
  assert.equal(typeof health.action, 'string');
}

assert.equal(getOsAdapter('quickbooks'), null, 'QuickBooks must not remain an active Avalon OS adapter.');

assert.equal(getOsAdapter('unknown'), null);
assert.equal(validateManualImport({}).valid, false);
assert.equal(validateManualImport({ csv: 'id,name\n"unterminated,Avalon' }).valid, false);
assert.equal(validateManualImport({ csv: 'id,id\n1,2' }).valid, false);

const valid = validateManualImport({ csv: 'external_id,amount_cents\nrow-1,1200\nrow-2,2400' });
assert.equal(valid.valid, true);
assert.equal(valid.rowCount, 2);
assert.equal(valid.rows[1].amount_cents, '2400');

const duplicate = validateManualImport({ rows: [
  { idempotency_key: 'same-key', amount_cents: 1200 },
  { idempotency_key: 'same-key', amount_cents: 1200 },
] });
assert.equal(duplicate.valid, false);
assert.equal(duplicate.duplicates.length, 1);

const exported = csvExport(valid.rows);
assert.ok(exported.includes('external_id'));
assert.ok(exported.includes('row-2'));

assert.deepEqual(adapterFailureState({ status: 429 }), {
  status: 'failed', code: 'rate_limited', retryable: true, action: 'Retry after the provider backoff window.',
});
assert.equal(adapterFailureState({ status: 503 }).retryable, true);
assert.equal(adapterFailureState({ status: 401 }).status, 'action_required');
assert.equal(adapterFailureState({ code: 'malformed_import' }).retryable, false);

console.log('Avalon OS adapter contract QA passed health, imports, duplicates, exports, rate limits, unavailable providers, retries, and actionable failures.');
