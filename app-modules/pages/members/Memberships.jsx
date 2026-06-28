import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  ArrowRight,
  Check,
  CreditCard,
  LogOut,
  PauseCircle,
  Plus,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSeo } from '@/lib/seo';
import { useAuthStore } from '@/lib/useAuthStore';
import { applyTheme } from '@/lib/theme';
import { apiGet, apiPost } from '@/lib/apiClient';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const GOOD = 'hsl(140 30% 60%)';
const BAD = 'hsl(0 70% 62%)';

function sourceLabel(source = '') {
  if (source === 'membership_initial_grant') return 'Initial grant';
  if (source === 'membership_renewal_grant') return 'Renewal grant';
  if (source === 'iv_credit_redemption') return 'IV credit redeemed';
  if (source === 'admin_adjustment') return 'Adjustment';
  return source.replace(/_/g, ' ') || 'Credit activity';
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
}

// Real credit/billing history, built entirely from the live /api/me/credits
// ledger (grants + redemptions). No stub rows — an empty ledger renders the
// empty state below.
function buildHistory(liveLedger) {
  return (liveLedger || []).map((row) => {
    const units = Number(row.units || 0);
    return {
      id: row.id,
      date: formatShortDate(row.createdAt),
      label: sourceLabel(row.source),
      who: '',
      delta: `${units > 0 ? '+' : ''}${units}`,
      kind: units > 0 ? 'credit-plus' : 'credit-minus',
      balance: '',
    };
  });
}

// --- Pieces ---------------------------------------------------------------

function CreditsRing({ used = 2, total = 4 }) {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? remaining / total : 0;
  const turn = pct * 360;
  return (
    <div
      className="relative grid h-40 w-40 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${TEXT} 0deg, ${TEXT} ${turn}deg, ${CARD_STRONG} ${turn}deg, ${CARD_STRONG} 360deg)`,
      }}
    >
      <div className="grid h-32 w-32 place-items-center rounded-full text-center" style={{ background: BG, border: `1px solid ${BORDER}` }}>
        <div>
          <p className="font-heading text-5xl uppercase leading-none">{remaining}</p>
          <p className="mt-1 font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>of {total}</p>
        </div>
      </div>
    </div>
  );
}

function PerkRow({ children }) {
  return (
    <li className="flex items-start gap-2.5 font-body text-[13px]" style={{ color: TEXT }}>
      <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} style={{ color: MUTED }} />
      <span>{children}</span>
    </li>
  );
}

// --- Page -----------------------------------------------------------------

