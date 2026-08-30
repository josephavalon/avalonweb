import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Download, Loader2, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { authedFetch, apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { assertApiResponse, hasObjectRows, invalidApiResponse } from '@/lib/apiResponse';
import { getOsCapability } from '@/data/osCapabilities';

const STATUS_OPTIONS = ['active', 'draft', 'pending', 'approved', 'blocked', 'complete'];
const CARD = 'hsl(var(--card) / 0.9)';
const BORDER = 'hsl(var(--foreground) / 0.12)';
const MUTED = 'hsl(var(--foreground) / 0.62)';

function makeKey(prefix = 'os') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function money(cents) {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents) / 100);
}

function dateLabel(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toCsv(records) {
  const columns = ['title', 'status', 'record_type', 'amount_cents', 'effective_at', 'updated_at'];
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [columns.join(','), ...records.map((record) => columns.map((column) => quote(record[column])).join(','))].join('\n');
}

function downloadCsv(capability, records) {
  const blob = new Blob([toCsv(records)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${capability.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function RecordEditor({ initial, onCancel, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    title: initial?.title || '',
    status: initial?.status || 'active',
    record_type: initial?.record_type || 'record',
    amount: initial?.amount_cents == null ? '' : String(initial.amount_cents / 100),
    effective_at: initial?.effective_at ? initial.effective_at.slice(0, 10) : '',
    notes: initial?.data?.notes || '',
  }));

  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...(initial ? { id: initial.id, version: initial.version } : {}),
      title: form.title,
      status: form.status,
      record_type: form.record_type,
      amount_cents: form.amount === '' ? null : Math.round(Number(form.amount) * 100),
      effective_at: form.effective_at ? `${form.effective_at}T12:00:00.000Z` : null,
      data: { ...(initial?.data || {}), notes: form.notes },
      idempotencyKey: makeKey(initial ? 'update' : 'create'),
    });
  };

  const field = 'min-h-11 w-full rounded-xl border border-foreground/15 bg-background/70 px-3 font-body text-sm text-foreground outline-none focus:border-foreground/35';
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl p-4 md:grid-cols-2" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <label className="grid gap-1.5 md:col-span-2">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Title</span>
        <input required maxLength={240} className={field} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
      </label>
      <label className="grid gap-1.5">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Status</span>
        <select className={field} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
          {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Record type</span>
        <input maxLength={64} className={field} value={form.record_type} onChange={(event) => setForm((current) => ({ ...current, record_type: event.target.value }))} />
      </label>
      <label className="grid gap-1.5">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Amount (USD)</span>
        <input inputMode="decimal" className={field} value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
      </label>
      <label className="grid gap-1.5">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Effective date</span>
        <input type="date" className={field} value={form.effective_at} onChange={(event) => setForm((current) => ({ ...current, effective_at: event.target.value }))} />
      </label>
      <label className="grid gap-1.5 md:col-span-2">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Notes</span>
        <textarea rows={3} className={`${field} py-3`} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
      </label>
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" onClick={onCancel} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/15 px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em]"><X className="h-3.5 w-3.5" />Cancel</button>
        <button disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-5 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-background disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{initial ? 'Save changes' : 'Create record'}</button>
      </div>
    </form>
  );
}

