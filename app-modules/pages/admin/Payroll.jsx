import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, authedFetch } from '@/lib/apiClient';

const CENTS_PER_DOLLAR = BigInt(100);

function money(value) {
  try {
    const cents = BigInt(String(value || '0'));
    return `$${(cents / CENTS_PER_DOLLAR).toLocaleString()}.${String(cents % CENTS_PER_DOLLAR).padStart(2, '0')}`;
  } catch {
    return 'Unavailable';
  }
}

function requestKey(action, id = 'new') {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `payroll-ui:${action}:${id}:${nonce}`;
}

function pill(status) {
  if (status === 'PAID') return 'border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-700';
  if (['HELD', 'ACTION_REQUIRED', 'FUNDING_FAILED', 'EMPLOYEE_PAYMENT_FAILED', 'TAX_OR_FILING_FAILED', 'RECONCILIATION_REQUIRED'].includes(status)) {
    return 'border-red-500/25 bg-red-500/[0.05] text-red-700';
  }
  return 'border-amber-500/25 bg-amber-500/[0.05] text-amber-800';
}

const FIELD = 'min-h-10 w-full rounded-xl border border-foreground/10 bg-background px-3 text-sm outline-none focus:border-foreground/35';
const BUTTON = 'rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em] disabled:opacity-40';

function Field({ label, ...props }) {
  return <label className="text-xs"><span className="mb-1 block font-bold uppercase tracking-[0.1em] text-foreground/40">{label}</span><input className={FIELD} {...props} /></label>;
}

function allowedTargets(status) {
  const recovery = ['ACTION_REQUIRED', 'RECONCILIATION_REQUIRED'];
  if (status === 'PREVIEW_QUEUED') return ['PREVIEWED', ...recovery];
  if (status === 'PREVIEWED') return recovery;
  if (status === 'SUBMISSION_QUEUED') return ['PROCESSING', ...recovery];
  if (status === 'PROCESSING') return ['EMPLOYER_FUNDED', 'FUNDING_FAILED', ...recovery];
  if (status === 'EMPLOYER_FUNDED') return ['EMPLOYEE_PAYMENT_PENDING', 'EMPLOYEE_PAYMENT_FAILED', 'TAX_OR_FILING_FAILED', ...recovery];
  if (status === 'EMPLOYEE_PAYMENT_PENDING') return ['PAID', 'EMPLOYEE_PAYMENT_FAILED', 'TAX_OR_FILING_FAILED', ...recovery];
  return recovery;
}

function suggestedTarget(status) {
  if (status === 'PREVIEW_QUEUED') return 'PREVIEWED';
  if (status === 'SUBMISSION_QUEUED') return 'PROCESSING';
  if (status === 'PROCESSING') return 'EMPLOYER_FUNDED';
  if (status === 'EMPLOYER_FUNDED') return 'EMPLOYEE_PAYMENT_PENDING';
  if (status === 'EMPLOYEE_PAYMENT_PENDING') return 'PAID';
  return 'ACTION_REQUIRED';
}

