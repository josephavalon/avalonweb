import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Settings,
  Stethoscope,
  WalletCards,
} from 'lucide-react';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet } from '@/lib/apiClient';
import { assertApiResponse, hasObjectRows, invalidApiResponse } from '@/lib/apiResponse';
import { useSeo } from '@/lib/seo';

const TERMINAL_RUN_STATUSES = new Set(['completed', 'closed', 'time_submitted', 'paid', 'cancelled']);
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
});
const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents || 0) / 100);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const labelCase = (value, fallback = '') => text(value || fallback).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDateTime = (value, fallback = 'Not recorded') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? DATE_TIME_FORMATTER.format(date) : fallback;
};

function nurseNav(activeShiftId = '') {
  return [
    { label: 'Work', to: '/provider/shifts', icon: BriefcaseBusiness },
    ...(activeShiftId ? [{ label: 'Shift', to: `/provider/shifts/${encodeURIComponent(activeShiftId)}`, icon: Stethoscope, primary: true }] : []),
    { label: 'Time & Pay', to: '/provider/invoices', icon: FileText, exact: true },
    { label: 'Me', to: '/provider/settings', icon: Settings },
  ];
}

function recordedMinutes(record) {
  const stored = Number(record?.approved_minutes ?? record?.recorded_minutes ?? record?.duration_minutes);
  if (Number.isFinite(stored) && stored >= 0) return stored;
  const start = Date.parse(record?.clocked_in_at || record?.clock_in_at);
  const end = Date.parse(record?.clocked_out_at || record?.clock_out_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

function durationLabel(record) {
  const minutes = recordedMinutes(record);
  if (!Number.isFinite(minutes)) return 'Duration pending';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function statusTone(value) {
  const status = text(value).toLowerCase();
  if (['approved', 'payment_ready', 'paid', 'completed', 'clocked_out'].includes(status)) return 'border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-800';
  if (['rejected', 'failed', 'exception_review', 'reconciliation_required', 'payout_failed'].includes(status)) return 'border-red-500/25 bg-red-500/[0.05] text-red-700';
  return 'border-amber-500/25 bg-amber-500/[0.05] text-amber-800';
}

function TimeRecord({ record }) {
  const status = record.approval_status || record.time_status || record.status || 'pending_review';
  return (
    <article className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">Actual time</p><h3 className="mt-1 text-base font-semibold">{record.title || record.shift_title || 'Recorded shift'}</h3></div>
        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.11em] ${statusTone(status)}`}>{labelCase(status)}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/35">Clock in</p><p className="mt-1 text-sm">{formatDateTime(record.clocked_in_at || record.clock_in_at)}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/35">Clock out</p><p className="mt-1 text-sm">{formatDateTime(record.clocked_out_at || record.clock_out_at)}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/35">Recorded duration</p><p className="mt-1 text-sm font-semibold">{durationLabel(record)}</p></div>
      </div>
      {Number(record.break_minutes) > 0 ? <p className="mt-3 text-xs text-foreground/55">Recorded breaks: {Number(record.break_minutes)} minutes</p> : null}
      {record.time_exception_status || record.exception_status ? <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 text-xs text-amber-800">Exception: {labelCase(record.time_exception_status || record.exception_status)}</p> : null}
    </article>
  );
}

function InvoiceRecord({ invoice }) {
  const invoiceStatus = text(invoice.status).toLowerCase() || 'pending';
  const paidProof = invoiceStatus === 'paid' && Boolean(invoice.paid_at) && Boolean(invoice.payment_reference);
  const paymentStatus = paidProof
    ? 'paid'
    : invoiceStatus === 'paid'
      ? 'reconciliation_required'
      : invoice.payout_status || invoice.payment_status || (['approved', 'payment_ready'].includes(invoiceStatus) ? invoiceStatus : 'not_submitted');
  return (
    <article className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">{invoice.invoice_number || 'Pay record'}</p>
          <p className="mt-1 text-sm">{invoice.period_start || 'Period pending'} – {invoice.period_end || 'Period pending'}</p>
        </div>
        <p className="font-heading text-3xl">{money(invoice.total_cents)}</p>
      </div>
      <div className="mt-4 grid gap-3 border-t border-foreground/10 pt-4 sm:grid-cols-2">
        <div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/35">Invoice review</p><span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.11em] ${statusTone(invoiceStatus)}`}>{labelCase(invoiceStatus)}</span></div>
        <div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/35">Payment</p><span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.11em] ${statusTone(paymentStatus)}`}>{labelCase(paymentStatus)}</span></div>
      </div>
      {paidProof ? <p className="mt-3 flex items-center gap-2 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4" />Stored Finance confirmation · {formatDateTime(invoice.paid_at)}</p> : null}
      {invoiceStatus === 'paid' && !paidProof ? <p className="mt-3 text-xs leading-relaxed text-red-700">A paid label exists without a stored paid time and payment reference. This record remains in reconciliation review and is not represented as paid.</p> : null}
      {invoice.review_note ? <p className="mt-3 text-sm leading-relaxed text-foreground/60">{invoice.review_note}</p> : null}
    </article>
  );
}

export default function NurseInvoices() {
  useSeo({
    title: 'Time & Pay — Avalon Vitality',
    description: 'Review stored actual time, invoice review, and confirmed payout state.',
    path: '/provider/invoices',
    robots: 'noindex, nofollow, noarchive',
  });
  const [state, setState] = useState({ loading: true, error: '', invoices: [], timeRecords: [], timeRecordsAvailable: false, activeShiftId: '' });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [payData, shiftsResult] = await Promise.all([
        apiGet('/api/me/nurse-invoices'),
        apiGet('/api/me/shifts').catch(() => null),
      ]);
      assertApiResponse(payData, { arrays: ['invoices'] }, 'Finance returned an invalid Time & Pay response.');
      if (!hasObjectRows(payData.invoices, ['id', 'invoice_number', 'status'])) throw invalidApiResponse('Finance returned invalid pay records.');
      if (payData.timeRecords !== undefined && !Array.isArray(payData.timeRecords)) throw invalidApiResponse('Finance returned invalid actual-time records.');
      if (shiftsResult) assertApiResponse(shiftsResult, { arrays: ['shifts'] }, 'Scheduling returned an invalid active-shift response.');
      const activeShift = Array.isArray(shiftsResult?.shifts) ? shiftsResult.shifts.find((shift) => {
        const status = text(shift?.run?.status || shift?.run?.workflow_status).toLowerCase();
        return status && !TERMINAL_RUN_STATUSES.has(status);
      }) : null;
      setState({
        loading: false,
        error: '',
        invoices: payData.invoices,
        timeRecords: Array.isArray(payData.timeRecords) ? payData.timeRecords : [],
        timeRecordsAvailable: Array.isArray(payData.timeRecords) && payData.timeRecordsStatus !== 'unavailable',
        activeShiftId: activeShift?.id || '',
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Could not load Time & Pay.', invoices: [], timeRecords: [], timeRecordsAvailable: false }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const navItems = useMemo(() => nurseNav(state.activeShiftId), [state.activeShiftId]);

  if (!state.loading && state.error) {
    return (
      <main className="min-h-dvh bg-background px-4 pb-28 pt-8 text-foreground">
        <section className="mx-auto max-w-4xl">
          <OperationalSourceUnavailable
            title="Time & Pay unavailable"
            description="Your actual-time, invoice-review, and payout records could not be verified. No amounts or payment status are shown until the persisted Finance source reconnects."
          />
        </section>
        <MobileNavBar items={nurseNav()} columns={3} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-8 text-foreground">
      <section className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Nurse portal</p><h1 className="font-heading text-5xl uppercase">Time & Pay</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/55">Actual clock records, review status, and payment status remain separate. Paid appears only after stored Finance confirmation.</p></div>
          <button type="button" onClick={load} className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15" aria-label="Refresh Time & Pay"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} /></button>
        </header>

        {state.loading ? <p className="mt-8 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading persisted Time & Pay</p> : null}

        <section className="mt-7">
          <div className="flex items-center gap-2"><Clock3 className="h-5 w-5" /><div><h2 className="text-lg font-semibold">Actual time</h2><p className="text-xs text-foreground/45">Server-recorded clock events and approval state</p></div></div>
          <div className="mt-3 grid gap-3">
            {state.timeRecords.map((record) => <TimeRecord key={record.id || record.shift_id} record={record} />)}
            {!state.loading && !state.timeRecordsAvailable ? <div className="rounded-3xl border border-dashed border-foreground/15 p-8 text-center"><Clock3 className="mx-auto h-6 w-6 text-foreground/35" /><p className="mt-3 text-sm font-semibold">Actual-time source not available</p><p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground/45">The Finance endpoint has not returned actual-time records. No scheduled duration is substituted.</p></div> : null}
            {!state.loading && state.timeRecordsAvailable && !state.timeRecords.length ? <div className="rounded-3xl border border-dashed border-foreground/15 p-8 text-center"><Clock3 className="mx-auto h-6 w-6 text-foreground/35" /><p className="mt-3 text-sm">No recorded shift time yet.</p></div> : null}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2"><WalletCards className="h-5 w-5" /><div><h2 className="text-lg font-semibold">Invoice and payment</h2><p className="text-xs text-foreground/45">Human review and stored payment state</p></div></div>
          <div className="mt-3 grid gap-3">
            {state.invoices.map((invoice) => <InvoiceRecord key={invoice.id} invoice={invoice} />)}
            {!state.loading && !state.invoices.length ? <div className="rounded-3xl border border-dashed border-foreground/15 p-8 text-center"><FileText className="mx-auto h-6 w-6 text-foreground/35" /><p className="mt-3 text-sm">No invoice or payout records yet.</p></div> : null}
          </div>
        </section>
      </section>
      <MobileNavBar items={navItems} columns={navItems.length} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" />
    </main>
  );
}
