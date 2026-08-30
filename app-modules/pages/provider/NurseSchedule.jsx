import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  HandCoins,
  Loader2,
  MapPin,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, apiPost } from '@/lib/apiClient';
import { assertApiResponse, hasObjectRows, invalidApiResponse } from '@/lib/apiResponse';
import { useSeo } from '@/lib/seo';

const FILTERS = [
  ['offers', 'Offers'],
  ['ready', 'Ready'],
  ['pending', 'Pending'],
  ['accepted', 'Accepted'],
  ['today', 'Today'],
  ['upcoming', 'Upcoming'],
  ['events', 'Events'],
  ['history', 'History'],
];
const ACTIVE_ASSIGNMENT_STATUSES = new Set(['accepted', 'claimed', 'assigned', 'in_progress']);
const TERMINAL_ASSIGNMENT_STATUSES = new Set(['declined', 'expired', 'completed', 'cancelled']);
const TERMINAL_RUN_STATUSES = new Set(['completed', 'closed', 'time_submitted', 'paid', 'cancelled']);
const READY_STATUSES = new Set(['ready', 'clear']);
const BLOCKED_STATUSES = new Set(['blocked', 'failed', 'expired', 'stale', 'unavailable']);
const SHIFT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
});
const SHIFT_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
});
const MONEY_FORMATTER = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const dayKey = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) : '';
};
const formatDateTime = (value, fallback = 'Not available') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? DATE_TIME_FORMATTER.format(date) : fallback;
};
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const labelCase = (value, fallback = '') => text(value || fallback).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const assignmentStatus = (shift) => text(shift?.assignment?.status || shift?.assignment_status).toLowerCase();
const runStatus = (shift) => text(shift?.run?.status || shift?.run?.workflow_status).toLowerCase();
const readinessStatus = (shift) => text(shift?.readiness?.status).toLowerCase();
const isReady = (shift) => READY_STATUSES.has(readinessStatus(shift));
const isActiveRun = (shift) => Boolean(runStatus(shift)) && !TERMINAL_RUN_STATUSES.has(runStatus(shift));
const isAccepted = (shift) => ACTIVE_ASSIGNMENT_STATUSES.has(assignmentStatus(shift)) || isActiveRun(shift);
const isHistory = (shift) => (
  TERMINAL_ASSIGNMENT_STATUSES.has(assignmentStatus(shift))
  || TERMINAL_RUN_STATUSES.has(runStatus(shift))
  || ['completed', 'cancelled'].includes(text(shift?.status).toLowerCase())
);
const hasOfferTerms = (shift) => Boolean(
  shift?.offer_terms
  && typeof shift.offer_terms === 'object'
  && shift.offer_terms.claim_eligible === true
  && ['proposed', 'accepted'].includes(text(shift.offer_terms.status).toLowerCase()),
);

function nurseNav(activeShiftId = '') {
  return [
    { label: 'Work', to: '/provider/shifts', icon: BriefcaseBusiness, exact: true },
    ...(activeShiftId ? [{ label: 'Shift', to: `/provider/shifts/${encodeURIComponent(activeShiftId)}`, icon: Stethoscope, primary: true }] : []),
    { label: 'Time & Pay', to: '/provider/invoices', icon: FileText },
    { label: 'Me', to: '/provider/settings', icon: Settings },
  ];
}

function filterShift(shift, filter) {
  const today = dayKey(new Date());
  const starts = Date.parse(shift?.starts_at);
  const now = Date.now();
  const status = text(shift?.status).toLowerCase();
  const assignment = assignmentStatus(shift);
  const offered = assignment === 'offered' || ['open', 'offered'].includes(status);
  const accepted = isAccepted(shift);
  const history = isHistory(shift) || (Number.isFinite(starts) && starts < now && !accepted && !offered);

  if (filter === 'offers') return offered && !history;
  if (filter === 'ready') return isReady(shift) && !history;
  if (filter === 'pending') return !isReady(shift) && !history;
  if (filter === 'accepted') return accepted && !history;
  if (filter === 'today') return accepted && dayKey(shift?.starts_at) === today && !history;
  if (filter === 'upcoming') return accepted && Number.isFinite(starts) && starts >= now && !history;
  if (filter === 'events') return Boolean(shift?.event || shift?.event_container_id) && !history;
  return history;
}

