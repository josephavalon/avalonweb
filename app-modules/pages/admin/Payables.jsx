import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, authedFetch } from '@/lib/apiClient';

function centsMoney(value, currency = 'USD') {
  try {
    const cents = BigInt(String(value || '0'));
    const sign = cents < BigInt(0) ? '-' : '';
    const absolute = cents < BigInt(0) ? -cents : cents;
    const symbol = currency === 'USD' ? '$' : `${currency} `;
    return `${sign}${symbol}${(absolute / BigInt(100)).toLocaleString()}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
  } catch {
    return 'Unavailable';
  }
}

function idempotencyKey(action, id) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `payops-ui:${action}:${id}:${random}`;
}

function tone(status) {
  if (status === 'SETTLED') return 'border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-700';
  if (['HELD', 'FAILED', 'RETURNED', 'RECONCILIATION_REQUIRED', 'ACTION_REQUIRED'].includes(status)) return 'border-red-500/25 bg-red-500/[0.05] text-red-700';
  return 'border-amber-500/25 bg-amber-500/[0.05] text-amber-800';
}

export default function Payables() {
  const [state, setState] = useState({ loading: true, error: '', code: '', data: null, actingId: '' });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '', code: '' }));
    try {
      const data = await apiGet('/api/admin/payables');
      if (!Array.isArray(data?.payables) || !data?.capabilities) throw new Error('PayOps returned an invalid payable response.');
      setState({ loading: false, error: '', code: '', data, actingId: '' });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Could not load 1099 payables.', code: error.body?.code || '', data: null, actingId: '' });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const mutate = async (payable, action) => {
    setState((current) => ({ ...current, actingId: payable.id, error: '', code: '' }));
    try {
      const body = action === 'approve'
        ? { expectedVersion: payable.version, reasonCode: 'SOURCE_REVIEW_COMPLETE' }
        : { expectedVersion: payable.version, holdCode: 'MANUAL_REVIEW_REQUIRED', ownerProfileId: state.data.capabilities.actorProfileId };
      await authedFetch(`/api/admin/payables/${encodeURIComponent(payable.id)}/${action}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey(action, payable.id) },
        body: JSON.stringify(body),
      });
      await load();
    } catch (error) {
      setState((current) => ({ ...current, loading: false, actingId: '', error: error.message || `Could not ${action} payable.`, code: error.body?.code || '' }));
    }
  };

  if (state.loading && !state.data) {
    return <AdminShell title="1099 Payables"><div className="flex min-h-[28rem] items-center justify-center text-foreground/45"><Loader2 className="h-5 w-5 animate-spin" /></div></AdminShell>;
  }
  if (!state.data) {
    return (
      <AdminShell title="1099 Payables">
        <OperationalSourceUnavailable
          title={state.code === 'finance_permission_required' ? 'Finance role required' : 'PayOps unavailable'}
          description={state.code === 'finance_permission_required'
            ? 'An active Finance role is required to view contractor payables. Admin route access alone does not grant nurse-pay access.'
            : 'The PayOps schema or authorization source could not be verified. No empty, sample, or zeroed payable records are shown.'}
        />
      </AdminShell>
    );
  }

  const { payables, capabilities } = state.data;
  return (
    <AdminShell
      title="1099 Payables"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/nurse-invoices" className="rounded-full border border-foreground/10 bg-foreground/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em]">Invoice review</Link>
          <button type="button" onClick={load} disabled={state.loading} className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-45"><RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>
      )}
    >
      <div className="space-y-5">
        <header className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Avalon PayOps · contractor rail</p>
          <h1 className="mt-2 font-heading text-5xl uppercase leading-none">1099 Payables</h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/55">Locked invoice evidence becomes a payable only after HR/Legal classification and payee readiness pass. Approval is not payment; settlement requires Mercury evidence and reconciliation.</p>
        </header>

        {!capabilities.enabled ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-amber-800">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Avalon PayOps is disabled pending migration, role, provider, canary, and reconciliation gates. Review is read-only; no payable can be sent or marked paid.</p>
          </div>
        ) : null}
        {state.error ? <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-700">{state.error}</p> : null}

        <div className="grid gap-3">
          {payables.map((payable) => (
            <article key={payable.id} className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">{payable.sourceInvoice?.invoiceNumber || 'Controlled payable'}</p>
                  <h2 className="mt-1 text-lg font-semibold">{payable.payee.displayName}</h2>
                  <p className="mt-1 text-xs text-foreground/45">Due {payable.dueDate} · v{payable.version}</p>
                </div>
                <div className="text-right"><p className="font-heading text-4xl">{centsMoney(payable.netCents, payable.currency)}</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${tone(payable.status)}`}>{payable.status.replaceAll('_', ' ')}</span></div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-foreground/10 pt-4 text-xs sm:grid-cols-4">
                <div><p className="uppercase tracking-[0.12em] text-foreground/35">Gross</p><p className="mt-1 font-semibold">{centsMoney(payable.grossCents, payable.currency)}</p></div>
                <div><p className="uppercase tracking-[0.12em] text-foreground/35">Reimbursement</p><p className="mt-1 font-semibold">{centsMoney(payable.reimbursementCents, payable.currency)}</p></div>
                <div><p className="uppercase tracking-[0.12em] text-foreground/35">Destination</p><p className="mt-1 font-semibold">{payable.payee.destinationMaskedLabel || 'Not ready'}</p></div>
                <div><p className="uppercase tracking-[0.12em] text-foreground/35">Reconciliation</p><p className="mt-1 font-semibold">{payable.reconciliationState.replaceAll('_', ' ')}</p></div>
              </div>
              {payable.holdCode ? <p className="mt-4 flex items-center gap-2 text-xs text-red-700"><AlertTriangle className="h-4 w-4" />Hold: {payable.holdCode.replaceAll('_', ' ')}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {capabilities.approve && payable.status === 'OPEN' ? <button type="button" onClick={() => mutate(payable, 'approve')} disabled={Boolean(state.actingId)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-background disabled:opacity-45"><ShieldCheck className="h-3.5 w-3.5" />Approve payable</button> : null}
                {capabilities.hold && !['SETTLED', 'REVERSED', 'RETURNED'].includes(payable.status) ? <button type="button" onClick={() => mutate(payable, 'hold')} disabled={Boolean(state.actingId)} className="rounded-full border border-foreground/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-45">Place review hold</button> : null}
                {state.actingId === payable.id ? <span className="inline-flex items-center gap-2 text-xs text-foreground/45"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving controlled action</span> : null}
              </div>
            </article>
          ))}
          {!payables.length ? <div className="rounded-3xl border border-dashed border-foreground/15 p-10 text-center"><p className="text-sm font-semibold">No persisted contractor payables</p><p className="mt-2 text-xs text-foreground/45">This is a verified empty queue from Avalon PayOps. Approved invoices do not appear here until a Finance maker creates a locked payable.</p></div> : null}
        </div>
      </div>
    </AdminShell>
  );
}