function ReconcileRun({ run, acting, onReconcile }) {
  const targets = allowedTargets(run.persistedStatus);
  const [form, setForm] = useState({
    targetStatus: suggestedTarget(run.persistedStatus),
    financeIntegrationEventId: '',
    bankStatementItemId: '',
    payrollStatementIds: '',
    reasonCode: 'PROVIDER_EVENT_RECONCILED',
  });
  const paid = form.targetStatus === 'PAID';
  return (
    <details className="mt-4 rounded-2xl border border-foreground/10 bg-background/60 p-4">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.1em]">Reconcile provider evidence</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs"><span className="mb-1 block font-bold uppercase tracking-[0.1em] text-foreground/40">Verified target state</span><select className={FIELD} value={form.targetStatus} onChange={(event) => setForm((current) => ({ ...current, targetStatus: event.target.value }))}>{targets.map((target) => <option key={target} value={target}>{target.replaceAll('_', ' ')}</option>)}</select></label>
        <Field label="Signed finance event UUID" value={form.financeIntegrationEventId} onChange={(event) => setForm((current) => ({ ...current, financeIntegrationEventId: event.target.value }))} />
        {paid ? <Field label="Posted bank statement item UUID" value={form.bankStatementItemId} onChange={(event) => setForm((current) => ({ ...current, bankStatementItemId: event.target.value }))} /> : null}
        {paid ? <Field label="Payroll statement UUIDs (comma separated)" value={form.payrollStatementIds} onChange={(event) => setForm((current) => ({ ...current, payrollStatementIds: event.target.value }))} /> : null}
        <Field label="Reason code" value={form.reasonCode} onChange={(event) => setForm((current) => ({ ...current, reasonCode: event.target.value.toUpperCase() }))} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-foreground/45">This records an already-ingested, signature-valid Gusto event. Paid additionally requires the exact Gusto funding account and debit, an approved bank allocation, and one available statement for every payroll item. This action does not call Gusto or move money.</p>
      <button type="button" onClick={() => onReconcile({
        payrollRunId: run.id,
        expectedVersion: run.version,
        targetStatus: form.targetStatus,
        financeIntegrationEventId: form.financeIntegrationEventId,
        bankStatementItemId: paid ? form.bankStatementItemId : null,
        payrollStatementIds: paid ? form.payrollStatementIds.split(',').map((value) => value.trim()).filter(Boolean) : [],
        reasonCode: form.reasonCode,
      })} disabled={Boolean(acting)} className={`${BUTTON} mt-3 bg-foreground text-background`}>Validate and reconcile</button>
    </details>
  );
}