export default function Memberships() {
  useSeo({
    title: 'Memberships - Avalon Vitality',
    description: 'Your Avalon membership — credits, billing, plan changes, and history.',
    path: '/members/memberships',
    robots: 'noindex, nofollow',
  });
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', balance: 0, ledger: [] });
  // Real subscription record from Stripe (replaces the hardcoded plan stubs).
  // { loading, plan } where plan is the /api/me/subscription/status payload or
  // { hasPlan:false }.
  const [planState, setPlanState] = useState({ loading: true, plan: null });
  const [portalBusy, setPortalBusy] = useState(false);
  const [toast, setToast] = useState(null); // { tone: 'ok' | 'err' | 'busy', text }
  const [pauseBusy, setPauseBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  // Cancel reason picker (optional — cancel still works with no reason).
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonText, setCancelReasonText] = useState('');
  // Inline plan-change confirm: preview the proration → show the plain-English
  // explanation → commit. Keeps the builder ("/subscription?change=1") intact
  // as the full editor; this is the quick tier-switch path.
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeTarget, setChangeTarget] = useState(''); // tier id
  const [changePreview, setChangePreview] = useState({ loading: false, error: '', explanation: '', amountDue: null });
  const [changeBusy, setChangeBusy] = useState(false);

  const showToast = (tone, text) => {
    setToast({ tone, text });
    if (tone !== 'busy') {
      setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 6000);
    }
  };

  const openBillingPortal = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    showToast('busy', 'Opening secure billing portal.');
    try {
      const data = await apiPost('/api/me/billing-portal');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setPortalBusy(false);
        showToast('err', 'Could not open the billing portal.');
      }
    } catch (err) {
      setPortalBusy(false);
      const code = err?.body?.code || '';
      if (code === 'no_customer') {
        showToast('err', 'Make your first purchase to enable the billing portal.');
      } else {
        showToast('err', err?.body?.error || err?.message || 'Could not open the billing portal.');
      }
    }
  };

  const pauseOneCycle = async () => {
    if (pauseBusy) return;
    setPauseBusy(true);
    try {
      const data = await apiPost('/api/me/subscription/pause', { cycles: 1 });
      const when = data?.resumesAt ? new Date(data.resumesAt).toLocaleDateString() : 'one cycle from today';
      showToast('ok', `Paused — resumes ${when}.`);
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      showToast('err', err?.body?.error || err?.message || 'Could not pause the plan.');
    } finally {
      setPauseBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (cancelBusy) return;
    setCancelBusy(true);
    try {
      // Reason is OPTIONAL. Send the safe category enum + (for "other") the
      // free-text detail; the API keeps free text out of Stripe.
      const payload = { atPeriodEnd: true };
      if (cancelReason) payload.reason = cancelReason;
      if (cancelReason === 'other' && cancelReasonText.trim()) payload.reasonText = cancelReasonText.trim();
      const data = await apiPost('/api/me/subscription/cancel', payload);
      const when = data?.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString() : 'your next renewal';
      showToast('ok', `Plan will end on ${when}.`);
      setCancelOpen(false);
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      showToast('err', err?.body?.error || err?.message || 'Could not cancel the plan.');
    } finally {
      setCancelBusy(false);
    }
  };

  // Quick tier change: preview proration (shows plain-English explanation),
  // then commit on confirm.
  const openChange = async (tierId) => {
    setChangeTarget(tierId);
    setChangeOpen(true);
    setChangePreview({ loading: true, error: '', explanation: '', amountDue: null });
    try {
      const data = await apiPost('/api/me/subscription/change', { targetPlan: tierId, action: 'preview' });
      setChangePreview({
        loading: false,
        error: '',
        explanation: data?.explanation || '',
        amountDue: data?.proration?.amountDue ?? null,
      });
    } catch (err) {
      setChangePreview({
        loading: false,
        error: err?.body?.error || err?.message || 'Could not preview the plan change.',
        explanation: '',
        amountDue: null,
      });
    }
  };

  const confirmChange = async () => {
    if (changeBusy || !changeTarget) return;
    setChangeBusy(true);
    try {
      await apiPost('/api/me/subscription/change', { targetPlan: changeTarget, action: 'commit' });
      showToast('ok', 'Plan updated.');
      setChangeOpen(false);
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      showToast('err', err?.body?.error || err?.message || 'Could not change the plan.');
    } finally {
      setChangeBusy(false);
    }
  };

  useEffect(() => { try { applyTheme(); } catch { /* noop */ } }, []);
  useEffect(() => {
    let active = true;
    apiGet('/api/me/credits')
      .then((data) => {
        if (!active) return;
        setState({
          loading: false,
          error: '',
          balance: Math.max(0, Number(data?.balance || 0)),
          ledger: Array.isArray(data?.ledger) ? data.ledger : [],
        });
      })
      .catch(() => {
        if (!active) return;
        setState({ loading: false, error: 'Could not load membership credits.', balance: 0, ledger: [] });
      });
    return () => { active = false; };
  }, []);

  // Real current plan from Stripe. A clean { hasPlan:false } (or any error)
  // simply leaves the plan unset; the UI falls back to an empty state.
  useEffect(() => {
    let active = true;
    apiGet('/api/me/subscription/status')
      .then((data) => {
        if (!active) return;
        setPlanState({ loading: false, plan: data || { hasPlan: false } });
      })
      .catch(() => {
        if (!active) return;
        setPlanState({ loading: false, plan: { hasPlan: false } });
      });
    return () => { active = false; };
  }, []);

  // Real derived plan facts from /api/me/subscription/status.
  const plan = planState.plan;
  const hasPlan = Boolean(plan?.hasPlan);
  const planLoading = planState.loading;
  const billingLabel = (b) => ({
    monthly: 'Monthly', 'three-month': 'Every 3 months', 'six-month': 'Every 6 months', annual: 'Annual',
  }[b] || 'Monthly');
  const billingShort = (b) => ({
    monthly: 'monthly', 'three-month': 'every 3 mo', 'six-month': 'every 6 mo', annual: 'annual',
  }[b] || 'monthly');
  const planName = hasPlan ? (plan.name || 'Your plan') : '—';
  const planPriceDollars = hasPlan ? Number(plan.priceDollars || 0) : 0;
  const planVisitsPerCycle = hasPlan ? Math.max(1, Number(plan.visitsPerCycle || 1)) : 0;
  const nextChargeDate = hasPlan && plan.nextChargeIso ? formatDate(plan.nextChargeIso) : '';
  const nextChargeAmount = hasPlan ? Number(plan.nextChargeAmountDollars ?? plan.priceDollars ?? 0) : 0;
  const card = hasPlan ? plan.defaultPaymentMethod : null;
  const cardBrandLabel = card?.brand
    ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
    : '';
  const cardLine = card?.last4 ? `${cardBrandLabel} ending ${card.last4}` : 'No card on file';
  const cancelAtPeriodEnd = Boolean(hasPlan && plan.cancelAtPeriodEnd);
  const fmtMoney = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Credits remaining is the real ledger balance from /api/me/credits (1 credit
  // = one $250 visit). The ring's "total" is the larger of the plan grant (4)
  // and the live balance, so rolled-over/banked credits never clip the display.
  const creditsRemaining = state.loading ? 0 : state.balance;
  const creditsTotal = Math.max(4, creditsRemaining);
  const creditsUsed = Math.max(0, creditsTotal - creditsRemaining);
  const history = buildHistory(state.ledger);
  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };

  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center"><AvalonMark className="h-[22px] w-[14px] text-foreground" /></Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Member · Plan</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pt-5 md:px-6 md:pt-7">
        <MemberSectionNav />
      </div>

      <section className="mx-auto w-full max-w-5xl px-4 pt-6 md:px-6">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Members · Plan &amp; Billing</p>
        <h1 className="mt-1 font-heading text-5xl uppercase leading-none md:text-6xl">Your plan</h1>
        <p className="mt-3 max-w-2xl font-body text-sm" style={{ color: MUTED }}>
          Manage your membership, change tiers, see what you've used, and update how you pay. Changes prorate from today.
        </p>
        {state.error && (
          <p className="mt-4 rounded-2xl px-4 py-3 font-body text-sm" style={{ background: 'hsl(0 70% 62% / 0.10)', color: BAD, border: `1px solid hsl(0 70% 62% / 0.30)` }}>
            {state.error}
          </p>
        )}
      </section>

      {/* Hero: current plan */}
      <section className="mx-auto mt-6 w-full max-w-5xl px-4 md:px-6">
        <div className="rounded-[28px] p-6 md:p-8" style={{ background: 'linear-gradient(160deg, hsl(var(--foreground) / 0.075) 0%, hsl(var(--foreground) / 0.045) 60%)', border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Current Plan</p>
            {hasPlan ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: 'hsl(140 30% 60% / 0.14)', color: GOOD, border: `1px solid hsl(140 30% 60% / 0.30)` }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOOD }} /> {cancelAtPeriodEnd ? 'Ending soon' : `${plan.status === 'trialing' ? 'Trial' : 'Active'} · billed ${billingShort(plan.billing)}`}
              </span>
            ) : null}
          </div>
          {planLoading ? (
            <p className="mt-6 font-body text-sm" style={{ color: MUTED }}>Loading your plan.</p>
          ) : hasPlan ? (
            <>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="font-heading text-[3rem] uppercase leading-[0.86] md:text-[4.25rem]">{planName}</h2>
                <p className="font-body text-sm" style={{ color: MUTED }}>
                  <span className="font-heading text-3xl uppercase" style={{ color: TEXT }}>{fmtMoney(planPriceDollars)}</span> / {billingShort(plan.billing)}
                </p>
              </div>
              <ul className="mt-6 grid gap-2.5 md:grid-cols-2">
                <PerkRow><b className="font-semibold">{planVisitsPerCycle} visit {planVisitsPerCycle === 1 ? 'credit' : 'credits'}</b> each cycle (in-home IV, B12, or wellness consult)</PerkRow>
                <PerkRow>Each visit covers any service up to <b className="font-semibold">$250</b> — pay only the difference</PerkRow>
                <PerkRow><b className="font-semibold">Priority</b> same-week scheduling</PerkRow>
                <PerkRow><b className="font-semibold">{billingLabel(plan.billing)}</b> billing</PerkRow>
                <PerkRow><b className="font-semibold">Clinical review</b> included once a year</PerkRow>
                <PerkRow><b className="font-semibold">Cancel or change</b> any time</PerkRow>
              </ul>
            </>
          ) : (
            <div className="mt-4">
              <h2 className="font-heading text-[2.5rem] uppercase leading-[0.86] md:text-[3.25rem]">No active plan</h2>
              <p className="mt-3 max-w-xl font-body text-sm" style={{ color: MUTED }}>
                You don't have a membership yet. Build a plan to get monthly visit credits and member pricing.
              </p>
              <button
                type="button"
                onClick={() => navigate('/subscription')}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ background: TEXT, color: INVERT }}
              >
                Build a plan <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Credits + Next charge */}
      <section className="mx-auto mt-4 w-full max-w-5xl grid gap-4 px-4 md:grid-cols-[7fr_5fr] md:px-6">
        <div className="rounded-[24px] p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Credits this cycle</p>
            <a href="#ledger" className="font-body text-[10px] underline underline-offset-4" style={{ color: MUTED }}>See full ledger</a>
          </div>
          <div className="mt-5 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <CreditsRing used={creditsUsed} total={creditsTotal} />
            <div className="flex-1 grid gap-2.5 font-body text-[13px]">
              <div className="flex items-baseline justify-between gap-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ color: DIM }}>Used</span>
                <span style={{ color: TEXT }} className="text-right">{creditsUsed} credits — May 12, Apr 28</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 pt-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ color: DIM }}>Remaining</span>
                <span style={{ color: TEXT }} className="text-right">{creditsRemaining} credits — expire Jul 8</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 pt-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ color: DIM }}>Rollover</span>
                <span style={{ color: TEXT }} className="text-right">0 credits carried in</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 pt-2">
                <span style={{ color: DIM }}>Renews</span>
                <span style={{ color: TEXT }} className="text-right">Jul 8 with 4 fresh credits</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Next charge</p>
          {planLoading ? (
            <p className="mt-3 font-body text-sm" style={{ color: MUTED }}>Loading.</p>
          ) : hasPlan ? (
            <>
              <h3 className="mt-3 font-heading text-5xl uppercase leading-none">{cancelAtPeriodEnd ? '—' : fmtMoney(nextChargeAmount)}</h3>
              <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>
                {cancelAtPeriodEnd
                  ? `Plan ends ${nextChargeDate || 'at period end'}`
                  : `${nextChargeDate || 'Next renewal'} · ${cardLine}`}
              </p>
              <div className="mt-4 grid gap-2 font-body text-[12px]">
                <div className="flex items-baseline justify-between gap-3"><span style={{ color: DIM }}>Plan</span><b className="font-semibold" style={{ color: TEXT }}>{planName}</b></div>
                <div className="flex items-baseline justify-between gap-3"><span style={{ color: DIM }}>Billing</span><span style={{ color: TEXT }}>{billingLabel(plan.billing)}</span></div>
                <div className="flex items-baseline justify-between gap-3"><span style={{ color: DIM }}>Visits / cycle</span><span style={{ color: TEXT }}>{planVisitsPerCycle}</span></div>
                <div className="flex items-baseline justify-between gap-3"><span style={{ color: DIM }}>Payment</span><span style={{ color: TEXT }}>{cardLine}</span></div>
              </div>
            </>
          ) : (
            <p className="mt-3 font-body text-sm" style={{ color: MUTED }}>No upcoming charge — you don't have an active plan.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={openBillingPortal} disabled={portalBusy} className="rounded-xl px-3.5 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>{portalBusy ? 'Opening.' : 'Manage plan'}</button>
            <button type="button" onClick={openBillingPortal} disabled={portalBusy} className="rounded-xl px-3.5 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>Change card</button>
          </div>
        </div>
      </section>

      {/* Change plan — re-open the builder in change mode (proration handled there) */}
      <section className="mx-auto mt-8 w-full max-w-5xl px-4 md:px-6">
        <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-heading text-3xl uppercase leading-none md:text-4xl">Change your plan</h2>
              <p className="mt-2 max-w-xl font-body text-[12px]" style={{ color: MUTED }}>
                Adjust visits per cycle, therapy, add-ons, or your billing term. We'll show you exactly what's charged today before anything changes. Changes prorate from today.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/subscription?change=1')}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ background: TEXT, color: INVERT }}
            >
              {hasPlan ? 'Customize plan' : 'Build a plan'} <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          {hasPlan ? (
            <div className="mt-5" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '1.25rem' }}>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Quick switch to a tier</p>
              <p className="mt-1 font-body text-[12px]" style={{ color: MUTED }}>We'll show you exactly what's charged today before anything changes.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { id: 'essentials', label: 'Essentials' },
                  { id: 'vitality', label: 'Vitality' },
                  { id: 'concierge', label: 'Concierge' },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => openChange(tier.id)}
                    className="rounded-xl px-3.5 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
                    style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Payment methods */}
      <section className="mx-auto mt-8 w-full max-w-5xl px-4 md:px-6">
        <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl uppercase leading-none">Payment methods</h2>
            <button type="button" onClick={openBillingPortal} disabled={portalBusy} className="inline-flex items-center gap-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em] disabled:opacity-60" style={{ color: TEXT }}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Add card
            </button>
          </div>
          <div className="mt-3">
            {planLoading ? (
              <p className="py-4 font-body text-sm" style={{ color: MUTED }}>Loading.</p>
            ) : card?.last4 ? (
              <div className="flex flex-wrap items-center gap-3 py-3.5">
                <span className="grid h-8 w-12 shrink-0 place-items-center rounded font-heading text-[11px] uppercase tracking-[0.12em]" style={{ background: CARD_STRONG, color: MUTED, border: `1px solid ${BORDER}` }}>
                  {cardBrandLabel.slice(0, 4)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>{cardBrandLabel} ending {card.last4}</p>
                  <p className="mt-0.5 font-body text-[11px]" style={{ color: MUTED }}>Default payment method</p>
                </div>
                <span className="rounded-full px-2.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: CARD_STRONG, color: MUTED, border: `1px solid ${BORDER}` }}>
                  Default
                </span>
                <button type="button" onClick={openBillingPortal} disabled={portalBusy} className="font-body text-[11px] underline underline-offset-4 disabled:opacity-60" style={{ color: MUTED }}>Manage</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <p className="font-body text-[13px]" style={{ color: MUTED }}>No card on file.</p>
                <button type="button" onClick={openBillingPortal} disabled={portalBusy} className="font-body text-[11px] underline underline-offset-4 disabled:opacity-60" style={{ color: TEXT }}>Add a card</button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Ledger */}
      <section id="ledger" className="mx-auto mt-4 w-full max-w-5xl px-4 md:px-6">
        <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl uppercase leading-none">Credit & billing history</h2>
            <span className="inline-flex items-center gap-1.5 font-body text-[11px]" style={{ color: MUTED }}>
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} /> Download CSV
            </span>
          </div>
          <div className="mt-3">
            {history.length ? history.map((row, i) => (
              <div
                key={row.id || i}
                className="grid grid-cols-[64px_minmax(0,1fr)_auto_auto] items-center gap-3 py-3 font-body text-[13px] sm:grid-cols-[72px_minmax(0,1fr)_auto_auto]"
                style={{ borderTop: i === 0 ? 'none' : `1px solid ${BORDER}` }}
              >
                <span className="font-heading text-[14px] uppercase tracking-[0.06em]" style={{ color: MUTED }}>{row.date}</span>
                <div className="min-w-0">
                  <p className="truncate font-body text-[13px]" style={{ color: TEXT }}>{row.label}</p>
                  {row.who ? <p className="mt-0.5 truncate font-body text-[11px]" style={{ color: DIM }}>{row.who}</p> : null}
                </div>
                <span
                  className="shrink-0 font-heading text-base uppercase"
                  style={{
                    color:
                      row.kind === 'credit-plus' ? GOOD :
                      row.kind === 'balance-due' ? BAD :
                      MUTED,
                  }}
                >
                  {row.delta}
                </span>
                <span className="shrink-0 font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: DIM }}>
                  {row.balance}
                </span>
              </div>
            )) : (
              <p className="py-6 text-center font-body text-sm" style={{ color: MUTED }}>
                {state.loading ? 'Loading credit activity.' : 'No credit activity yet.'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section className="mx-auto mt-6 w-full max-w-5xl px-4 md:px-6">
        <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid hsl(0 70% 62% / 0.25)` }}>
          <h2 className="font-heading text-xl uppercase leading-none" style={{ color: BAD }}>Pause or cancel</h2>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: `1px solid hsl(0 70% 62% / 0.15)`, paddingTop: '1rem' }}>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>Pause your plan</p>
              <p className="mt-1 font-body text-[12px]" style={{ color: MUTED }}>Skip 1 or 2 cycles. Your unused credits are held and your next charge is deferred. You can resume any time.</p>
            </div>
            <button type="button" onClick={pauseOneCycle} disabled={pauseBusy} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
              <PauseCircle className="h-3.5 w-3.5" strokeWidth={1.8} /> {pauseBusy ? 'Pausing.' : 'Pause for 1 cycle'}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: `1px solid hsl(0 70% 62% / 0.15)`, paddingTop: '1rem' }}>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>Cancel membership</p>
              <p className="mt-1 font-body text-[12px]" style={{ color: MUTED }}>You keep your remaining credits until Jul 8. After that, your plan ends and you'll return to per-visit pricing. No fee to cancel.</p>
            </div>
            <button type="button" onClick={() => { setCancelReason(''); setCancelReasonText(''); setCancelOpen(true); }} disabled={cancelBusy} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60" style={{ background: 'transparent', color: BAD, border: `1px solid hsl(0 70% 62% / 0.40)` }}>
              <XCircle className="h-3.5 w-3.5" strokeWidth={1.8} /> {cancelBusy ? 'Cancelling.' : 'Cancel plan'}
            </button>
          </div>
        </div>
      </section>

      {/* Quick link back to billing */}
      <section className="mx-auto mt-6 w-full max-w-5xl px-4 md:px-6">
        <Link to="/members/billing" className="inline-flex items-center gap-2 font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: TEXT }}>
          <CreditCard className="h-3.5 w-3.5" strokeWidth={1.8} /> Billing & statements <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </Link>
      </section>

      {/* Cancel reason picker — optional; cancel works with nothing selected */}
      {cancelOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: 'hsl(var(--background) / 0.72)', backdropFilter: 'blur(8px)' }} role="dialog" aria-modal="true" aria-label="Cancel membership">
          <div className="w-full max-w-md rounded-[24px] p-6" style={{ background: BG, border: `1px solid hsl(0 70% 62% / 0.30)`, boxShadow: '0 24px 60px hsl(0 0% 0% / 0.45)' }}>
            <h2 className="font-heading text-3xl uppercase leading-none" style={{ color: BAD }}>Cancel membership</h2>
            <p className="mt-3 font-body text-[13px]" style={{ color: MUTED }}>
              You'll keep your remaining credits until your next renewal date. No fee to cancel.
            </p>
            <p className="mt-5 font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>Why are you leaving? <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span></p>
            <div className="mt-2 grid gap-2">
              {[
                { id: 'too_expensive', label: 'Too expensive' },
                { id: 'not_using', label: 'Not using it' },
                { id: 'switching', label: 'Switching providers' },
                { id: 'other', label: 'Other' },
              ].map((opt) => {
                const selected = cancelReason === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCancelReason(selected ? '' : opt.id)}
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left font-body text-[13px]"
                    style={{
                      background: selected ? CARD_STRONG : CARD,
                      color: TEXT,
                      border: `1px solid ${selected ? 'hsl(0 70% 62% / 0.40)' : BORDER}`,
                    }}
                  >
                    <span>{opt.label}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: BAD }} /> : null}
                  </button>
                );
              })}
            </div>
            {cancelReason === 'other' ? (
              <textarea
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Tell us more (optional)"
                className="mt-2 w-full rounded-xl px-4 py-3 font-body text-[13px] outline-none"
                style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
              />
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                disabled={cancelBusy}
                className="rounded-xl px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60"
                style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
              >
                Keep my plan
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={cancelBusy}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60"
                style={{ background: 'transparent', color: BAD, border: `1px solid hsl(0 70% 62% / 0.40)` }}
              >
                <XCircle className="h-3.5 w-3.5" strokeWidth={1.8} /> {cancelBusy ? 'Cancelling.' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Change-confirm: plain-English proration before committing */}
      {changeOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: 'hsl(var(--background) / 0.72)', backdropFilter: 'blur(8px)' }} role="dialog" aria-modal="true" aria-label="Confirm plan change">
          <div className="w-full max-w-md rounded-[24px] p-6" style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: '0 24px 60px hsl(0 0% 0% / 0.45)' }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Confirm change</p>
            <h2 className="mt-1 font-heading text-3xl uppercase leading-none">Switch to {changeTarget}</h2>
            <div className="mt-4 rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {changePreview.loading ? (
                <p className="font-body text-[13px]" style={{ color: MUTED }}>Calculating your charge.</p>
              ) : changePreview.error ? (
                <p className="font-body text-[13px]" style={{ color: BAD }}>{changePreview.error}</p>
              ) : (
                <p className="font-body text-[14px] leading-relaxed" style={{ color: TEXT }}>
                  {changePreview.explanation || 'Your plan change is ready to confirm.'}
                </p>
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setChangeOpen(false)}
                disabled={changeBusy}
                className="rounded-xl px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60"
                style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={confirmChange}
                disabled={changeBusy || changePreview.loading || !!changePreview.error}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60"
                style={{ background: TEXT, color: INVERT }}
              >
                {changeBusy ? 'Updating.' : 'Confirm change'} <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-md px-4"
          role="status"
          aria-live="polite"
        >
          <div
            className="rounded-2xl px-4 py-3 font-body text-sm shadow-lg"
            style={{
              background: toast.tone === 'err' ? 'hsl(0 70% 62% / 0.16)' : toast.tone === 'ok' ? 'hsl(140 30% 60% / 0.16)' : CARD_STRONG,
              color: toast.tone === 'err' ? BAD : toast.tone === 'ok' ? GOOD : TEXT,
              border: `1px solid ${toast.tone === 'err' ? 'hsl(0 70% 62% / 0.40)' : toast.tone === 'ok' ? 'hsl(140 30% 60% / 0.40)' : BORDER}`,
            }}
          >
            {toast.text}
          </div>
        </div>
      ) : null}

      <MemberBottomNav />
    </main>
  );
}