function IntegrationPanel({ provider }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [csv, setCsv] = useState('external_id,status,amount_cents\n');
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await apiGet(`/api/os/v1/integrations/${provider}`);
      assertApiResponse(response, { objects: ['data', 'data.adapter'], arrays: ['data.jobs', 'data.operations'] }, 'Integration returned an invalid response.');
      if (!hasObjectRows(response.data.jobs)) throw invalidApiResponse('Integration returned invalid job records.');
      setState({ loading: false, error: '', data: response.data });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Could not load integration.', data: null });
    }
  }, [provider]);
  useEffect(() => { load(); }, [load]);

  const run = async (operation) => {
    setState({ loading: true, error: '', data: null });
    try {
      const payload = { operation, idempotencyKey: makeKey(operation) };
      if (operation === 'import') payload.csv = csv;
      if (operation === 'export') payload.rows = (state.data?.jobs || []).map((job) => ({ id: job.id, operation: job.operation, status: job.status, created_at: job.created_at }));
      const response = await apiPost(`/api/os/v1/integrations/${provider}`, payload);
      const exported = response.data?.job?.output_summary?.csv;
      if (operation === 'export' && exported) {
        const blob = new Blob([exported], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${provider}-audit-export.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }
      await load();
    } catch (error) {
      setState({ loading: false, error: error.message || 'Operation failed.', data: null });
    }
  };

  if (state.loading && !state.data) return <div className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (state.error && !state.data) {
    return (
      <OperationalSourceUnavailable
        title="Integration source unavailable"
        description="Adapter health and job history could not be verified. No placeholder status is shown, and import, export, sync, retry, and disconnect actions remain disabled."
      />
    );
  }
  const adapter = state.data?.adapter;
  return (
    <section className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: MUTED }}>Adapter health</p>
          <h2 className="mt-1 font-heading text-3xl uppercase">{adapter?.label || provider}</h2>
          <p className="mt-2 max-w-xl font-body text-sm" style={{ color: MUTED }}>{adapter?.action}</p>
        </div>
        <span className="rounded-full border border-foreground/15 px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.14em]">{adapter?.status || 'unknown'} · {adapter?.mode || 'manual'}</span>
      </div>
      {state.error ? <p className="mt-3 rounded-xl bg-red-500/10 p-3 font-body text-sm text-red-700">{state.error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {['health', 'import', 'export', 'sync', 'retry', 'disconnect'].map((operation) => (
          <button key={operation} type="button" onClick={() => run(operation)} disabled={state.loading} className="min-h-10 rounded-full border border-foreground/15 px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-45">{operation}</button>
        ))}
      </div>
      {adapter?.mode === 'manual' ? <label className="mt-4 grid gap-1.5"><span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Validated CSV import</span><textarea rows={4} value={csv} onChange={(event) => setCsv(event.target.value)} className="rounded-xl border border-foreground/15 bg-background/70 p-3 font-mono text-xs text-foreground outline-none focus:border-foreground/35" /></label> : null}
    </section>
  );
}

const REPORT_TYPES = Object.freeze({
  'inventory-value': 'inventory_value',
  'inventory-turnover': 'inventory_turnover',
  'expired-inventory': 'expiry',
  shrinkage: 'shrinkage',
  'vendor-spend': 'vendor_spend',
  'cost-analysis': 'cost_analysis',
  'profit-and-loss': 'profit_and_loss',
  'balance-sheet': 'balance_sheet',
  'cash-flow': 'cash_flow',
  'cash-flow-statement': 'cash_flow',
  'general-ledger': 'general_ledger',
  'unit-economics': 'unit_economics',
  'kpi-scorecard': 'kpi_scorecard',
  'budget-vs-actual': 'budget_vs_actual',
  'board-reports': 'board_report',
});

