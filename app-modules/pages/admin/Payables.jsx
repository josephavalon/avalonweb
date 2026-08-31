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
  const [funding, setFunding] = useState({ accountRef: '', maskedLabel: '' });
  const [settlementEvidence, setSettlementEvidence] = useState({ payoutItemId: '', providerEventId: '', bankItemId: '' });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '', code: '' }));
    try {
      const [payableData, payoutData] = await Promise.all([
        apiGet('/api/admin/payables'),
        apiGet('/api/admin/payouts'),
      ]);
      if (!Array.isArray(payableData?.payables) || !payableData?.capabilities) throw new Error('PayOps returned an invalid payable response.');
      if (!Array.isArray(payoutData?.payouts) || !payoutData?.capabilities) throw new Error('PayOps returned an invalid payout response.');
      setState({
        loading: false,
        error: '',
        code: '',
        data: {
          payables: payableData.payables,
          payableCapabilities: payableData.capabilities,
          payouts: payoutData.payouts,
          payoutCapabilities: payoutData.capabilities,
          provider: payoutData.provider,
        },
        actingId: '',
      });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Could not load 1099 payables.', code: error.body?.code || '', data: null, actingId: '' });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const mutatePayable = async (payable, action) => {
    setState((current) => ({ ...current, actingId: payable.id, error: '', code: '' }));
    try {
      const body = action === 'approve'
        ? { expectedVersion: payable.version, reasonCode: 'SOURCE_REVIEW_COMPLETE' }
        : { expectedVersion: payable.version, holdCode: 'MANUAL_REVIEW_REQUIRED', ownerProfileId: state.data.payableCapabilities.actorProfileId };
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

  const mutatePayout = async (payable, payout, action) => {
    if (action === 'queue') {
      const confirmed = globalThis.confirm?.('Queue this approved payout command? This records executor authorization only; it does not contact Mercury or move money.');
      if (confirmed === false) return;
    }
    if (action === 'settle') {
      const confirmed = globalThis.confirm?.('Reconcile this payout against the referenced existing Mercury event and posted bank item? Avalon will not call Mercury or create either evidence record.');
      if (confirmed === false) return;
    }
    setState((current) => ({ ...current, actingId: payable.id, error: '', code: '' }));
    try {
      let endpoint = '/api/admin/payouts';
      let body = {
        payableId: payable.id,
        expectedPayableVersion: payable.version,
        fundingAccountRef: funding.accountRef.trim(),
        fundingAccountMaskedLabel: funding.maskedLabel.trim(),
      };
      if (action === 'approve') {
        endpoint = `/api/admin/payouts/${encodeURIComponent(payout.id)}/approve`;
        body = { expectedVersion: payout.version, reasonCode: 'PAYOUT_PROPOSAL_REVIEWED' };
      }
      if (action === 'queue') {
        endpoint = `/api/admin/payouts/${encodeURIComponent(payout.id)}/queue`;
        body = { expectedVersion: payout.version, reasonCode: 'PAYOUT_COMMAND_AUTHORIZED' };
      }
      if (action === 'settle') {
        endpoint = `/api/admin/payouts/${encodeURIComponent(payout.id)}/settle`;
        body = {
          expectedVersion: payout.version,
          financeIntegrationEventId: settlementEvidence.providerEventId.trim(),
          bankStatementItemId: settlementEvidence.bankItemId.trim(),
          reasonCode: 'EXACT_SETTLEMENT_EVIDENCE_REVIEWED',
        };
      }
      await authedFetch(endpoint, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey(`payout-${action}`, payout?.id || payable.id) },
        body: JSON.stringify(body),
      });
      if (action === 'settle') setSettlementEvidence({ payoutItemId: '', providerEventId: '', bankItemId: '' });
      await load();
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        actingId: '',
        error: error.message || `Could not ${action} payout.`,
        code: error.body?.code || '',
      }));
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

  const {
    payables,
    payouts,
    payableCapabilities,
    payoutCapabilities,
    provider,
  } = state.data;
  const payoutByPayable = new Map(payouts.map((payout) => [payout.payableId, payout]));
  const needsFundingSource = payoutCapabilities.prepare
    && payables.some((payable) => payable.status === 'APPROVED' && !payoutByPayable.has(payable.id));
  return (
    <AdminShell
      title="1099 Payables & Payouts"
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
          <h1 className="mt-2 font-heading text-5xl uppercase leading-none">1099 Payables & Payouts</h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/55">Prepare the locked payout proposal, route it to a different checker, then let a third Finance operator queue the provider command. Avalon never calls Mercury from this screen or accepts a direct paid status; a separate accountant may recognize settlement only after existing signed provider evidence and a posted bank item match exactly.</p>
        </header>

        {!payableCapabilities.enabled || !payoutCapabilities.enabled ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-amber-800">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Avalon PayOps is disabled pending migration, role, provider, canary, and reconciliation gates. Review is read-only; no payable can be sent or marked paid.</p>
          </div>
        ) : null}
        <div className="grid gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-4 text-xs sm:grid-cols-3">
          <div><p className="font-bold uppercase tracking-[0.12em] text-foreground/35">Your control role</p><p className="mt-1 font-semibold">{payoutCapabilities.roles.join(', ').replaceAll('_', ' ') || 'Read only'}</p></div>
          <div><p className="font-bold uppercase tracking-[0.12em] text-foreground/35">Provider state</p><p className="mt-1 font-semibold">{String(provider?.state || 'UNVERIFIED').replaceAll('_', ' ')}</p></div>
          <div><p className="font-bold uppercase tracking-[0.12em] text-foreground/35">Execution boundary</p><p className="mt-1 font-semibold">Internal approval queue only</p></div>
        </div>
        {needsFundingSource ? (
          <section className="rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-4">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/40">Maker funding source</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/50">Use the exact approved Mercury provider account ID and a masked label. Settlement must later match bank evidence from that same provider account; status responses expose only the masked label.</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="mb-1 block font-bold uppercase tracking-[0.1em] text-foreground/40">Mercury provider account ID</span>
                <input value={funding.accountRef} onChange={(event) => setFunding((current) => ({ ...current, accountRef: event.target.value }))} autoComplete="off" placeholder="Mercury provider account ID" className="min-h-11 w-full rounded-xl border border-foreground/10 bg-background px-3 outline-none focus:border-foreground/35" />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-bold uppercase tracking-[0.1em] text-foreground/40">Masked account label</span>
                <input value={funding.maskedLabel} onChange={(event) => setFunding((current) => ({ ...current, maskedLabel: event.target.value }))} autoComplete="off" placeholder="Operating account •••• 1234" className="min-h-11 w-full rounded-xl border border-foreground/10 bg-background px-3 outline-none focus:border-foreground/35" />
              </label>
            </div>
          </section>
        ) : null}
        {state.error ? <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-700">{state.error}</p> : null}

        <div className="grid gap-3">
          {payables.map((payable) => {
            const payout = payoutByPayable.get(payable.id);
            return (
              <article key={payable.id} className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">{payable.sourceInvoice?.invoiceNumber || 'Controlled payable'}</p>
                    <h2 className="mt-1 text-lg font-semibold">{payable.payee.displayName}</h2>
                    <p className="mt-1 text-xs text-foreground/45">Due {payable.dueDate} · payable v{payable.version}</p>
                  </div>
                  <div className="text-right"><p className="font-heading text-4xl">{centsMoney(payable.netCents, payable.currency)}</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${tone(payout?.status || payable.status)}`}>{(payout?.status || payable.status).replaceAll('_', ' ')}</span></div>
                </div>
                <div className="mt-4 grid gap-3 border-t border-foreground/10 pt-4 text-xs sm:grid-cols-4">
                  <div><p className="uppercase tracking-[0.12em] text-foreground/35">Gross</p><p className="mt-1 font-semibold">{centsMoney(payable.grossCents, payable.currency)}</p></div>
                  <div><p className="uppercase tracking-[0.12em] text-foreground/35">Reimbursement</p><p className="mt-1 font-semibold">{centsMoney(payable.reimbursementCents, payable.currency)}</p></div>
                  <div><p className="uppercase tracking-[0.12em] text-foreground/35">Destination</p><p className="mt-1 font-semibold">{payout?.destinationMaskedLabel || payable.payee.destinationMaskedLabel || 'Not ready'}</p></div>
                  <div><p className="uppercase tracking-[0.12em] text-foreground/35">Reconciliation</p><p className="mt-1 font-semibold">{(payout?.reconciliationState || payable.reconciliationState).replaceAll('_', ' ')}</p></div>
                </div>
                {payout ? (
                  <div className="mt-4 rounded-2xl border border-foreground/10 bg-background/45 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/40">Payout authorization</p>
                        <p className="mt-1 text-xs text-foreground/55">Maker recorded · {payout.authorization.checker ? 'checker recorded' : 'checker pending'} · {payout.authorization.executor ? 'executor recorded' : 'executor pending'}</p>
                      </div>
                      <p className="text-xs font-semibold">Payout v{payout.version}</p>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                      <div><p className="uppercase tracking-[0.1em] text-foreground/35">Batch</p><p className="mt-1 font-semibold">{payout.batch?.status?.replaceAll('_', ' ') || 'Unavailable'}</p></div>
                      <div><p className="uppercase tracking-[0.1em] text-foreground/35">Command</p><p className="mt-1 font-semibold">{payout.command?.status?.replaceAll('_', ' ') || 'Not queued'}</p></div>
                      <div><p className="uppercase tracking-[0.1em] text-foreground/35">Settlement evidence</p><p className="mt-1 font-semibold">{payout.canonicalSettled ? 'Complete and matched' : 'Not established'}</p></div>
                    </div>
                    {payout.command ? <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 text-xs leading-relaxed text-amber-800">Command {payout.command.status.toLowerCase().replaceAll('_', ' ')} inside Avalon. This is not provider acceptance, money movement, or settlement.</p> : null}
                    {payout.status === 'RECONCILIATION_REQUIRED' ? <p className="mt-3 flex items-center gap-2 text-xs text-red-700"><AlertTriangle className="h-4 w-4" />A settled claim is incomplete or mismatched. Treat this payout as unpaid until reconciliation evidence is complete.</p> : null}
                    {payoutCapabilities.reconcileSettlement
                      && payout.command?.status === 'SUCCEEDED'
                      && ['PROVIDER_PENDING', 'SUBMITTED', 'IN_TRANSIT', 'RECONCILIATION_REQUIRED'].includes(payout.persistedStatus) ? (
                        <details className="mt-3 rounded-xl border border-foreground/10 p-3">
                          <summary className="cursor-pointer text-xs font-semibold">Reconcile existing settlement evidence</summary>
                          <p className="mt-2 text-xs leading-relaxed text-foreground/50">Enter IDs for records already ingested by controlled provider and bank adapters. This action cannot create evidence, contact Mercury, or accept a manual paid status.</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <label className="text-xs"><span className="mb-1 block font-bold uppercase tracking-[0.1em] text-foreground/40">Processed Mercury event ID</span><input value={settlementEvidence.payoutItemId === payout.id ? settlementEvidence.providerEventId : ''} onChange={(event) => setSettlementEvidence((current) => current.payoutItemId === payout.id ? { ...current, providerEventId: event.target.value } : { payoutItemId: payout.id, providerEventId: event.target.value, bankItemId: '' })} autoComplete="off" className="min-h-10 w-full rounded-xl border border-foreground/10 bg-background px-3 outline-none focus:border-foreground/35" /></label>
                            <label className="text-xs"><span className="mb-1 block font-bold uppercase tracking-[0.1em] text-foreground/40">Posted bank item ID</span><input value={settlementEvidence.payoutItemId === payout.id ? settlementEvidence.bankItemId : ''} onChange={(event) => setSettlementEvidence((current) => current.payoutItemId === payout.id ? { ...current, bankItemId: event.target.value } : { payoutItemId: payout.id, providerEventId: '', bankItemId: event.target.value })} autoComplete="off" className="min-h-10 w-full rounded-xl border border-foreground/10 bg-background px-3 outline-none focus:border-foreground/35" /></label>
                          </div>
                          <button type="button" onClick={() => mutatePayout(payable, payout, 'settle')} disabled={Boolean(state.actingId) || settlementEvidence.payoutItemId !== payout.id || !settlementEvidence.providerEventId.trim() || !settlementEvidence.bankItemId.trim()} className="mt-3 rounded-full bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-background disabled:opacity-45">Verify and reconcile</button>
                        </details>
                      ) : null}
                  </div>
                ) : null}
                {payable.holdCode ? <p className="mt-4 flex items-center gap-2 text-xs text-red-700"><AlertTriangle className="h-4 w-4" />Hold: {payable.holdCode.replaceAll('_', ' ')}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {payableCapabilities.approve && payable.status === 'OPEN' ? <button type="button" onClick={() => mutatePayable(payable, 'approve')} disabled={Boolean(state.actingId)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-background disabled:opacity-45"><ShieldCheck className="h-3.5 w-3.5" />Approve payable</button> : null}
                  {payoutCapabilities.prepare && payable.status === 'APPROVED' && !payout ? <button type="button" onClick={() => mutatePayout(payable, null, 'prepare')} disabled={Boolean(state.actingId) || !funding.accountRef.trim() || !funding.maskedLabel.trim()} className="rounded-full bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-background disabled:opacity-45">Prepare payout</button> : null}
                  {payoutCapabilities.approve && payout?.persistedStatus === 'APPROVAL_PENDING' ? <button type="button" onClick={() => mutatePayout(payable, payout, 'approve')} disabled={Boolean(state.actingId)} className="rounded-full bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-background disabled:opacity-45">Checker approve</button> : null}
                  {payoutCapabilities.queueCommand && payout?.persistedStatus === 'READY' ? <button type="button" onClick={() => mutatePayout(payable, payout, 'queue')} disabled={Boolean(state.actingId)} className="rounded-full bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-background disabled:opacity-45">Queue provider approval</button> : null}
                  {payableCapabilities.hold && !['SETTLED', 'REVERSED', 'RETURNED'].includes(payable.status) ? <button type="button" onClick={() => mutatePayable(payable, 'hold')} disabled={Boolean(state.actingId)} className="rounded-full border border-foreground/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-45">Place review hold</button> : null}
                  {state.actingId === payable.id ? <span className="inline-flex items-center gap-2 text-xs text-foreground/45"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving controlled action</span> : null}
                </div>
              </article>
            );
          })}
          {!payables.length ? <div className="rounded-3xl border border-dashed border-foreground/15 p-10 text-center"><p className="text-sm font-semibold">No persisted contractor payables</p><p className="mt-2 text-xs text-foreground/45">This is a verified empty queue from Avalon PayOps. Approved invoices do not appear here until a Finance maker creates a locked payable.</p></div> : null}
        </div>
      </div>
    </AdminShell>
  );
}
