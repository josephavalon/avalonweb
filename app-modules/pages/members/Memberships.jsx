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

// stub: tier catalog — replace with Stripe-driven product list when ready
const TIERS = [
  {
    id: 'essentials',
    name: 'Essentials',
    price: 95,
    perks: ['1 credit / month', '10% off add-ons', 'Standard scheduling', 'Credits roll over 1 cycle'],
  },
  {
    id: 'vitality',
    name: 'Vitality',
    price: 200,
    perks: ['4 credits / month', '15% off add-ons', 'Priority scheduling', 'Free shipping over $40', 'Annual consult included'],
  },
  {
    id: 'concierge',
    name: 'Concierge',
    price: 425,
    perks: ['10 credits / month', '25% off add-ons + store', 'Same-day priority', 'Dedicated RN', 'Quarterly labs included', 'Unlimited B12 / push add-ons'],
  },
];

// stub: payment methods — replace with Stripe customer.sources / payment_methods
const PAYMENT_METHODS = [
  { id: 'pm_1', brand: 'VISA', last4: '4242', exp: '09 / 2027', label: 'Joseph Marsalis', isDefault: true },
  { id: 'pm_2', brand: 'MC', last4: '8821', exp: '04 / 2028', label: 'backup', isDefault: false },
  { id: 'pm_3', brand: 'HSA', last4: '0317', exp: '11 / 2026', label: 'used for eligible visits only', isDefault: false },
];

// stub: ledger entries that combine plan charges + balance posts + credit grants/redemptions
const BILLING_HISTORY_STUB = [
  { id: 'h1', date: 'JUN 8', label: 'Renewal grant', who: 'Vitality Monthly · 4 credits', delta: '+4', kind: 'credit-plus', balance: 'Bal 4' },
  { id: 'h2', date: 'MAY 12', label: "IV Hydration — Myers' Cocktail", who: 'Jules Ortega, RN · 1 credit redeemed', delta: '−1', kind: 'credit-minus', balance: 'Bal 3' },
  { id: 'h3', date: 'MAY 12', label: 'Visit balance posted', who: '$170 visit · $50 deposit applied · $120 owed', delta: '$120', kind: 'balance-due', balance: 'Open' },
  { id: 'h4', date: 'MAY 8', label: 'Plan charge', who: 'Vitality Monthly · Visa 4242', delta: '$200', kind: 'plan-charge', balance: 'Paid' },
  { id: 'h5', date: 'APR 28', label: 'Wellness Consult', who: 'Dr. Mara Cho, NP · 1 credit redeemed', delta: '−1', kind: 'credit-minus', balance: 'Bal 2' },
  { id: 'h6', date: 'APR 8', label: 'Renewal grant', who: 'Vitality Monthly · 4 credits', delta: '+4', kind: 'credit-plus', balance: 'Bal 4' },
];