export default function Payroll() {
  const [state, setState] = useState({ loading: true, error: '', code: '', data: null, acting: '' });
  const [profile, setProfile] = useState({
    workerProfileId: '', legalEntityId: '', workerCategory: 'employee', workJurisdictions: 'CA', taxJurisdictions: 'CA',
    gustoCompanyId: '', gustoEmployeeId: '', payScheduleRef: '', readinessEvidenceRef: '', readinessEvidenceChecksum: '',
  });
  const [calendar, setCalendar] = useState({ legalEntityId: '', periodStart: '', periodEnd: '', cutoffAt: '', payDate: '', fundingDate: '', policyVersion: '' });
  const [input, setInput] = useState({ payrollProfileId: '', payrollCalendarId: '', earningEventId: '', expectedEarningVersion: '1', policyVersion: '' });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '', code: '' }));
    try {
      const data = await apiGet('/api/admin/payroll');
      if (!Array.isArray(data?.runs) || !Array.isArray(data?.profiles) || !data?.capabilities) throw new Error('Payroll returned an invalid response.');
      setState({ loading: false, error: '', code: '', data, acting: '' });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Could not load payroll controls.', code: error.body?.code || '', data: null, acting: '' });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (action, body, id = 'new') => {
    if (action === 'queue_run') {
      const confirmed = globalThis.confirm?.('Queue this Gusto outbox command? This does not contact Gusto, submit payroll, or move money.');
      if (confirmed === false) return;
    }
    if (action === 'cancel_run') {
      const confirmed = globalThis.confirm?.('Cancel this local payroll run and unlock its inputs? This is allowed only before provider dispatch.');
      if (confirmed === false) return;
    }
    if (action === 'reconcile_run' && body.targetStatus === 'PAID') {
      const confirmed = globalThis.confirm?.('Validate signed Gusto, exact funding debit, approved allocation, and every payroll statement? This records evidence only and does not pay anyone.');
      if (confirmed === false) return;
    }
    setState((current) => ({ ...current, acting: `${action}:${id}`, error: '', code: '' }));
    try {
      await authedFetch('/api/admin/payroll', {
        method: 'POST',
        headers: { 'Idempotency-Key': requestKey(action, id) },
        body: JSON.stringify({ action, ...body }),
      });
      await load();
    } catch (error) {
      setState((current) => ({ ...current, loading: false, acting: '', error: error.message || 'Payroll action failed.', code: error.body?.code || '' }));
    }
  };

  if (state.loading && !state.data) {
    return <AdminShell title="Employee Payroll"><div className="flex min-h-[28rem] items-center justify-center text-foreground/45"><Loader2 className="h-5 w-5 animate-spin" /></div></AdminShell>;
  }
  if (!state.data) {
    return <AdminShell title="Employee Payroll"><OperationalSourceUnavailable title={state.code === 'finance_permission_required' ? 'Payroll role required' : 'Payroll unavailable'} description="The payroll schema, role assignments, or source evidence could not be verified. No empty or paid claims are shown." /></AdminShell>;
  }

  const { profiles, calendars, inputs, runs, capabilities } = state.data;
  return (
    <AdminShell title="Employee & Management Payroll" actions={<button type="button" onClick={load} disabled={state.loading} className={`${BUTTON} inline-flex items-center gap-2 border border-foreground/10`}><RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} />Refresh</button>}>
      <div className="space-y-6">
        <header className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Avalon PayOps · W-2 rail</p>
          <h1 className="mt-2 font-heading text-5xl uppercase leading-none">Employee & Management Payroll</h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/55">Avalon prepares and approves payroll evidence internally. Gusto remains an external provider: this screen can queue an outbox intent, but it cannot call Gusto, move money, file tax, or mark anyone paid without processed provider evidence.</p>
        </header>

        {!capabilities.enabled ? <p className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-amber-800">PayOps is disabled. All payroll controls are read-only until migrations, roles, MFA, and release gates pass.</p> : null}
        {state.error ? <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-700">{state.error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-foreground/10 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/40">Workers</p><p className="mt-2 font-heading text-4xl">{profiles.length}</p><p className="text-xs text-foreground/45">{profiles.filter((row) => row.workerCategory === 'management').length} management</p></div>
          <div className="rounded-2xl border border-foreground/10 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/40">Calendars</p><p className="mt-2 font-heading text-4xl">{calendars.length}</p><p className="text-xs text-foreground/45">{calendars.filter((row) => row.status === 'OPEN').length} open</p></div>
          <div className="rounded-2xl border border-foreground/10 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/40">Inputs</p><p className="mt-2 font-heading text-4xl">{inputs.length}</p><p className="text-xs text-foreground/45">persisted earning records</p></div>
          <div className="rounded-2xl border border-foreground/10 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/40">Runs</p><p className="mt-2 font-heading text-4xl">{runs.length}</p><p className="text-xs text-foreground/45">{runs.filter((row) => row.status.includes('REQUIRED') || row.status === 'HELD').length} need action</p></div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {capabilities.prepareProfile ? (
            <details className="rounded-2xl border border-foreground/10 p-4">
              <summary className="cursor-pointer text-sm font-semibold">Prepare worker profile</summary>
              <div className="mt-4 grid gap-3">
                <Field label="Worker profile ID" value={profile.workerProfileId} onChange={(event) => setProfile((current) => ({ ...current, workerProfileId: event.target.value }))} />
                <Field label="Legal entity ID" value={profile.legalEntityId} onChange={(event) => setProfile((current) => ({ ...current, legalEntityId: event.target.value }))} />
                <label className="text-xs"><span className="mb-1 block font-bold uppercase tracking-[0.1em] text-foreground/40">Worker category</span><select className={FIELD} value={profile.workerCategory} onChange={(event) => setProfile((current) => ({ ...current, workerCategory: event.target.value }))}><option value="employee">Employee</option><option value="management">Management</option></select></label>
                <Field label="Work jurisdictions" value={profile.workJurisdictions} onChange={(event) => setProfile((current) => ({ ...current, workJurisdictions: event.target.value }))} />
                <Field label="Tax jurisdictions" value={profile.taxJurisdictions} onChange={(event) => setProfile((current) => ({ ...current, taxJurisdictions: event.target.value }))} />
                <p className="text-[11px] leading-relaxed text-foreground/45">Optional readiness references must come from an independently verified Gusto setup. Entering them records evidence only; it does not contact Gusto.</p>
                <Field label="Gusto company reference" value={profile.gustoCompanyId} onChange={(event) => setProfile((current) => ({ ...current, gustoCompanyId: event.target.value }))} />
                <Field label="Gusto employee reference" value={profile.gustoEmployeeId} onChange={(event) => setProfile((current) => ({ ...current, gustoEmployeeId: event.target.value }))} />
                <Field label="Pay schedule reference" value={profile.payScheduleRef} onChange={(event) => setProfile((current) => ({ ...current, payScheduleRef: event.target.value }))} />
                <Field label="Readiness evidence reference" value={profile.readinessEvidenceRef} onChange={(event) => setProfile((current) => ({ ...current, readinessEvidenceRef: event.target.value }))} />
                <Field label="Evidence SHA-256" value={profile.readinessEvidenceChecksum} onChange={(event) => setProfile((current) => ({ ...current, readinessEvidenceChecksum: event.target.value }))} />
                <button type="button" onClick={() => act('prepare_profile', profile)} disabled={Boolean(state.acting)} className={`${BUTTON} bg-foreground text-background`}>Prepare profile</button>
              </div>
            </details>
          ) : null}
          {capabilities.prepareCalendar ? (
            <details className="rounded-2xl border border-foreground/10 p-4">
              <summary className="cursor-pointer text-sm font-semibold">Prepare pay calendar</summary>
              <div className="mt-4 grid gap-3">
                <Field label="Legal entity ID" value={calendar.legalEntityId} onChange={(event) => setCalendar((current) => ({ ...current, legalEntityId: event.target.value }))} />
                <div className="grid grid-cols-2 gap-2"><Field label="Period start" type="date" value={calendar.periodStart} onChange={(event) => setCalendar((current) => ({ ...current, periodStart: event.target.value }))} /><Field label="Period end" type="date" value={calendar.periodEnd} onChange={(event) => setCalendar((current) => ({ ...current, periodEnd: event.target.value }))} /></div>
                <Field label="Cutoff" type="datetime-local" value={calendar.cutoffAt} onChange={(event) => setCalendar((current) => ({ ...current, cutoffAt: event.target.value }))} />
                <div className="grid grid-cols-2 gap-2"><Field label="Pay date" type="date" value={calendar.payDate} onChange={(event) => setCalendar((current) => ({ ...current, payDate: event.target.value }))} /><Field label="Funding date" type="date" value={calendar.fundingDate} onChange={(event) => setCalendar((current) => ({ ...current, fundingDate: event.target.value }))} /></div>
                <Field label="Policy version" value={calendar.policyVersion} onChange={(event) => setCalendar((current) => ({ ...current, policyVersion: event.target.value }))} />
                <button type="button" onClick={() => act('prepare_calendar', { ...calendar, timezone: 'America/Los_Angeles', runType: 'REGULAR' })} disabled={Boolean(state.acting)} className={`${BUTTON} bg-foreground text-background`}>Prepare calendar</button>
              </div>
            </details>
          ) : null}
          {capabilities.prepareInput ? (
            <details className="rounded-2xl border border-foreground/10 p-4">
              <summary className="cursor-pointer text-sm font-semibold">Route approved earning</summary>
              <div className="mt-4 grid gap-3">
                <Field label="Payroll profile ID" value={input.payrollProfileId} onChange={(event) => setInput((current) => ({ ...current, payrollProfileId: event.target.value }))} />
                <Field label="Payroll calendar ID" value={input.payrollCalendarId} onChange={(event) => setInput((current) => ({ ...current, payrollCalendarId: event.target.value }))} />
                <Field label="Approved earning ID" value={input.earningEventId} onChange={(event) => setInput((current) => ({ ...current, earningEventId: event.target.value }))} />
                <Field label="Earning version" type="number" min="1" value={input.expectedEarningVersion} onChange={(event) => setInput((current) => ({ ...current, expectedEarningVersion: event.target.value }))} />
                <Field label="Policy version" value={input.policyVersion} onChange={(event) => setInput((current) => ({ ...current, policyVersion: event.target.value }))} />
                <button type="button" onClick={() => act('prepare_input', input)} disabled={Boolean(state.acting)} className={`${BUTTON} bg-foreground text-background`}>Route earning</button>
              </div>
            </details>
          ) : null}
        </div>

        <section>
          <div className="mb-3 border-b border-foreground/10 pb-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/40">Pay periods</p><h2 className="mt-1 text-2xl font-semibold">Prepared calendars</h2></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {calendars.map((row) => <div key={row.id} className="rounded-2xl border border-foreground/10 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{row.periodStart} – {row.periodEnd}</p><p className="mt-1 text-xs text-foreground/45">Pay date {row.payDate} · v{row.version}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${pill(row.status)}`}>{row.status}</span></div>{capabilities.prepareRun && row.status === 'OPEN' ? <button type="button" onClick={() => act('prepare_run', { payrollCalendarId: row.id, expectedCalendarVersion: row.version }, row.id)} disabled={Boolean(state.acting)} className={`${BUTTON} mt-4 bg-foreground text-background`}>Prepare run</button> : null}</div>)}
            {!calendars.length ? <p className="rounded-2xl border border-dashed border-foreground/15 p-6 text-center text-sm text-foreground/45">No persisted payroll calendars.</p> : null}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3 border-b border-foreground/10 pb-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/40">Controlled queue</p><h2 className="mt-1 text-2xl font-semibold">Payroll runs</h2></div><p className="text-xs text-foreground/45">Gusto outbox {capabilities.gustoOutboxEnabled ? 'enabled' : 'disabled'}</p></div>
          <div className="grid gap-3">
            {runs.map((run) => (
              <article key={run.id} className="rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-foreground/45">Run {run.id.slice(0, 8)} · v{run.version}</p><p className="mt-1 text-sm font-semibold">Calendar {run.payrollCalendarId.slice(0, 8)}</p></div><div className="text-right"><p className="font-heading text-4xl">{money(run.employerCostCents)}</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${pill(run.status)}`}>{run.status.replaceAll('_', ' ')}</span></div></div>
                <div className="mt-4 grid gap-3 border-t border-foreground/10 pt-4 text-xs sm:grid-cols-4"><div><p className="uppercase tracking-[0.1em] text-foreground/35">Gross</p><p className="mt-1 font-semibold">{money(run.grossCents)}</p></div><div><p className="uppercase tracking-[0.1em] text-foreground/35">Net</p><p className="mt-1 font-semibold">{run.previewVersion ? money(run.netCents) : 'Awaiting preview'}</p></div><div><p className="uppercase tracking-[0.1em] text-foreground/35">Command</p><p className="mt-1 font-semibold">{run.command?.status?.replaceAll('_', ' ') || 'Not queued'}</p></div><div><p className="uppercase tracking-[0.1em] text-foreground/35">Reconciliation</p><p className="mt-1 font-semibold">{run.reconciliationState.replaceAll('_', ' ')}</p></div></div>
                {run.command ? <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 text-xs text-amber-800">This is an internal {run.command.commandType.toLowerCase().replaceAll('_', ' ')} intent. It is not provider acceptance, payroll submission, funding, or payment.</p> : null}
                {run.status === 'RECONCILIATION_REQUIRED' ? <p className="mt-3 flex items-center gap-2 text-xs text-red-700"><AlertTriangle className="h-4 w-4" />Provider evidence is incomplete or mismatched. Do not treat this run as paid.</p> : null}
                {run.canonicalPaid ? <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-xs text-emerald-800">Paid evidence revalidated now · provider event {run.financeIntegrationEventId?.slice(0, 8)} · bank item {run.bankStatementItemId?.slice(0, 8)} · match {run.reconciliationMatchId?.slice(0, 8)}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {capabilities.queueRun && ['DRAFT', 'HUMAN_APPROVED'].includes(run.persistedStatus) ? <button type="button" onClick={() => act('queue_run', { payrollRunId: run.id, expectedVersion: run.version, reasonCode: run.persistedStatus === 'DRAFT' ? 'PREVIEW_REQUEST_AUTHORIZED' : 'PAYROLL_SUBMISSION_AUTHORIZED' }, run.id)} disabled={Boolean(state.acting)} className={`${BUTTON} bg-foreground text-background`}>Queue {run.persistedStatus === 'DRAFT' ? 'preview' : 'approved payroll'}</button> : null}
                  {capabilities.approveRun && run.persistedStatus === 'PREVIEWED' ? <button type="button" onClick={() => act('approve_run', { payrollRunId: run.id, expectedVersion: run.version, reasonCode: 'PAYROLL_PREVIEW_APPROVED' }, run.id)} disabled={Boolean(state.acting)} className={`${BUTTON} inline-flex items-center gap-2 bg-foreground text-background`}><ShieldCheck className="h-3.5 w-3.5" />Approve payroll</button> : null}
                  {capabilities.holdRun && !['PAID', 'CANCELLED', 'HELD'].includes(run.persistedStatus) ? <button type="button" onClick={() => act('hold_run', { payrollRunId: run.id, expectedVersion: run.version, holdCode: 'MANUAL_REVIEW_REQUIRED', ownerProfileId: capabilities.actorProfileId }, run.id)} disabled={Boolean(state.acting)} className={`${BUTTON} border border-foreground/10`}>Place hold</button> : null}
                  {capabilities.cancelRun && !['PAID', 'CANCELLED', 'PROCESSING', 'EMPLOYER_FUNDED', 'EMPLOYEE_PAYMENT_PENDING'].includes(run.persistedStatus) ? <button type="button" onClick={() => act('cancel_run', { payrollRunId: run.id, expectedVersion: run.version, reasonCode: 'LOCAL_RUN_CANCELLED' }, run.id)} disabled={Boolean(state.acting)} className={`${BUTTON} border border-red-500/20 text-red-700`}>Cancel local run</button> : null}
                </div>
                {capabilities.reconcileRun && ['PREVIEW_QUEUED', 'PREVIEWED', 'SUBMISSION_QUEUED', 'PROCESSING', 'EMPLOYER_FUNDED', 'EMPLOYEE_PAYMENT_PENDING'].includes(run.persistedStatus) ? <ReconcileRun key={`${run.id}:${run.persistedStatus}`} run={run} acting={state.acting} onReconcile={(payload) => act('reconcile_run', payload, run.id)} /> : null}
              </article>
            ))}
            {!runs.length ? <p className="rounded-3xl border border-dashed border-foreground/15 p-10 text-center text-sm text-foreground/45">No persisted payroll runs. This is a verified empty queue, not a demo state.</p> : null}
          </div>
        </section>

        <section>
          <div className="mb-3 border-b border-foreground/10 pb-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/40">Worker readiness</p><h2 className="mt-1 text-2xl font-semibold">Employees & management</h2></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{profiles.map((row) => <div key={row.id} className="rounded-2xl border border-foreground/10 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{row.workerName}</p><p className="mt-1 text-xs capitalize text-foreground/45">{row.workerCategory}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${pill(row.onboardingStatus)}`}>{row.onboardingStatus.replaceAll('_', ' ')}</span></div><p className="mt-3 text-xs text-foreground/50">Coverage {row.coverageStatus.replaceAll('_', ' ')} · payment method {row.paymentMethodStatus.replaceAll('_', ' ')}</p></div>)}</div>
        </section>

        {state.acting ? <p className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs text-background shadow-xl"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving controlled payroll action</p> : null}
      </div>
    </AdminShell>
  );
}