function ReportPanel({ capability }) {
  const reportType = REPORT_TYPES[capability.slug] || 'custom';
  const [state, setState] = useState({ loading: true, saving: false, error: '', data: null });
  const load = useCallback(async () => {
    setState({ loading: true, saving: false, error: '', data: null });
    try {
      const response = await apiGet(`/api/os/v1/reports?type=${reportType}`);
      assertApiResponse(response, { objects: ['data', 'data.totals'], arrays: ['data.rows'] }, 'Reports returned an invalid response.');
      if (!hasObjectRows(response.data.rows)) throw invalidApiResponse('Reports returned invalid ledger records.');
      setState({ loading: false, saving: false, error: '', data: response.data });
    } catch (error) {
      setState({ loading: false, saving: false, error: error.message || 'Could not generate report.', data: null });
    }
  }, [reportType]);
  useEffect(() => { load(); }, [load]);

  const snapshot = async () => {
    setState((current) => ({ ...current, saving: true, error: '' }));
    try {
      await apiPost('/api/os/v1/reports', { report_type: reportType, idempotencyKey: makeKey('report') });
      setState((current) => ({ ...current, saving: false }));
    } catch (error) {
      setState({ loading: false, saving: false, error: error.message || 'Could not save report snapshot.', data: null });
    }
  };

  if (state.loading && !state.data) {
    return <div className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  const totals = state.data?.totals || {};
  if (!state.loading && state.error && !state.data) {
    return (
      <OperationalSourceUnavailable
        title="Report source unavailable"
        description="The ledger-derived report could not be verified. No zeroed totals are shown, and snapshot actions remain disabled until the live source reconnects."
      />
    );
  }
  return (
    <section className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: MUTED }}>Ledger-derived report</p><h2 className="mt-1 font-heading text-3xl uppercase">Current calculation</h2></div>
        <div className="flex gap-2"><button type="button" onClick={load} disabled={state.loading} className="min-h-10 rounded-full border border-foreground/15 px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-45">Refresh</button><button type="button" onClick={snapshot} disabled={state.saving || state.loading} className="min-h-10 rounded-full bg-foreground px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-background disabled:opacity-45">Save snapshot</button></div>
      </div>
      {state.error ? <p className="mt-3 rounded-xl bg-red-500/10 p-3 font-body text-sm text-red-700">{state.error}</p> : null}
      {state.loading ? <p className="mt-4 flex items-center gap-2 font-body text-sm" style={{ color: MUTED }}><Loader2 className="h-4 w-4 animate-spin" />Calculating from immutable entries</p> : null}
      {!state.loading ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(totals).map(([label, value]) => <div key={label} className="rounded-xl border border-foreground/10 p-3"><p className="font-body text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>{label.replace(/_/g, ' ')}</p><p className="mt-1 font-heading text-2xl">{label.endsWith('_cents') || ['asset', 'liability', 'equity', 'revenue', 'expense'].includes(label) ? money(value) : value}</p></div>)}</div> : null}
    </section>
  );
}

export default function OsCapability() {
  const { capability: slug } = useParams();
  const capability = getOsCapability(slug);
  const [state, setState] = useState({ loading: true, error: '', records: [], total: 0, verified: false });
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!capability) return;
    setState({ loading: true, error: '', records: [], total: 0, verified: false });
    try {
      const response = await apiGet(`/api/os/v1/capabilities/${capability.slug}?pageSize=100&search=${encodeURIComponent(search)}`);
      assertApiResponse(response, {
        objects: ['data', 'data.pagination'],
        arrays: ['data.records'],
        numbers: ['data.pagination.total'],
        booleans: ['data.pagination.hasMore'],
      }, 'Avalon OS returned an invalid workspace response.');
      if (!hasObjectRows(response.data.records, ['id', 'version'])) {
        throw invalidApiResponse('Avalon OS returned invalid workspace records.');
      }
      setState({ loading: false, error: '', records: response.data.records, total: response.data.pagination.total, verified: true });
    } catch (error) {
      setState({
        loading: false,
        error: error.message || 'Could not load this workspace.',
        records: [],
        total: 0,
        verified: false,
      });
    }
  }, [capability, search]);

  useEffect(() => { load(); }, [load]);

  const amountTotal = useMemo(() => state.records.reduce((sum, record) => sum + Number(record.amount_cents || 0), 0), [state.records]);

  const save = async (payload) => {
    setSaving(true);
    try {
      if (payload.id) await apiPatch(`/api/os/v1/capabilities/${capability.slug}`, payload);
      else await apiPost(`/api/os/v1/capabilities/${capability.slug}`, payload);
      setEditor(null);
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message || 'Could not save the record.' }));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (record) => {
    if (!window.confirm(`Archive “${record.title}”?`)) return;
    try {
      await authedFetch(`/api/os/v1/capabilities/${capability.slug}?id=${encodeURIComponent(record.id)}`, {
        method: 'DELETE',
        headers: { 'Idempotency-Key': makeKey('archive') },
        body: JSON.stringify({ id: record.id }),
      });
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message || 'Could not archive the record.' }));
    }
  };

  if (!capability) {
    return <AdminShell title="Avalon OS"><div className="rounded-2xl border border-foreground/15 p-8 font-body">Unknown capability.</div></AdminShell>;
  }

  if (state.loading && !state.verified) {
    return (
      <AdminShell title={capability.label}>
        <div className="flex min-h-[28rem] items-center justify-center text-foreground/45">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  if (!state.loading && state.error && !state.verified) {
    return (
      <AdminShell title={capability.label}>
        <OperationalSourceUnavailable
          title="Workspace source unavailable"
          description="Records and totals could not be verified. No zeroed metrics, empty-state claims, exports, or record actions are shown until the live Avalon OS source reconnects."
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={capability.label}
      actions={(
        <div className="flex gap-2">
          <button type="button" onClick={() => downloadCsv(capability, state.records)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/15 px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em]"><Download className="h-3.5 w-3.5" />Export</button>
          <button type="button" onClick={() => setEditor({ mode: 'create' })} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-background"><Plus className="h-3.5 w-3.5" />New</button>
        </div>
      )}
    >
      <div className="av-os-workspace space-y-5">
        <header>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: MUTED }}>{capability.domain} · {capability.kind}</p>
          <p className="mt-2 max-w-3xl font-body text-sm" style={{ color: MUTED }}>{capability.description}</p>
        </header>

        {capability.kind === 'integration' ? <IntegrationPanel provider={capability.slug} /> : null}
        {capability.kind === 'report' ? <ReportPanel capability={capability} /> : null}

        <section className="grid gap-3 sm:grid-cols-3">
          {[['Active records', state.total], ['Visible rows', state.records.length], ['Value represented', money(amountTotal)]].map(([label, value]) => (
            <div key={label} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="font-body text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: MUTED }}>{label}</p>
              <p className="mt-2 font-heading text-3xl uppercase">{value}</p>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${capability.label.toLowerCase()}`} className="min-h-11 w-full rounded-full border border-foreground/15 bg-background/65 pl-10 pr-4 font-body text-sm outline-none focus:border-foreground/35" />
          </label>
          <button type="button" onClick={load} disabled={state.loading} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/15 px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-45"><RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>

        {state.error ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 font-body text-sm text-red-800">
            <span>{state.error}</span><button type="button" onClick={load} className="font-bold underline">Retry</button>
          </div>
        ) : null}

        {editor ? <RecordEditor initial={editor.record} onCancel={() => setEditor(null)} onSave={save} saving={saving} /> : null}

        <section className="overflow-hidden rounded-2xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {state.loading && !state.records.length ? <div className="flex items-center gap-2 p-6 font-body text-sm" style={{ color: MUTED }}><Loader2 className="h-4 w-4 animate-spin" />Loading {capability.label.toLowerCase()}</div> : null}
          {!state.loading && !state.records.length ? (
            <div className="p-10 text-center">
              <h2 className="font-heading text-3xl uppercase">No records yet</h2>
              <p className="mt-2 font-body text-sm" style={{ color: MUTED }}>Create the first persisted {capability.label.toLowerCase()} record.</p>
              <button type="button" onClick={() => setEditor({ mode: 'create' })} className="mt-5 min-h-10 rounded-full bg-foreground px-5 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-background">Create record</button>
            </div>
          ) : null}
          {state.records.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left font-body text-sm">
                <thead className="border-b border-foreground/10 text-[9px] uppercase tracking-[0.16em]" style={{ color: MUTED }}><tr><th className="px-4 py-3">Title</th><th>Status</th><th>Type</th><th>Effective</th><th className="text-right">Amount</th><th className="px-4 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-foreground/[0.08]">
                  {state.records.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 font-semibold">{record.title}<p className="mt-1 text-xs font-normal" style={{ color: MUTED }}>{record.data?.notes || 'No notes'}</p></td>
                      <td><span className="rounded-full border border-foreground/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]">{record.status}</span></td>
                      <td style={{ color: MUTED }}>{record.record_type}</td>
                      <td style={{ color: MUTED }}>{dateLabel(record.effective_at)}</td>
                      <td className="text-right font-semibold">{money(record.amount_cents)}</td>
                      <td className="px-4"><div className="flex justify-end gap-1"><button type="button" aria-label={`Edit ${record.title}`} onClick={() => setEditor({ mode: 'edit', record })} className="grid h-10 w-10 place-items-center rounded-full hover:bg-foreground/10"><Pencil className="h-4 w-4" /></button><button type="button" aria-label={`Archive ${record.title}`} onClick={() => archive(record)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-foreground/10"><Archive className="h-4 w-4" /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}
