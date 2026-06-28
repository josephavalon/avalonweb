import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  ArrowRight,
  Calendar,
  Fingerprint,
  LogOut,
  MessageCircle,
  FileText,
  Crown,
  CreditCard,
  UserRound,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { readLastBooking } from '@/lib/localOs';
import { apiGet, apiPost } from '@/lib/apiClient';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';
import { authProviderConfig } from '@/lib/authProviderConfig';

function formatWhen(startsAt) {
  if (!startsAt) return '';
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function money(value) {
  if (value == null) return '$0';
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

const PAYMENT_LABEL = { paid_in_full: 'Paid', deposit_paid: 'Deposit', pending: 'Pending' };
function paymentLabel(status) {
  return PAYMENT_LABEL[status] || (status ? status.replace(/_/g, ' ') : 'Pending');
}

// Pick a product bag image for a therapy name (mirrors the booking/menu mapping).
function bagForService(service = '') {
  const s = String(service).toLowerCase();
  if (s.includes('nad')) return '/bags/nad.webp';
  if (s.includes('cbd')) return '/bags/cbd.webp';
  if (s.includes('hydrat') || s.includes('dehydr')) return '/bags/dehydration.webp';
  if (s.includes('energy')) return '/bags/energy.webp';
  if (s.includes('immun')) return '/bags/immunity.webp';
  if (s.includes('beauty') || s.includes('glow')) return '/bags/beauty.webp';
  if (s.includes('recover')) return '/bags/recovery.webp';
  if (s.includes('myers')) return '/bags/myers.webp';
  if (s.includes('night')) return '/bags/night-out.webp';
  if (s.includes('travel') || s.includes('jet')) return '/bags/jet-lag.webp';
  return '/bags/dehydration.webp';
}

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const ACCENT = 'hsl(var(--accent))';
const GOOD = 'hsl(140 30% 60%)';
const WARN = 'hsl(38 70% 60%)';
const BAD = 'hsl(0 70% 62%)';

// Pulsing muted bar used as a loading placeholder. Purely visual — shaped to
// roughly match the text it stands in for so the layout doesn't jump.
function SkeletonBar({ className = '', style }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md ${className}`}
      style={{ background: CARD_STRONG, ...style }}
    />
  );
}

function Action({ to, href, icon: Icon, label, primary = false }) {
  const className = 'flex min-h-[58px] items-center justify-between rounded-2xl px-4 font-body text-[11px] font-bold uppercase tracking-[0.18em] transition-transform active:scale-[0.98]';
  const style = {
    background: primary ? TEXT : CARD,
    color: primary ? INVERT : TEXT,
    border: `1px solid ${primary ? TEXT : BORDER}`,
  };
  const body = (
    <>
      <span className="flex items-center gap-2.5"><Icon className="h-4 w-4" strokeWidth={1.8} />{label}</span>
      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
    </>
  );
  if (href) return <a href={href} className={className} style={style}>{body}</a>;
  return <Link to={to} className={className} style={style}>{body}</Link>;
}

function StatCol({ label, value, divider, loading }) {
  return (
    <div className="px-2 py-3.5 text-center" style={divider ? { borderRight: `1px solid ${BORDER}` } : undefined}>
      {loading ? (
        <SkeletonBar className="mx-auto h-7 w-10 md:h-8" />
      ) : (
        <p className="truncate font-heading text-2xl uppercase leading-none md:text-3xl">{value}</p>
      )}
      <p className="mt-1.5 font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>{label}</p>
    </div>
  );
}

function RecentRow({ service, when, status }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
      <span className="flex h-12 w-9 shrink-0 items-center justify-center">
        <img src={bagForService(service)} alt={service ? `${service} IV therapy` : ''} loading="lazy" className="h-full w-auto object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-lg uppercase leading-none">{service}</p>
        <p className="mt-0.5 font-body text-[11px]" style={{ color: DIM }}>{when}</p>
      </div>
      <span className="shrink-0 font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>{status}</span>
    </div>
  );
}

// --- Expanded portal cards -------------------------------------------------

// Format an ISO date as a short "Jul 8" style label (no fabrication — returns
// '' when the date is missing/invalid so the caller can show a dash).
function formatChargeDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Real plan card driven by GET /api/me/subscription/status. `sub` is the
// fetched status object (or null), `subState` carries loading/error so we can
// render a skeleton / fall back without ever inventing a tier or amount.
function PlanCard({ sub, subState, creditsAvailable, creditsTotal }) {
  const loading = subState?.loading;
  const hasPlan = !!sub?.hasPlan;

  // Loading skeleton — pulsing muted bars shaped like the loaded card, never
  // stale/fake content.
  if (loading) {
    return (
      <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-busy="true">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Active Plan</p>
        <SkeletonBar className="mt-3 h-8 w-2/3" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <SkeletonBar className="h-2.5 w-12" />
            <SkeletonBar className="mt-2 h-6 w-3/4" />
          </div>
          <div>
            <SkeletonBar className="h-2.5 w-16" />
            <SkeletonBar className="mt-2 h-6 w-3/4" />
          </div>
        </div>
        <SkeletonBar className="mt-4 h-11 w-full rounded-xl" />
      </div>
    );
  }

  // No active plan (either explicitly !hasPlan, or the status call failed/404'd
  // and we have no plan record to trust) → CTA to explore plans.
  if (!hasPlan) {
    return (
      <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Active Plan</p>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: CARD_STRONG, color: MUTED, border: `1px solid ${BORDER}` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: DIM }} />
            Inactive
          </span>
        </div>
        <h3 className="mt-3 font-heading text-3xl uppercase leading-none md:text-4xl">No active plan</h3>
        <p className="mt-3 font-body text-[12px]" style={{ color: MUTED }}>
          Add a plan to bank visit credits each cycle and lock in member pricing.
        </p>
        <Link to="/subscription" className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: TEXT, color: INVERT }}>
          Explore plans <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    );
  }

  const tier = sub.name || 'Active plan';
  const active = !sub.status || sub.status === 'active' || sub.status === 'trialing';
  const chargeDate = formatChargeDate(sub.nextChargeIso);
  const chargeAmount = sub.nextChargeAmountDollars != null ? money(sub.nextChargeAmountDollars) : '';
  const nextCharge = chargeDate && chargeAmount ? `${chargeDate} · ${chargeAmount}`
    : chargeDate || chargeAmount || '—';
  const pm = sub.defaultPaymentMethod || null;
  const cardLine = pm?.last4
    ? `${pm.brand ? `${pm.brand} ` : 'card '}ending ${pm.last4}`
    : 'No card on file';
  const cycleLabel = sub.cancelAtPeriodEnd ? 'ends this cycle' : 'remaining this cycle';

  return (
    <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Active Plan</p>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: active ? 'hsl(140 30% 60% / 0.12)' : CARD_STRONG, color: active ? GOOD : MUTED, border: `1px solid ${active ? 'hsl(140 30% 60% / 0.25)' : BORDER}` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? GOOD : DIM }} />
          {sub.cancelAtPeriodEnd ? 'Ending' : active ? 'Active' : (sub.status || 'Inactive')}
        </span>
      </div>
      <h3 className="mt-3 font-heading text-3xl uppercase leading-none md:text-4xl">{tier}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>Credits</p>
          <p className="mt-1 font-heading text-2xl uppercase leading-none">{creditsAvailable} of {creditsTotal}</p>
          <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>{cycleLabel}</p>
        </div>
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>Next charge</p>
          <p className="mt-1 font-heading text-2xl uppercase leading-none">{nextCharge}</p>
          <p className="mt-1 font-body text-[11px]" style={{ color: MUTED }}>{cardLine}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link to="/members/memberships" className="flex min-h-[44px] items-center justify-center rounded-xl font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: TEXT, color: INVERT }}>
          Manage plan
        </Link>
        <Link to="/members/memberships" className="flex min-h-[44px] items-center justify-center rounded-xl font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
          Upgrade
        </Link>
      </div>
      <Link to="/members/memberships" className="mt-3 inline-block font-body text-[11px] underline underline-offset-4" style={{ color: MUTED, textDecorationColor: DIM }}>
        Pause or cancel
      </Link>
    </div>
  );
}

function BalanceCard({ amount, appointmentId, onPaid }) {
  const [state, setState] = useState({ status: 'idle', message: '' });
  const handlePay = async () => {
    if (!appointmentId) {
      setState({ status: 'error', message: 'No payable appointment found.' });
      return;
    }
    setState({ status: 'busy', message: 'Charging your saved card.' });
    try {
      await apiPost('/api/me/pay-balance', { appointmentId });
      setState({ status: 'ok', message: 'Balance paid.' });
      onPaid?.();
    } catch (err) {
      const body = err?.body || {};
      const code = body?.code || '';
      let msg = body?.error || err?.message || 'Could not charge the balance.';
      if (code === 'no_saved_card') msg = 'Add a card first via the billing portal.';
      else if (code === 'requires_action') msg = 'Your bank needs to verify this charge — please try again from a desktop browser, or contact Avalon.';
      else if (code === 'no_balance_due') msg = 'No outstanding balance on this appointment.';
      setState({ status: 'error', message: msg });
    }
  };
  return (
    <div className="rounded-[24px] p-5" style={{ background: 'linear-gradient(160deg, hsl(0 70% 62% / 0.06), hsl(var(--foreground) / 0.045) 60%)', border: `1px solid hsl(0 70% 62% / 0.30)` }}>
      <div className="flex items-center justify-between">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Outstanding balance</p>
        <Link to="/members/billing" className="font-body text-[10px] underline underline-offset-4" style={{ color: MUTED }}>Statements</Link>
      </div>
      <h3 className="mt-3 font-heading text-5xl uppercase leading-none">{money(amount)}</h3>
      <p className="mt-3 font-body text-[12px] leading-snug" style={{ color: MUTED }}>
        Posted after your provider reviewed and discharged you. Pay now or apply credits.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handlePay}
          disabled={state.status === 'busy' || !appointmentId}
          className="flex min-h-[44px] items-center justify-center rounded-xl font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: TEXT, color: INVERT }}
        >
          {state.status === 'busy' ? 'Charging.' : state.status === 'ok' ? 'Paid' : `Pay ${money(amount)} now`}
        </button>
        <button type="button" onClick={() => { /* stub: wire credit redemption */ }} className="flex min-h-[44px] items-center justify-center rounded-xl font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
          Use credits
        </button>
      </div>
      {state.message ? (
        <p
          className="mt-3 font-body text-[12px]"
          style={{ color: state.status === 'error' ? BAD : state.status === 'ok' ? GOOD : MUTED }}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

// Messages preview. There is no lightweight unread API — the Messages page
// reads Supabase conversation tables directly. To avoid fabricating any
// names/previews (PHI + trust), the Dashboard shows a real entry that links to
// the inbox and only surfaces an unread count when one is actually known
// (`unread` is a number) — otherwise it shows a neutral "Open inbox" prompt.
function MessagesCard({ unread = null }) {
  const hasCount = typeof unread === 'number';
  return (
    <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Messages</p>
        {hasCount && unread > 0 ? (
          <span className="font-body text-[10px]" style={{ color: MUTED }}>{unread} unread</span>
        ) : null}
      </div>
      <Link
        to="/members/messages"
        className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3.5"
        style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: 'hsl(var(--foreground) / 0.12)', color: TEXT }}>
          <MessageCircle className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>
            {hasCount && unread > 0 ? `${unread} new message${unread === 1 ? '' : 's'}` : 'Your care team inbox'}
          </p>
          <p className="mt-0.5 font-body text-[11px]" style={{ color: MUTED }}>
            {hasCount && unread > 0 ? 'Tap to read and reply.' : 'Message your RN, scheduling, and clinical follow-ups.'}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: MUTED }} />
      </Link>
    </div>
  );
}

// Documents preview driven by GET /api/me/documents. We only surface the
// pending-signature count + the top pending title (real titles from the API),
// and otherwise reassure "All documents signed". No fabricated doc names.
function DocumentsCard({ docsState }) {
  const { loading, error, documents } = docsState;
  const pending = (documents || []).filter((d) => d.status === 'pending' || d.status === 'outdated');
  const pendingCount = pending.length;
  const topPending = pending[0] || null;

  return (
    <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Documents</p>
        <Link to="/members/documents" className="font-body text-[10px] underline underline-offset-4" style={{ color: MUTED }}>View all</Link>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3.5" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }} aria-busy="true">
          <SkeletonBar className="h-10 w-8 shrink-0 rounded" />
          <div className="min-w-0 flex-1">
            <SkeletonBar className="h-3.5 w-2/3" />
            <SkeletonBar className="mt-2 h-2.5 w-1/2" />
          </div>
        </div>
      ) : error ? (
        <Link to="/members/documents" className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3.5" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
          <span className="grid h-10 w-8 shrink-0 place-items-center rounded" style={{ background: CARD, color: DIM }}>
            <FileText className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>Couldn't load documents</p>
            <p className="mt-0.5 font-body text-[11px]" style={{ color: MUTED }}>Tap to open your documents and try again.</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: MUTED }} />
        </Link>
      ) : pendingCount > 0 ? (
        <Link
          to="/members/documents"
          className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3.5"
          style={{ background: 'hsl(38 70% 60% / 0.08)', border: `1px solid hsl(38 70% 60% / 0.30)` }}
        >
          <span className="grid h-10 w-8 shrink-0 place-items-center rounded" style={{ background: CARD_STRONG, color: WARN }}>
            <FileText className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-[13px] font-semibold" style={{ color: TEXT }}>{topPending?.title || 'Consent document'}</p>
            <p className="mt-0.5 font-body text-[11px]" style={{ color: MUTED }}>
              {pendingCount === 1 ? '1 document needs your signature' : `${pendingCount} documents need your signature`}
            </p>
          </div>
          <span className="shrink-0 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: 'hsl(38 70% 60% / 0.14)', color: WARN, border: `1px solid hsl(38 70% 60% / 0.30)` }}>Sign</span>
        </Link>
      ) : (
        <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3.5" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
          <span className="grid h-10 w-8 shrink-0 place-items-center rounded" style={{ background: CARD, color: GOOD }}>
            <FileText className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>All documents signed</p>
            <p className="mt-0.5 font-body text-[11px]" style={{ color: MUTED }}>Nothing needs your signature right now.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Profile completeness computed from the real profile (see profileCompleteness
// below). `nextField` is the first missing key's friendly label, or null when
// the profile is complete. While loading we show a dash, not a fake number.
function ProfileCompleteness({ percent, nextField, loading }) {
  const shownPercent = loading || percent == null ? null : percent;
  return (
    <div className="rounded-2xl p-3.5 sm:min-w-[260px]" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
        <span>Profile</span>
        <span style={{ color: TEXT }}>{shownPercent == null ? '—' : `${shownPercent}%`}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: CARD_STRONG }}>
        <div className="h-full" style={{ width: `${shownPercent == null ? 0 : shownPercent}%`, background: TEXT }} />
      </div>
      {!loading && nextField ? (
        <Link to="/members/account" className="mt-2 inline-flex items-center gap-1 font-body text-[11px] underline underline-offset-4" style={{ color: TEXT, textDecorationColor: DIM }}>
          Add {nextField} <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      ) : !loading ? (
        <Link to="/members/account" className="mt-2 inline-flex items-center gap-1 font-body text-[11px] underline underline-offset-4" style={{ color: MUTED, textDecorationColor: DIM }}>
          Manage profile <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      ) : null}
    </div>
  );
}

// Compute real profile completeness from GET /api/me/profile fields. Returns
// { percent, nextField } — nextField is the friendly label of the first
// missing key, or null when complete.
const PROFILE_FIELDS = [
  { key: 'fullName', label: 'your name' },
  { key: 'phone', label: 'a phone number' },
  { key: 'dateOfBirth', label: 'date of birth' },
  { key: 'emergencyContact', label: 'emergency contact' },
  { key: 'address', label: 'an address' },
];
function profileCompleteness(profile) {
  if (!profile) return { percent: 0, nextField: PROFILE_FIELDS[0].label };
  const present = (v) => {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  };
  let filled = 0;
  let nextField = null;
  for (const f of PROFILE_FIELDS) {
    if (present(profile[f.key])) filled += 1;
    else if (!nextField) nextField = f.label;
  }
  return { percent: Math.round((filled / PROFILE_FIELDS.length) * 100), nextField };
}

function QuickBookStrip({ creditsRemaining }) {
  return (
    <div className="mt-6 rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-2xl uppercase leading-none">Book another visit</h3>
          <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>
            {creditsRemaining > 0
              ? `You have ${creditsRemaining} credit${creditsRemaining === 1 ? '' : 's'} left this cycle.`
              : 'Pay-as-you-go or activate a plan for credits.'}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Link to="/book" className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.18em] sm:flex-none" style={{ background: TEXT, color: INVERT }}>
            Book a visit
          </Link>
          <Link to="/store" className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.18em] sm:flex-none" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
            Browse add-ons
          </Link>
        </div>
      </div>
    </div>
  );
}

// Prominent "you have N visits to use" banner + Book a visit CTA. When the
// member has 0 credits the CTA routes to /subscription ("Get more visits")
// instead of the booking flow.
function VisitsCreditBanner({ visitsRemaining, loading }) {
  const hasVisits = visitsRemaining > 0;
  const ctaTo = hasVisits ? '/members/book' : '/subscription';
  const ctaLabel = hasVisits ? 'Book a visit' : 'Get more visits';
  return (
    <div
      className="mt-3 overflow-hidden rounded-[24px] p-5"
      style={{ background: 'linear-gradient(160deg, hsl(var(--foreground) / 0.10) 0%, hsl(var(--foreground) / 0.045) 60%)', border: `1px solid ${BORDER}` }}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Visit credits</p>
          {loading ? (
            <SkeletonBar className="mt-2 h-9 w-3/4 md:h-11" />
          ) : (
            <h3 className="mt-1 font-heading text-4xl uppercase leading-none md:text-5xl">
              {`${visitsRemaining} visit${visitsRemaining === 1 ? '' : 's'} remaining`}
            </h3>
          )}
          <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>
            {loading
              ? 'Checking your visit credits…'
              : hasVisits
                ? 'Each credit covers up to $250 of a visit. Book now and use one.'
                : 'No visit credits left — add a plan to bank more visits.'}
          </p>
        </div>
        <Link
          to={ctaTo}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-5 font-body text-[11px] font-bold uppercase tracking-[0.18em] sm:w-auto"
          style={{ background: TEXT, color: INVERT, border: `1px solid ${TEXT}` }}
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}

// Shared dashboard body — expanded portal layout.
function DashboardBody({
  primary,
  balanceLabel,
  balanceTotal,
  planLabel,
  visitsCount,
  recent,
  emptyText,
  onSignOut,
  footer,
  creditsAvailable,
  creditsTotal,
  visitsRemaining,
  creditsLoading,
  balanceAppointmentId,
  onBalancePaid,
  sub,
  subState,
  docsState,
  profileState,
  messagesUnread = null,
  summaryLoading = false,
  visitsError = '',
  onRetryVisits,
}) {
  const visitStatus = primary ? 'Confirming after clinical review' : 'No visit scheduled';
  const profileStats = profileCompleteness(profileState?.profile);
  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center"><AvalonMark className="h-[22px] w-[14px] text-foreground" /></Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Member</p>
          <button
            type="button"
            onClick={onSignOut}
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pt-5 md:px-6 md:pt-7">
        <MemberSectionNav />
      </div>

      <section className="mx-auto max-w-3xl px-4 pt-4 md:px-6">
        {/* Greeting + profile completeness nudge */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Welcome back</p>
            <h1 className="mt-1 font-heading text-4xl uppercase leading-none md:text-5xl">Your portal</h1>
          </div>
          <ProfileCompleteness percent={profileStats.percent} nextField={profileStats.nextField} loading={profileState?.loading} />
        </div>

        {/* Visits load error — non-blocking banner with a retry affordance. */}
        {visitsError ? (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'hsl(0 70% 62% / 0.08)', border: '1px solid hsl(0 70% 62% / 0.30)' }}
            role="alert"
          >
            <p className="font-body text-[12px]" style={{ color: BAD }}>{visitsError}</p>
            {onRetryVisits ? (
              <button
                type="button"
                onClick={onRetryVisits}
                className="inline-flex min-h-[36px] items-center justify-center rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ background: TEXT, color: INVERT }}
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Next visit + summary rail */}
        <div className="overflow-hidden rounded-[30px]" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 md:p-7">
            <div className="min-w-0">
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>
                {primary ? 'Your Next Visit' : 'No Upcoming Visit'}
              </p>
              <h2 className="mt-2 break-words font-heading text-[2.6rem] uppercase leading-[0.9] md:text-5xl">
                {primary ? primary.service : 'Book a visit'}
              </h2>
              <p className="mt-3 font-body text-sm leading-snug" style={{ color: MUTED }}>
                {primary ? primary.when : emptyText}
              </p>
              {primary?.location ? (
                <p className="mt-0.5 font-body text-xs leading-snug" style={{ color: DIM }}>{primary.location}</p>
              ) : null}
            </div>
            <img
              src={primary ? primary.img : '/bags/dehydration.webp'}
              alt={primary ? `${primary.service} IV therapy` : ''}
              loading="lazy"
              className="h-28 w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] md:h-36"
              style={primary ? undefined : { opacity: 0.5 }}
            />
          </div>
          <div className="grid grid-cols-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <StatCol label="Balance" value={balanceLabel} divider loading={summaryLoading} />
            <StatCol label="Plan" value={planLabel} divider loading={summaryLoading} />
            <StatCol label="Visits" value={visitsCount} loading={summaryLoading} />
          </div>
        </div>

        {/* Visit credits — N visits remaining + Book a visit CTA */}
        <VisitsCreditBanner visitsRemaining={visitsRemaining} loading={creditsLoading} />

        {/* Primary actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Action to={visitsRemaining > 0 ? '/members/book' : '/subscription'} icon={Calendar} label="Book" primary />
          <Action to="/members/messages" icon={MessageCircle} label="Message" />
        </div>

        <div className="mt-3 rounded-2xl px-4 py-3.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Visit Status</p>
          <p className="mt-1 font-body text-sm font-semibold leading-snug" style={{ color: MUTED }}>{visitStatus}</p>
        </div>

        {/* Plan + Balance */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <PlanCard sub={sub} subState={subState} creditsAvailable={creditsAvailable} creditsTotal={creditsTotal} />
          {balanceTotal > 0 ? <BalanceCard amount={balanceTotal} appointmentId={balanceAppointmentId} onPaid={onBalancePaid} /> : (
            <div className="rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Account standing</p>
              <h3 className="mt-3 font-heading text-3xl uppercase leading-none md:text-4xl">All clear</h3>
              <p className="mt-3 font-body text-[12px]" style={{ color: MUTED }}>
                No outstanding balance. Plan renews on schedule.
              </p>
              <Link to="/members/billing" className="mt-4 inline-flex items-center gap-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: TEXT }}>
                <CreditCard className="h-3.5 w-3.5" strokeWidth={2} /> View statements
              </Link>
            </div>
          )}
        </div>

        {/* Messages + Documents */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <MessagesCard unread={messagesUnread} />
          <DocumentsCard docsState={docsState} />
        </div>

        {/* Recent visits */}
        <div className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-heading text-3xl uppercase leading-none">Recent</h2>
            <Link to="/members/bookings" className="inline-flex items-center gap-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
              All visits <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
          {recent.length ? (
            <div className="grid gap-2">
              {recent.map((r, i) => <RecentRow key={`${r.service}-${i}`} service={r.service} when={r.when} status={r.status} />)}
            </div>
          ) : (
            <div className="rounded-2xl px-3 py-6 text-center" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <p className="font-body text-sm" style={{ color: MUTED }}>No visits yet. Your booked visits will appear here.</p>
              <Link to="/book" className="mt-3 inline-flex items-center gap-2 font-body text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: TEXT }}>
                Book your first visit <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
          )}
        </div>

        {/* Quick-book strip */}
        <QuickBookStrip creditsRemaining={creditsAvailable} />

        {/* Quick links to portal sections — mirrors section nav as a bottom safety net */}
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Action to="/members/memberships" icon={Crown} label="Plan" />
          <Action to="/members/billing" icon={CreditCard} label="Billing" />
          <Action to="/members/documents" icon={FileText} label="Docs" />
          <Action to="/members/account" icon={UserRound} label="Account" />
        </div>

        {footer}
      </section>

      <MemberBottomNav />
    </main>
  );
}

// Live dashboard — real visits from /api/me/appointments (Supabase mode).
function LiveClientDashboard() {
  const { signOut, registerPasskey } = useAuthStore();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', visits: [] });
  const [credits, setCredits] = useState({ loading: true, balance: 0 });
  const [subState, setSubState] = useState({ loading: true, error: '', sub: null });
  const [docsState, setDocsState] = useState({ loading: true, error: '', documents: [] });
  const [profileState, setProfileState] = useState({ loading: true, error: '', profile: null });
  const [passkeyMsg, setPasskeyMsg] = useState(null);

  const addPasskey = async () => {
    setPasskeyMsg({ tone: 'busy', text: 'Follow your device prompt to add a passkey…' });
    const result = await registerPasskey();
    setPasskeyMsg(result.ok
      ? { tone: 'ok', text: result.message || 'Passkey added — use it to sign in next time.' }
      : { tone: 'err', text: result.error || 'Could not add a passkey.' });
  };

  const refetchVisits = () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    apiGet('/api/me/appointments')
      .then((data) => setState({ loading: false, error: '', visits: Array.isArray(data?.appointments) ? data.appointments : [] }))
      .catch(() => setState((s) => ({ ...s, loading: false, error: 'Could not load your visits.' })));
  };
  useEffect(() => {
    let active = true;
    apiGet('/api/me/appointments')
      .then((data) => { if (active) setState({ loading: false, error: '', visits: Array.isArray(data?.appointments) ? data.appointments : [] }); })
      .catch(() => { if (active) setState({ loading: false, error: 'Could not load your visits.', visits: [] }); });
    apiGet('/api/me/credits')
      .then((data) => { if (active) setCredits({ loading: false, balance: Math.max(0, Number(data?.balance || 0)) }); })
      .catch(() => { if (active) setCredits({ loading: false, balance: 0 }); });
    // Subscription status drives the Plan card. Endpoint may not exist yet
    // (built by a parallel agent) — a 404/failure degrades to "no plan" CTA.
    apiGet('/api/me/subscription/status')
      .then((data) => { if (active) setSubState({ loading: false, error: '', sub: data || null }); })
      .catch(() => { if (active) setSubState({ loading: false, error: 'unavailable', sub: null }); });
    apiGet('/api/me/documents')
      .then((data) => { if (active) setDocsState({ loading: false, error: '', documents: Array.isArray(data?.documents) ? data.documents : [] }); })
      .catch(() => { if (active) setDocsState({ loading: false, error: 'unavailable', documents: [] }); });
    apiGet('/api/me/profile')
      .then((data) => { if (active) setProfileState({ loading: false, error: '', profile: data?.profile || null }); })
      .catch(() => { if (active) setProfileState({ loading: false, error: 'unavailable', profile: null }); });
    return () => { active = false; };
  }, []);

  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };

  const { loading, error: visitsError, visits } = state;
  const now = Date.now();
  const upcoming = visits.filter((v) => v.startsAt && new Date(v.startsAt).getTime() >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const next = upcoming[0] || null;
  const balanceTotal = visits.reduce((sum, v) => sum + (v.balanceDue || 0), 0);
  // Pay-balance is single-appointment: pick the first visit with a balance.
  // Until we surface a per-visit picker, this matches the "Pay $X now" CTA
  // which shows the combined total but charges the oldest open balance.
  const payableAppointment = visits.find((v) => Number(v.balanceDue || 0) > 0) || null;
  const sub = subState.sub;
  // Source of truth for "has a plan" is the subscription status; while it's
  // loading or unavailable we fall back to the appointment-derived membership
  // flag so the summary rail doesn't flap to "no plan" then back.
  const hasPlan = sub?.hasPlan ?? visits.some((v) => v.isMembership);
  // Credits-per-cycle comes from the real plan when known; otherwise we display
  // out of the live balance so we never show a fabricated "/ 4".
  const creditsTotal = sub?.visitsPerCycle ?? (hasPlan ? Math.max(credits.balance, 0) : 0);
  const creditsAvailable = credits.loading ? 0 : Math.min(credits.balance, creditsTotal || credits.balance);

  const primary = next ? {
    service: next.service,
    when: formatWhen(next.startsAt) || 'Time to be confirmed',
    location: next.address || '',
    img: bagForService(next.service),
  } : null;
  const recent = visits.slice(0, 4).map((v) => ({ service: v.service, when: formatWhen(v.startsAt) || 'Date to be confirmed', status: paymentLabel(v.paymentStatus) }));

  const footer = authProviderConfig.passkey ? (
    <div className="mt-4 rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <button
        type="button"
        onClick={addPasskey}
        className="flex min-h-[52px] w-full items-center justify-between rounded-xl px-3 font-body text-[11px] font-bold uppercase tracking-[0.18em]"
        style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
      >
        <span className="flex items-center gap-2.5"><Fingerprint className="h-4 w-4" strokeWidth={1.8} />Add a passkey</span>
        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
      </button>
      {passkeyMsg && (
        <p className="mt-3 font-body text-xs leading-relaxed" style={{ color: passkeyMsg.tone === 'err' ? BAD : passkeyMsg.tone === 'ok' ? ACCENT : MUTED }}>
          {passkeyMsg.text}
        </p>
      )}
    </div>
  ) : null;

  return (
    <DashboardBody
      primary={primary}
      balanceLabel={loading ? '—' : money(balanceTotal)}
      balanceTotal={balanceTotal}
      planLabel={hasPlan ? 'Active' : '—'}
      visitsCount={loading ? '—' : String(visits.length)}
      recent={recent}
      emptyText={loading ? 'Loading your visits…' : 'Book your next visit'}
      onSignOut={handleSignOut}
      footer={footer}
      creditsAvailable={creditsAvailable}
      creditsTotal={creditsTotal || credits.balance || 0}
      visitsRemaining={credits.loading ? 0 : credits.balance}
      creditsLoading={credits.loading}
      balanceAppointmentId={payableAppointment?.id || null}
      onBalancePaid={refetchVisits}
      sub={sub}
      subState={subState}
      docsState={docsState}
      profileState={profileState}
      summaryLoading={loading}
      visitsError={loading ? '' : visitsError}
      onRetryVisits={refetchVisits}
    />
  );
}

function MemberDashboard() {
  useSeo({
    title: 'Client Dashboard - Avalon Vitality',
    description: 'Your Avalon dashboard — next visit, balance, plan, and recent visits at a glance.',
    path: '/members/dashboard',
    robots: 'noindex, nofollow',
  });
  const { authBackend } = useAuthStore();
  return authBackend === 'supabase' ? <LiveClientDashboard /> : <DemoClientDashboard />;
}

export default MemberDashboard;

// Demo dashboard (local/beta simulation, non-Supabase auth only). Reflects only
// the last LOCAL booking the visitor actually made — NO fabricated balances,
// plans, credits, messages, or documents. Production runs on Supabase auth and
// never reaches this path, but we keep it free of fake customer-facing content
// so a stray demo session can't leak invented amounts/names.
function DemoClientDashboard() {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const booking = readLastBooking();
  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };

  const primary = booking ? {
    service: booking.service || 'Hydration IV',
    when: [booking.date, booking.time].filter(Boolean).join(' · ') || 'Ready when you are',
    location: booking.address || 'Home, hotel, office, or event',
    img: bagForService(booking.service),
  } : null;
  const recent = booking
    ? [{ service: booking.service || 'Hydration IV', when: [booking.date, booking.time].filter(Boolean).join(' · ') || 'Recently', status: paymentLabel(booking.paymentStatus) }]
    : [];

  return (
    <DashboardBody
      primary={primary}
      balanceLabel="$0"
      balanceTotal={0}
      planLabel="—"
      visitsCount={String(booking ? 1 : 0)}
      recent={recent}
      emptyText="Book your next visit — we come to you."
      onSignOut={handleSignOut}
      creditsAvailable={0}
      creditsTotal={0}
      visitsRemaining={0}
      creditsLoading={false}
      sub={null}
      subState={{ loading: false, error: '', sub: null }}
      docsState={{ loading: false, error: '', documents: [] }}
      profileState={{ loading: false, error: '', profile: null }}
    />
  );
}
