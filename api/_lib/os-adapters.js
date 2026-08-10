const PROVIDERS = Object.freeze({
  acuity: { label: 'Acuity', mode: 'sandbox', required: ['ACUITY_USER_ID', 'ACUITY_API_KEY'] },
  stripe: { label: 'Stripe', mode: 'sandbox', required: ['STRIPE_SECRET_KEY'] },
  supabase: { label: 'Supabase', mode: 'sandbox', required: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] },
  resend: { label: 'Resend', mode: 'sandbox', required: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'] },
  quo: { label: 'Quo', mode: 'sandbox', required: ['QUO_API_KEY', 'QUO_FROM_NUMBER'] },
  hubspot: { label: 'HubSpot', mode: 'sandbox', required: ['HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_PORTAL_ID'] },
  mercury: { label: 'Mercury', mode: 'manual', required: [] },
  quickbooks: { label: 'QuickBooks', mode: 'manual', required: [] },
  gusto: { label: 'Gusto', mode: 'manual', required: [] },
  nursys: { label: 'Nursys', mode: 'manual', required: [] },
  qualiphy: { label: 'Qualiphy', mode: 'sandbox', required: ['QUALIPHY_API_KEY'] },
});

export const OS_ADAPTER_OPERATIONS = Object.freeze(['health', 'import', 'export', 'sync', 'retry', 'disconnect']);

export function getOsAdapter(provider) {
  const key = String(provider || '').trim().toLowerCase();
  const definition = PROVIDERS[key];
  return definition ? { provider: key, ...definition } : null;
}

export function adapterHealth(adapter) {
  const missing = adapter.required.filter((name) => !String(process.env[name] || '').trim());
  if (adapter.mode === 'manual') {
    return {
      provider: adapter.provider,
      label: adapter.label,
      mode: 'manual',
      status: 'healthy',
      action: 'Use validated import/export files; no provider credential is required.',
      missing: [],
    };
  }
  return {
    provider: adapter.provider,
    label: adapter.label,
    mode: adapter.mode,
    status: missing.length ? 'action_required' : 'healthy',
    action: missing.length ? 'Provision the missing beta-only environment variables.' : 'Sandbox adapter is configured.',
    missing,
  };
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { cells.push(current.trim()); current = ''; continue; }
    current += char;
  }
  cells.push(current.trim());
  return { cells, valid: !quoted };
}

export function validateManualImport(input) {
  let rows;
  let columns;
  if (Array.isArray(input?.rows)) {
    rows = input.rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
    columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 80);
  } else {
    const csv = String(input?.csv || '').trim();
    if (!csv) return { valid: false, rowCount: 0, columns: [], rows: [], duplicates: [], error: 'CSV or rows are required.' };
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const header = splitCsvLine(lines.shift() || '');
    if (!header.valid) return { valid: false, rowCount: 0, columns: [], rows: [], duplicates: [], error: 'CSV contains an unterminated quoted header.' };
    columns = header.cells.map((cell) => cell.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    if (!columns.length || columns.some((column) => !column) || new Set(columns).size !== columns.length) {
      return { valid: false, rowCount: 0, columns: [], rows: [], duplicates: [], error: 'CSV headers are invalid or duplicated.' };
    }
    rows = [];
    for (const line of lines) {
      const parsed = splitCsvLine(line);
      if (!parsed.valid) return { valid: false, rowCount: 0, columns, rows: [], duplicates: [], error: 'CSV contains an unterminated quoted value.' };
      rows.push(Object.fromEntries(columns.map((column, index) => [column, parsed.cells[index] ?? ''])));
    }
  }
  const identityFields = ['idempotency_key', 'external_id', 'id', 'reference', 'transaction_id'];
  const identityField = identityFields.find((field) => columns.includes(field));
  const seen = new Set();
  const duplicates = [];
  if (identityField) {
    for (const [index, row] of rows.entries()) {
      const identity = String(row[identityField] || '').trim();
      if (!identity) continue;
      if (seen.has(identity)) duplicates.push({ row: index + 2, field: identityField, value: identity });
      seen.add(identity);
    }
  }
  return {
    valid: rows.length > 0 && duplicates.length === 0,
    rowCount: rows.length,
    columns,
    rows,
    duplicates,
    ...(duplicates.length ? { error: 'Import contains duplicate identifiers and requires reconciliation.' } : {}),
  };
}

export function adapterFailureState(input = {}) {
  const status = Number(input.status || input.statusCode || 0);
  const code = String(input.code || '').trim().toLowerCase();
  if (status === 429 || code === 'rate_limited') return { status: 'failed', code: 'rate_limited', retryable: true, action: 'Retry after the provider backoff window.' };
  if (status >= 500 || code === 'provider_unavailable') return { status: 'failed', code: 'provider_unavailable', retryable: true, action: 'Retry when the provider is available or use manual mode.' };
  if (status === 401 || status === 403 || code === 'credentials_invalid') return { status: 'action_required', code: 'credentials_invalid', retryable: false, action: 'Replace the beta-only provider credentials.' };
  return { status: 'failed', code: code || 'adapter_error', retryable: false, action: 'Review the import or reconciliation evidence.' };
}

export function csvExport(records = []) {
  const rows = records.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [columns.map(quote).join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\n');
}