function statusTone(status) {
  if (READY_STATUSES.has(status) || ['accepted', 'claimed', 'assigned', 'completed'].includes(status)) {
    return 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700';
  }
  if (BLOCKED_STATUSES.has(status) || ['cancelled', 'declined', 'expired'].includes(status)) {
    return 'border-red-500/30 bg-red-500/[0.06] text-red-700';
  }
  if (['offered', 'open', 'pending', 'readiness_check'].includes(status)) {
    return 'border-amber-500/30 bg-amber-500/[0.06] text-amber-700';
  }
  return 'border-foreground/15 bg-foreground/[0.025] text-foreground/60';
}

function ReadinessPanel({ readiness }) {
  const [expanded, setExpanded] = useState(false);
  const domains = Array.isArray(readiness?.domains)
    ? readiness.domains
    : readiness?.domains && typeof readiness.domains === 'object'
      ? Object.entries(readiness.domains).map(([key, value]) => ({ key, ...(value && typeof value === 'object' ? value : {}) }))
      : [];
  const status = text(readiness?.status).toLowerCase() || 'unavailable';
  const ready = READY_STATUSES.has(status);

  return (
    <section className={`mt-4 rounded-2xl border p-3 ${ready ? 'border-emerald-500/20 bg-emerald-500/[0.035]' : 'border-amber-500/25 bg-amber-500/[0.035]'}`}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          {ready ? <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />}
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/45">Readiness</span>
            <span className="block text-sm font-semibold">{labelCase(status, 'Unavailable')}</span>
          </span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/45">{expanded ? 'Hide' : 'Evidence'}</span>
      </button>
      {expanded ? (
        <div className="mt-3 border-t border-foreground/10 pt-3">
          <div className="grid gap-2">
            {domains.map((domain) => {
              const domainStatus = text(domain?.status).toLowerCase() || 'unavailable';
              return (
                <div key={domain?.key || domain?.label} className="rounded-xl bg-background/55 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{domain?.label || labelCase(domain?.key, 'Readiness check')}</p>
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${statusTone(domainStatus)}`}>{labelCase(domainStatus)}</span>
                  </div>
                  {domain?.reason || domain?.reason_code ? <p className="mt-2 text-xs leading-relaxed text-foreground/60">{domain.reason || labelCase(domain.reason_code)}</p> : null}
                  {domain?.remediation ? <p className="mt-2 text-xs font-medium text-foreground/75">Next: {domain.remediation}</p> : null}
                  {domain?.owner || domain?.owner_role ? <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-foreground/40">Owner: {labelCase(domain.owner || domain.owner_role)}</p> : null}
                </div>
              );
            })}
            {!domains.length ? <p className="text-xs leading-relaxed text-foreground/55">Readiness evidence is not available. Work acceptance stays disabled until the server verifies every required domain.</p> : null}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-foreground/40">
            Checked {formatDateTime(readiness?.checked_at)}{readiness?.expires_at ? ` · Expires ${formatDateTime(readiness.expires_at)}` : ''}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function OfferTerms({ terms }) {
  const current = terms && typeof terms === 'object' && terms.claim_eligible === true
    && ['proposed', 'accepted'].includes(text(terms.status).toLowerCase());
  if (!current) {
    return <p className="mt-3 rounded-xl border border-dashed border-foreground/15 p-3 text-xs leading-relaxed text-foreground/55">Offer terms are not current{terms?.reason_code ? ` (${labelCase(terms.reason_code)})` : ''}. Acceptance and counter actions stay disabled until Avalon provides verified pay, time, travel, and cancellation terms.</p>;
  }
  const numeric = (value) => value == null || value === '' ? NaN : Number(value);
  const rateCents = numeric(terms.hourly_rate_cents);
  const grossPayCents = numeric(terms.gross_pay_cents);
  const guaranteedCents = numeric(terms.guaranteed_minimum_cents);
  const mileageCents = numeric(terms.mileage_rate_cents);
  const workMinutes = numeric(terms.estimated_work_minutes);
  const travelMinutes = numeric(terms.estimated_travel_minutes);
  const facts = [
    [Number.isFinite(rateCents), 'Rate', MONEY_FORMATTER.format(rateCents / 100) + (terms.rate_unit ? ` / ${terms.rate_unit}` : ' / hr')],
    [Number.isFinite(grossPayCents), 'Gross pay', MONEY_FORMATTER.format(grossPayCents / 100)],
    [Number.isFinite(guaranteedCents), 'Guaranteed minimum', MONEY_FORMATTER.format(guaranteedCents / 100)],
    [Number.isFinite(workMinutes), 'Estimated work', `${workMinutes} minutes`],
    [Number.isFinite(travelMinutes), 'Estimated travel', `${travelMinutes} minutes`],
    [text(terms.engagement_model), 'Engagement', labelCase(terms.engagement_model)],
    [Number.isFinite(mileageCents), 'Mileage', `${MONEY_FORMATTER.format(mileageCents / 100)} / mile`],
    [text(terms.cancellation_terms_code), 'Cancellation', labelCase(terms.cancellation_terms_code)],
    [text(terms.expense_policy_code), 'Expenses', labelCase(terms.expense_policy_code)],
    [text(terms.status).toLowerCase() === 'accepted' && terms.accepted_at, 'Accepted', formatDateTime(terms.accepted_at)],
    [text(terms.status).toLowerCase() === 'proposed' && terms.expires_at, 'Offer deadline', formatDateTime(terms.expires_at)],
  ].filter(([show]) => show).map(([, label, value]) => ({ label, value }));
  return (
    <section className="mt-3 rounded-2xl border border-foreground/10 bg-background/55 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/45">Offer terms</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {facts.map((fact) => <div key={fact.label}><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/35">{fact.label}</p><p className="mt-0.5 text-xs leading-relaxed text-foreground/70">{fact.value}</p></div>)}
      </div>
      {!facts.length ? <p className="mt-2 text-xs text-foreground/55">Verified terms are attached to this offer.</p> : null}
    </section>
  );
}

function ShiftCard({ shift, busy, onAction }) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [counter, setCounter] = useState({ proposedRate: '', proposedStartAt: '', proposedEndAt: '', note: '' });
  const assignment = assignmentStatus(shift);
  const status = assignment || runStatus(shift) || text(shift.status).toLowerCase() || 'pending';
  const accepted = isAccepted(shift);
  const offered = assignment === 'offered' || ['open', 'offered'].includes(text(shift.status).toLowerCase());
  const ready = isReady(shift);
  const termsReady = hasOfferTerms(shift);
  const claimAllowed = shift?.readiness?.claim_allowed === true;
  const canClaim = offered && ready && claimAllowed && termsReady && !busy;
  const canCounter = offered && termsReady && !busy;
  const canDecline = offered && !busy;
  const start = new Date(shift.starts_at);
  const end = new Date(shift.ends_at);
  const dateLabel = Number.isFinite(start.getTime())
    ? `${SHIFT_DATE_FORMATTER.format(start)}${Number.isFinite(end.getTime()) ? ` – ${SHIFT_TIME_FORMATTER.format(end)}` : ''}`
    : 'Time pending';
  const counterHasChange = Boolean(counter.proposedRate || counter.proposedStartAt || counter.proposedEndAt || text(counter.note));
  const submitCounter = () => {
    if (!counterHasChange) return;
    const proposedRate = Number(counter.proposedRate);
    const payload = {
      counter: {
        ...(Number.isFinite(proposedRate) && proposedRate > 0 ? { proposedRateCents: Math.round(proposedRate * 100) } : {}),
        ...(counter.proposedStartAt ? { proposedStartAt: new Date(counter.proposedStartAt).toISOString() } : {}),
        ...(counter.proposedEndAt ? { proposedEndAt: new Date(counter.proposedEndAt).toISOString() } : {}),
        ...(text(counter.note) ? { note: text(counter.note) } : {}),
      },
      note: text(counter.note) || undefined,
    };
    onAction(shift, 'counter', payload).then((ok) => { if (ok) setCounterOpen(false); });
  };

  return (
    <article className="rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{shift.title || 'Clinical work item'}</h2>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${statusTone(status)}`}>{labelCase(status)}</span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-foreground/65"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{dateLabel}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/45"><MapPin className="h-3.5 w-3.5 shrink-0" />{shift.location_name || shift.service_area || 'Location available after acceptance'}</p>
          {shift.event ? <p className="mt-1 text-xs text-foreground/45">Event assignment: {shift.event.name || 'Approved event'}</p> : null}
        </div>
        {accepted ? (
          <Link to={`/provider/shifts/${encodeURIComponent(shift.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-background">
            Open shift <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <OfferTerms terms={shift.offer_terms} />
      <ReadinessPanel readiness={shift.readiness} />

      {offered && !accepted ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!canClaim} onClick={() => onAction(shift, 'claim')} className="min-h-11 rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.13em] text-background disabled:cursor-not-allowed disabled:opacity-40">
              {busy === shift.id ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />}Accept
            </button>
            <button type="button" disabled={!canCounter} onClick={() => setCounterOpen((value) => !value)} className="min-h-11 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.13em] disabled:cursor-not-allowed disabled:opacity-40"><HandCoins className="mr-1 inline h-3.5 w-3.5" />Request changes</button>
            <button type="button" disabled={!canDecline} onClick={() => onAction(shift, 'decline', { reasonCode: 'nurse_declined' })} className="min-h-11 rounded-full border border-red-500/20 px-4 text-[10px] font-bold uppercase tracking-[0.13em] text-red-700 disabled:cursor-not-allowed disabled:opacity-40"><XCircle className="mr-1 inline h-3.5 w-3.5" />Decline</button>
          </div>
          {!ready ? <p className="mt-2 text-xs text-amber-700">Acceptance stays disabled until every readiness check is current and clear.</p> : null}
          {ready && !claimAllowed ? <p className="mt-2 text-xs text-amber-700">The server has not authorized claim for this readiness snapshot. Refresh or follow the listed remediation.</p> : null}
          {ready && !termsReady ? <p className="mt-2 text-xs text-amber-700">Acceptance stays disabled until verified offer terms are available.</p> : null}
        </div>
      ) : null}

      {counterOpen ? (
        <div className="mt-4 rounded-2xl border border-foreground/10 bg-background/65 p-4">
          <p className="text-sm font-semibold">Counter request</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/55">Request a different rate or time. Avalon must approve the change before the assignment is accepted.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold">Hourly rate
              <input type="number" min="0" step="0.01" inputMode="decimal" value={counter.proposedRate} onChange={(event) => setCounter((value) => ({ ...value, proposedRate: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base" placeholder="Optional" />
            </label>
            <label className="text-xs font-semibold">Start
              <input type="datetime-local" value={counter.proposedStartAt} onChange={(event) => setCounter((value) => ({ ...value, proposedStartAt: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base" />
            </label>
            <label className="text-xs font-semibold">End
              <input type="datetime-local" value={counter.proposedEndAt} onChange={(event) => setCounter((value) => ({ ...value, proposedEndAt: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-base" />
            </label>
          </div>
          <label className="mt-3 block text-xs font-semibold">Note
            <textarea value={counter.note} onChange={(event) => setCounter((value) => ({ ...value, note: event.target.value.slice(0, 500) }))} className="mt-1 min-h-24 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-base" placeholder="Operational details only. Do not include client or clinical information." />
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy === shift.id || !counterHasChange} onClick={submitCounter} className="min-h-11 rounded-full bg-foreground px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">Send request</button>
            <button type="button" onClick={() => setCounterOpen(false)} className="min-h-11 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em]">Cancel</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function NurseSchedule() {
  useSeo({
    title: 'Work Queue — Avalon Vitality',
    description: 'Review readiness, respond to offers, and open active Avalon shifts.',
    path: '/provider/shifts',
    robots: 'noindex, nofollow, noarchive',
  });
  const [state, setState] = useState({ loading: true, error: '', shifts: [], provider: null });
  const [filter, setFilter] = useState('offers');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const from = new Date(Date.now() - 120 * 86400000).toISOString();
      const to = new Date(Date.now() + 366 * 86400000).toISOString();
      const data = await apiGet(`/api/me/shifts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      assertApiResponse(data, { arrays: ['shifts'] }, 'Scheduling returned an invalid work queue response.');
      if (!hasObjectRows(data.shifts, ['id', 'version', 'status', 'starts_at', 'ends_at'])) {
        throw invalidApiResponse('Scheduling returned invalid work items.');
      }
      setState({ loading: false, error: '', shifts: data.shifts, provider: data.provider && typeof data.provider === 'object' ? data.provider : null });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Could not load work.', shifts: [] }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => state.shifts.filter((shift) => filterShift(shift, filter)), [filter, state.shifts]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([key]) => [key, state.shifts.filter((shift) => filterShift(shift, key)).length])), [state.shifts]);
  const activeShift = useMemo(() => state.shifts.find((shift) => isActiveRun(shift)) || null, [state.shifts]);
  const navItems = nurseNav(activeShift?.id || '');

  const act = async (shift, action, extra = {}) => {
    setBusy(shift.id);
    setActionError('');
    try {
      await apiPost('/api/me/shifts', { shiftId: shift.id, version: shift.version, action, ...extra });
      await load();
      return true;
    } catch (error) {
      setActionError(error.message || 'That work action could not be saved. Nothing changed.');
      return false;
    } finally {
      setBusy('');
    }
  };

  if (!state.loading && state.error && state.shifts.length === 0) {
    return (
      <main className="min-h-dvh bg-background px-4 pb-28 pt-8 text-foreground">
        <section className="mx-auto max-w-5xl">
          <OperationalSourceUnavailable
            title="Work queue unavailable"
            description="Your offers, readiness, and accepted work could not be verified. No work records are shown, and all work actions remain disabled until the persisted source reconnects."
          />
        </section>
        <MobileNavBar items={nurseNav()} columns={3} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 text-foreground">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Nurse portal</p>
            <h1 className="font-heading text-5xl uppercase">Work Queue</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/55">Review current evidence and offer terms before accepting. Clinical decisions remain with you and the approved source of record.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/provider/settings" className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15" aria-label="Work settings"><SlidersHorizontal className="h-4 w-4" /></Link>
            <button type="button" onClick={load} className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15" aria-label="Refresh work queue"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </header>

        {state.provider ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-foreground/10 bg-foreground/[0.025] px-4 py-3 text-xs text-foreground/60">
            <span className="font-semibold text-foreground">{state.provider.display_name || state.provider.full_name || 'Nurse profile'}</span>
            {state.provider.engagement_status ? <span>Engagement: {labelCase(state.provider.engagement_status)}</span> : null}
            {state.provider.credential_status ? <span>Credentials: {labelCase(state.provider.credential_status)}</span> : null}
          </div>
        ) : null}

        <div className="mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-foreground/10 p-1" aria-label="Work queue filters">
          {FILTERS.map(([key, label]) => (
            <button type="button" key={key} onClick={() => setFilter(key)} aria-pressed={filter === key} className={`min-h-11 shrink-0 rounded-xl px-4 text-[10px] font-bold uppercase tracking-[0.13em] ${filter === key ? 'bg-foreground text-background' : 'text-foreground/55'}`}>
              {label} <span className="ml-1 opacity-65">{counts[key] || 0}</span>
            </button>
          ))}
        </div>

        {actionError ? <p role="alert" className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-700">{actionError}</p> : null}
        {state.error ? <p role="alert" className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-800">The queue could not fully refresh. Existing verified records remain visible; retry before taking an action.</p> : null}

        <div className="mt-5 grid gap-3">
          {rows.map((shift) => <ShiftCard key={shift.id} shift={shift} busy={busy} onAction={act} />)}
          {state.loading ? <p className="flex items-center gap-2 p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading persisted work</p> : null}
          {!state.loading && !rows.length ? (
            <div className="rounded-3xl border border-dashed border-foreground/15 p-10 text-center">
              <Clock3 className="mx-auto h-6 w-6 text-foreground/35" />
              <p className="mt-3 text-sm font-semibold">No {FILTERS.find(([key]) => key === filter)?.[1].toLowerCase()} work</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground/45">Only persisted work appears here. New or changed assignments show after Avalon saves and verifies them.</p>
            </div>
          ) : null}
        </div>
      </section>
      <MobileNavBar items={navItems} columns={navItems.length} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" />
    </main>
  );
}
