import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, CreditCard, ExternalLink, Loader2, MapPin, RefreshCw, Undo2 } from 'lucide-react';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import { apiGet, apiPost } from '@/lib/apiClient';
import { useSeo } from '@/lib/seo';

const QUICK_REASONS = [
  'Need to cancel this visit',
  'Booked the wrong service',
  'Schedule conflict',
  'Charged the wrong amount',
];

const BG = 'hsl(var(--background))';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const ACCENT = 'hsl(var(--accent))';

function money(value) {
  if (value == null) return '$0';
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function fmtWhen(iso) {
  if (!iso) return 'Time to be confirmed';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time to be confirmed';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusLabel(status) {
  if (status === 'paid_in_full') return 'Paid in full';
  if (status === 'partial_payment') return 'Balance due';
  if (status === 'pending') return 'Pending';
  return status ? String(status).replace(/_/g, ' ') : 'Pending';
}

function RefundRequest({ appointment }) {
  // Eligible: the member has actually paid something, and there isn't already a
  // refund in flight. This is a REQUEST only — staff action the refund.
  const paidSomething = Number(appointment.depositPaid || 0) > 0 || appointment.paymentStatus === 'paid_in_full' || appointment.paymentStatus === 'partial_payment';
  const alreadyResolved = appointment.refundStatus && appointment.refundStatus !== '';
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [phase, setPhase] = useState(alreadyResolved ? 'requested' : 'idle'); // idle | submitting | requested | error
  const [error, setError] = useState('');

  if (!paidSomething) return null;

  if (phase === 'requested') {
    return (
      <p className="mt-3 flex items-center gap-2 font-body text-[11px]" style={{ color: 'hsl(152 60% 55%)' }}>
        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
        Refund requested — our team will follow up.
      </p>
    );
  }

  async function submit() {
    const trimmed = reason.trim();
    if (!trimmed) { setError('Please add a quick reason.'); return; }
    setPhase('submitting');
    setError('');
    try {
      const res = await apiPost('/api/me/refund-request', { appointmentId: appointment.id, reason: trimmed });
      if (res?.ok) { setPhase('requested'); return; }
      throw new Error('failed');
    } catch {
      setPhase('error');
      setError('Could not submit. Please try again or contact Avalon.');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{ color: DIM }}
      >
        <Undo2 className="h-3.5 w-3.5" strokeWidth={1.8} />
        Request refund
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
      <p className="font-body text-[9px] uppercase tracking-[0.18em]" style={{ color: DIM }}>Request a refund</p>
      <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>Refunds are reviewed by our team — submitting this does not charge or refund anything automatically.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_REASONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setReason(q)}
            className="rounded-full px-2.5 py-1 font-body text-[10px]"
            style={reason === q
              ? { color: INVERT, background: TEXT, border: `1px solid ${TEXT}` }
              : { color: MUTED, background: CARD, border: `1px solid ${BORDER}` }}
          >
            {q}
          </button>
        ))}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Tell us what happened (optional detail)…"
        className="mt-2 w-full resize-none rounded-xl px-3 py-2 font-body text-[12px] outline-none"
        style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT }}
      />
      {error ? <p className="mt-1.5 font-body text-[11px]" style={{ color: 'hsl(0 70% 72%)' }}>{error}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={phase === 'submitting'}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-full px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-50"
          style={{ background: TEXT, color: INVERT }}
        >
          {phase === 'submitting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : null}
          Submit request
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); }}
          disabled={phase === 'submitting'}
          className="inline-flex min-h-[36px] items-center rounded-full px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-50"
          style={{ color: MUTED, background: CARD, border: `1px solid ${BORDER}` }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function BookingCard({ appointment }) {
  const hasBalance = Number(appointment.balanceDue || 0) > 0 && appointment.paymentStatus !== 'paid_in_full';
  return (
    <article className="rounded-[24px] p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-3xl uppercase leading-none">{appointment.service}</h2>
            {appointment.isMembership ? (
              <span className="rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: ACCENT, background: 'hsl(var(--accent) / 0.08)', border: '1px solid hsl(var(--accent) / 0.20)' }}>Plan</span>
            ) : null}
          </div>
          <p className="mt-2 flex items-center gap-2 font-body text-sm" style={{ color: MUTED }}>
            <Calendar className="h-4 w-4" strokeWidth={1.7} />
            {fmtWhen(appointment.startsAt)}
          </p>
          {appointment.items?.length ? (
            <p className="mt-2 font-body text-xs" style={{ color: DIM }}>{appointment.items.join(' · ')}</p>
          ) : null}
        </div>
        <span className="inline-flex w-fit items-center rounded-full px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.14em]" style={{
          color: hasBalance ? 'hsl(38 92% 72%)' : 'hsl(152 60% 55%)',
          background: CARD_STRONG,
          border: `1px solid ${BORDER}`,
        }}>
          {statusLabel(appointment.paymentStatus)}
        </span>
      </div>

      <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-3" style={{ borderColor: BORDER }}>
        <div className="rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[8px] uppercase tracking-[0.18em]" style={{ color: DIM }}>Visit total</p>
          <p className="mt-1 font-body text-sm font-semibold">{money(appointment.visitSubtotal || 0)}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[8px] uppercase tracking-[0.18em]" style={{ color: DIM }}>Deposit paid</p>
          <p className="mt-1 font-body text-sm font-semibold">{money(appointment.depositPaid || 0)}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[8px] uppercase tracking-[0.18em]" style={{ color: DIM }}>Balance</p>
          <p className="mt-1 font-body text-sm font-semibold">{money(appointment.balanceDue || 0)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {appointment.rescheduleUrl ? (
          <a
            href={appointment.rescheduleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ background: TEXT, color: INVERT }}
          >
            Reschedule <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        ) : null}
        {appointment.acuityAppointmentId ? (
          <span className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM, background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
            Acuity #{appointment.acuityAppointmentId}
          </span>
        ) : (
          <span className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(38 92% 72%)', background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
            <CreditCard className="h-3.5 w-3.5" strokeWidth={1.8} />
            Payment received, scheduling pending
          </span>
        )}
      </div>

      <RefundRequest appointment={appointment} />
    </article>
  );
}

export default function Bookings() {
  useSeo({
    title: 'My Bookings — Avalon Vitality',
    description: 'Review your Avalon Vitality visit schedule and payment status.',
    path: '/members/bookings',
  });

  const [state, setState] = useState({ loading: true, error: '', appointments: [] });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await apiGet('/api/me/appointments');
      setState({ loading: false, error: '', appointments: Array.isArray(data?.appointments) ? data.appointments : [] });
    } catch {
      setState({ loading: false, error: 'Could not load your bookings.', appointments: [] });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const upcoming = useMemo(() => {
    const now = Date.now() - 12 * 60 * 60 * 1000;
    return state.appointments.filter((item) => !item.startsAt || new Date(item.startsAt).getTime() >= now);
  }, [state.appointments]);

  return (
    <div className="min-h-screen pb-[calc(9rem+env(safe-area-inset-bottom))]" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 px-4 py-3 backdrop-blur-2xl" style={{ background: 'hsl(var(--background) / 0.86)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/members/dashboard" className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          </Link>
          <div className="text-center">
            <p className="font-body text-[9px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Client Portal</p>
            <h1 className="font-heading text-2xl uppercase tracking-[0.08em]">Bookings</h1>
          </div>
          <button type="button" onClick={load} disabled={state.loading} className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-45" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Refresh bookings">
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <section className="rounded-[28px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Upcoming</p>
          <h2 className="mt-2 font-heading text-5xl uppercase leading-none">Visits</h2>
          <p className="mt-3 font-body text-sm" style={{ color: MUTED }}>
            {state.loading ? 'Loading your schedule...' : `${upcoming.length} upcoming visit${upcoming.length === 1 ? '' : 's'} linked to your account.`}
          </p>
        </section>

        {state.error ? (
          <div className="rounded-2xl px-4 py-3 font-body text-sm" style={{ color: 'hsl(0 70% 72%)', background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
            {state.error}
          </div>
        ) : null}

        {state.loading ? (
          <div className="flex items-center gap-2 rounded-2xl px-4 py-5 font-body text-sm" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Loading bookings
          </div>
        ) : null}

        {!state.loading && !state.error && state.appointments.length === 0 ? (
          <div className="rounded-[24px] p-5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-sm" style={{ color: MUTED }}>No bookings are linked to this email yet.</p>
            <Link to="/book" className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full px-5 font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: TEXT, color: INVERT }}>
              Book a visit
            </Link>
          </div>
        ) : null}

        <div className="grid gap-3">
          {state.appointments.map((appointment) => <BookingCard key={appointment.id} appointment={appointment} />)}
        </div>
      </main>
      <MemberBottomNav />
    </div>
  );
}