// Mix the live ledger from /api/me/credits with the stubbed plan/balance entries.
function buildHistory(liveLedger) {
  const live = (liveLedger || []).map((row) => {
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
  // If we have a real ledger, merge it on top of stub plan/balance posts for richness.
  if (live.length) return [...live, ...BILLING_HISTORY_STUB.filter((r) => r.kind === 'plan-charge' || r.kind === 'balance-due')];
  return BILLING_HISTORY_STUB;
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

function TierCard({ tier, currentId, busy, onSwitch }) {
  const isCurrent = tier.id === currentId;
  return (
    <article className="flex flex-col rounded-[24px] p-5" style={{ background: isCurrent ? CARD_STRONG : CARD, border: `1px solid ${isCurrent ? TEXT : BORDER}` }}>
      <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>{isCurrent ? 'Your plan' : 'Plan'}</p>
      <h3 className="mt-1 font-heading text-3xl uppercase leading-none">{tier.name}</h3>
      <p className="mt-2 font-body text-sm" style={{ color: MUTED }}>
        <span className="font-heading text-2xl uppercase" style={{ color: TEXT }}>${tier.price}</span> / month
      </p>
      <ul className="mt-4 grid gap-2">
        {tier.perks.map((p) => (
          <li key={p} className="flex items-start gap-2 font-body text-[12px]" style={{ color: TEXT }}>
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.2} style={{ color: MUTED }} />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={isCurrent || busy}
        onClick={() => onSwitch?.(tier.id)}
        className="mt-5 flex min-h-[44px] items-center justify-center rounded-xl px-3 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-50"
        style={{
          background: isCurrent ? CARD_STRONG : TEXT,
          color: isCurrent ? MUTED : INVERT,
          border: `1px solid ${isCurrent ? BORDER : TEXT}`,
        }}
      >
        {isCurrent ? 'Your current plan' : busy ? 'Working.' : `Switch to ${tier.name}`}
      </button>
    </article>
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
  const [portalBusy, setPortalBusy] = useState(false);
  const [toast, setToast] = useState(null); // { tone: 'ok' | 'err' | 'busy', text }
  const [preview, setPreview] = useState(null); // { targetPlan, proration, status }
  const [changeBusy, setChangeBusy] = useState(null); // target plan id while previewing/committing
  const [pauseBusy, setPauseBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

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

  const previewSwitch = async (targetPlan) => {
    setChangeBusy(targetPlan);
    setPreview({ targetPlan, status: 'loading', proration: null });
    try {
      const data = await apiPost('/api/me/subscription/change', { targetPlan, action: 'preview' });
      setPreview({ targetPlan, status: 'ready', proration: data?.proration || null });
    } catch (err) {
      const code = err?.body?.code || '';
      if (code === 'no_subscription' || code === 'no_customer') {
        setPreview(null);
        showToast('err', 'You need an active plan first — start one from Book.');
      } else {
        setPreview({ targetPlan, status: 'error', proration: null });
        showToast('err', err?.body?.error || err?.message || 'Could not preview the change.');
      }
    } finally {
      setChangeBusy(null);
    }
  };

  const commitSwitch = async () => {
    if (!preview?.targetPlan) return;
    setChangeBusy(preview.targetPlan);
    try {
      await apiPost('/api/me/subscription/change', { targetPlan: preview.targetPlan, action: 'commit' });
      showToast('ok', 'Plan updated.');
      setPreview(null);
      // Hard reload so derived "current plan" copy reflects the new tier.
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      showToast('err', err?.body?.error || err?.message || 'Could not change the plan.');
    } finally {
      setChangeBusy(null);
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

  const cancelPlan = async () => {
    if (cancelBusy) return;
    if (typeof window !== 'undefined' && !window.confirm("You'll keep your remaining credits until your next renewal date. No fee to cancel. Continue?")) {
      return;
    }
    setCancelBusy(true);
    try {
      const data = await apiPost('/api/me/subscription/cancel', { atPeriodEnd: true });
      const when = data?.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString() : 'your next renewal';
      showToast('ok', `Plan will end on ${when}.`);
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      showToast('err', err?.body?.error || err?.message || 'Could not cancel the plan.');
    } finally {
      setCancelBusy(false);
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

  // stub: derived plan facts — replace with real subscription record
  const currentTierId = 'vitality';
  const currentTier = TIERS.find((t) => t.id === currentTierId);
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
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: 'hsl(140 30% 60% / 0.14)', color: GOOD, border: `1px solid hsl(140 30% 60% / 0.30)` }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOOD }} /> Active · billed monthly
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-heading text-[3rem] uppercase leading-[0.86] md:text-[4.25rem]">{currentTier.name} Monthly</h2>
            <p className="font-body text-sm" style={{ color: MUTED }}>
              <span className="font-heading text-3xl uppercase" style={{ color: TEXT }}>${currentTier.price}</span> / month
            </p>
          </div>
          <ul className="mt-6 grid gap-2.5 md:grid-cols-2">
            <PerkRow><b className="font-semibold">4 visit credits</b> each month (in-home IV, B12, or wellness consult)</PerkRow>
            <PerkRow><b className="font-semibold">15% off</b> all add-ons and store purchases</PerkRow>
            <PerkRow><b className="font-semibold">Priority</b> same-week scheduling</PerkRow>
            <PerkRow><b className="font-semibold">Free shipping</b> on supplement orders over $40</PerkRow>
            <PerkRow><b className="font-semibold">Unused credits</b> roll over up to 2 cycles</PerkRow>
            <PerkRow><b className="font-semibold">Annual</b> wellness consult included</PerkRow>
          </ul>
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
          <h3 className="mt-3 font-heading text-5xl uppercase leading-none">$200.00</h3>
          <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>Jul 8, 2026 · Visa ending 4242</p>
          <div className="mt-4 grid gap-2 font-body text-[12px]">
            <div className="flex items-baseline justify-between gap-3"><span style={{ color: DIM }}>Plan</span><b className="font-semibold" style={{ color: TEXT }}>Vitality Monthly</b></div>
            <div className="flex items-baseline justify-between gap-3"><span style={{ color: DIM }}>Cycle</span><span style={{ color: TEXT }}>Jul 8 — Aug 7</span></div>
            <div className="flex items-baseline justify-between gap-3"><span style={{ color: DIM }}>Outstanding balances</span><b className="font-semibold" style={{ color: BAD }}>+ $120</b></div>
            <div className="flex items-baseline justify-between gap-3"><span style={{ color: DIM }}>Total on Jul 8</span><b className="font-semibold" style={{ color: TEXT }}>$320</b></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={openBillingPortal} disabled={portalBusy} className="rounded-xl px-3.5 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>{portalBusy ? 'Opening.' : 'Manage plan'}</button>
            <button type="button" onClick={openBillingPortal} disabled={portalBusy} className="rounded-xl px-3.5 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>Change card</button>
            <button type="button" onClick={openBillingPortal} disabled={portalBusy} className="rounded-xl px-3.5 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>Change billing date</button>
          </div>
        </div>
      </section>

      {/* Change plan */}
      <section className="mx-auto mt-8 w-full max-w-5xl px-4 md:px-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-3xl uppercase leading-none md:text-4xl">Change your plan</h2>
          <p className="font-body text-[12px]" style={{ color: MUTED }}>Switch any time. Upgrades prorate against your current cycle. Downgrades take effect on Jul 8.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {TIERS.map((t) => (
            <TierCard
              key={t.id}
              tier={t}
              currentId={currentTierId}
              busy={changeBusy === t.id}
              onSwitch={previewSwitch}
            />
          ))}
        </div>

        {/* Proration preview — live from Stripe once a tier is selected */}
        {preview ? (
          <div className="mt-4 rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
              {preview.status === 'loading' ? 'Calculating proration.' :
               preview.status === 'error' ? 'Could not calculate proration' :
               `If you switch to ${(TIERS.find((t) => t.id === preview.targetPlan)?.name) || preview.targetPlan} today`}
            </p>
            {preview.status === 'ready' && preview.proration ? (
              <>
                <div className="mt-3 grid gap-2 font-body text-[13px]">
                  {(preview.proration.items || []).map((line, idx) => (
                    <div key={idx} className="flex items-baseline justify-between gap-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ color: MUTED }}>{line.description || (line.proration ? 'Proration' : 'Line item')}</span>
                      <b className="font-semibold" style={{ color: TEXT }}>
                        {line.amount < 0 ? '− ' : '+ '}${Math.abs(line.amount).toFixed(2)}
                      </b>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3 pt-2">
                    <span className="font-heading text-2xl uppercase" style={{ color: TEXT }}>Charged today</span>
                    <b className="font-heading text-2xl uppercase" style={{ color: TEXT }}>
                      ${Math.max(0, preview.proration.amountDue).toFixed(2)}
                    </b>
                  </div>
                </div>
                <p className="mt-3 font-body text-[12px]" style={{ color: MUTED }}>
                  Then full monthly rate at your next renewal. You can downgrade or cancel any time.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={commitSwitch}
                    disabled={changeBusy === preview.targetPlan}
                    className="rounded-xl px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60"
                    style={{ background: TEXT, color: INVERT }}
                  >
                    {changeBusy === preview.targetPlan ? 'Confirming.' : 'Confirm change'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="rounded-xl px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
                    style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
                  >
                    Keep current plan
                  </button>
                </div>
              </>
            ) : preview.status === 'loading' ? (
              <p className="mt-3 font-body text-sm" style={{ color: MUTED }}>One moment.</p>
            ) : (
              <p className="mt-3 font-body text-sm" style={{ color: BAD }}>Something went wrong. Try again or contact Avalon.</p>
            )}
          </div>
        ) : null}
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
            {PAYMENT_METHODS.map((pm, idx) => (
              <div
                key={pm.id}
                className="flex flex-wrap items-center gap-3 py-3.5"
                style={{ borderTop: idx === 0 ? 'none' : `1px solid ${BORDER}` }}
              >
                <span className="grid h-8 w-12 shrink-0 place-items-center rounded font-heading text-[11px] uppercase tracking-[0.12em]" style={{ background: CARD_STRONG, color: MUTED, border: `1px solid ${BORDER}` }}>
                  {pm.brand}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>{pm.brand === 'HSA' ? 'HSA' : pm.brand === 'MC' ? 'Mastercard' : 'Visa'} ending {pm.last4}</p>
                  <p className="mt-0.5 font-body text-[11px]" style={{ color: MUTED }}>Expires {pm.exp} · {pm.label}</p>
                </div>
                {pm.isDefault ? (
                  <span className="rounded-full px-2.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: CARD_STRONG, color: MUTED, border: `1px solid ${BORDER}` }}>
                    Default
                  </span>
                ) : (
                  <button type="button" className="font-body text-[11px] underline underline-offset-4" style={{ color: MUTED }}>Make default</button>
                )}
                <button type="button" className="font-body text-[11px] underline underline-offset-4" style={{ color: MUTED }}>Edit</button>
                {!pm.isDefault ? (
                  <button type="button" className="font-body text-[11px] underline underline-offset-4" style={{ color: BAD }}>Remove</button>
                ) : null}
              </div>
            ))}
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
            <button type="button" onClick={cancelPlan} disabled={cancelBusy} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-60" style={{ background: 'transparent', color: BAD, border: `1px solid hsl(0 70% 62% / 0.40)` }}>
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
