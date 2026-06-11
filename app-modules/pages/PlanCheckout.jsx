import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, CalendarClock, Loader2 } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import { useSeo } from '@/lib/seo';

// Dedicated membership checkout — intentionally separate from the one-time
// 5-step /book flow. The customer picks one recurring day/time (their standing
// monthly visit), enters contact + address, and pays via the proven
// create-checkout-session backend (subscription mode → membership Acuity type).
const TZ = 'America/Los_Angeles';
const money = (v) => `$${Math.round(Number(v || 0)).toLocaleString()}`;

const TERMS = {
  monthly: { label: 'Monthly', months: 1, discount: 0, billing: 'monthly' },
  'three-month': { label: '3 months', months: 3, discount: 0.05, billing: 'three-month' },
  'six-month': { label: '6 months', months: 6, discount: 0.08, billing: 'six-month' },
  annual: { label: '12 months', months: 12, discount: 0.15, billing: 'annual' },
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function upcomingDates(count) {
  const out = [];
  const now = new Date();
  for (let i = 1; i <= count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ iso, weekday: WEEKDAY[d.getDay()], label: `${MONTH[d.getMonth()]} ${d.getDate()}` });
  }
  return out;
}

function formatSlotLabel(iso) {
  // iso is offset-aware, e.g. 2026-06-17T08:00:00-0700
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.12em] text-foreground/56">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-foreground/16 bg-background/50 px-3.5 py-3 font-body text-sm font-semibold text-foreground placeholder:text-foreground/35 focus:border-foreground/45 focus:outline-none';

export default function PlanCheckout() {
  useSeo({ title: 'Start your plan - Avalon Vitality', description: 'Schedule your recurring membership visit and start your Avalon IV therapy plan.', path: '/plan' });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const monthly = Math.max(0, Number(searchParams.get('price')) || 0);
  const termKey = searchParams.get('term') || 'monthly';
  const term = TERMS[termKey] || TERMS.monthly;
  const protocol = searchParams.get('protocol') || 'recovery';
  const sessions = Math.max(1, Number(searchParams.get('sessions')) || 1);

  // Per-period charge: monthly × term months × (1 − discount). Monthly = monthly.
  const perPeriodTotal = Math.round(monthly * term.months * (1 - term.discount));

  const dates = useMemo(() => upcomingDates(14), []);
  const [date, setDate] = useState(dates[0]?.iso || '');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [slot, setSlot] = useState(null); // offset-aware ISO

  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [address, setAddress] = useState({ line1: '', zip: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // No plan price → bounce back to the builder.
  useEffect(() => {
    if (!monthly) navigate('/subscription', { replace: true });
  }, [monthly, navigate]);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError('');
    setSlot(null);
    (async () => {
      try {
        const params = new URLSearchParams({ date, timezone: TZ });
        const res = await fetch(`/api/scheduling-availability?${params}`);
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('Availability is temporarily unavailable.');
        const data = await res.json();
        if (cancelled) return;
        const times = Array.isArray(data) ? data.map((s) => s.time).filter(Boolean) : [];
        setSlots(times);
        if (!times.length) setSlotsError('No times open that day — try another date.');
      } catch (err) {
        if (!cancelled) { setSlots([]); setSlotsError(err.message || 'Could not load times.'); }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date]);

  const canSubmit = slot && contact.firstName.trim() && contact.email.trim() && address.line1.trim() && address.zip.trim() && !submitting;

  const startMembership = async () => {
    if (!canSubmit) {
      setError('Pick a time and fill in your contact + address.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          checkoutUiMode: 'hosted',
          membership: { name: 'custom', price: perPeriodTotal, billing: term.billing },
          contact: {
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            email: contact.email.trim(),
            phone: contact.phone.trim(),
          },
          appointment: {
            acuityDatetime: slot, // offset-aware ISO from availability — no tz ambiguity
            acuityTimezone: TZ,
            timeLabel: formatSlotLabel(slot),
            address: address.line1.trim(),
            zip: address.zip.trim(),
            protocol,
            recurring: true,
            recurringTerm: term.billing,
          },
          items: [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Could not start checkout.');
      window.location.href = data.url; // Stripe hosted checkout (or pre-API preview url)
    } catch (err) {
      setError(err.message || 'Something went wrong starting your plan.');
      setSubmitting(false);
    }
  };

  const dueToday = perPeriodTotal;
  const renews = term.billing === 'monthly' ? 'every month' : `every ${term.label.toLowerCase()}`;

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header><Navbar /></header>
      <main className="mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[5.25rem] md:pt-28">
        <button
          type="button"
          onClick={() => navigate('/subscription')}
          className="mb-3 inline-flex items-center gap-1.5 self-start font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/55 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to plan
        </button>

        <div className="mb-4 md:mb-6">
          <h1 className="font-heading text-[2.4rem] uppercase leading-[0.88] tracking-normal text-foreground md:text-[3rem]">Start your plan</h1>
          <p className="mt-1.5 font-body text-sm font-semibold text-foreground/56">
            Pick the day &amp; time for your recurring visit — it repeats {renews} at the same time. Change it anytime with our team.
          </p>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="av-glass-card mb-36 rounded-[1.3rem] border bg-background/82 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:mb-40 md:p-6"
        >
          {/* Schedule */}
          <p className="flex items-center gap-2 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/46">
            <CalendarClock className="h-4 w-4" /> Your recurring visit
          </p>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {dates.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => setDate(d.iso)}
                aria-pressed={date === d.iso}
                className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition-colors ${date === d.iso ? 'border-foreground/46 bg-foreground/[0.12]' : 'border-foreground/14 hover:border-foreground/30'}`}
              >
                <span className="font-body text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/55">{d.weekday}</span>
                <span className="font-body text-sm font-black text-foreground">{d.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 min-h-[3rem]">
            {slotsLoading ? (
              <p className="flex items-center gap-2 font-body text-sm font-semibold text-foreground/55"><Loader2 className="h-4 w-4 animate-spin" /> Loading times…</p>
            ) : slotsError ? (
              <p className="font-body text-sm font-semibold text-foreground/55">{slotsError}</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {slots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSlot(t)}
                    aria-pressed={slot === t}
                    className={`rounded-lg border px-2 py-2 font-body text-[13px] font-black transition-colors ${slot === t ? 'border-foreground/46 bg-foreground/[0.12] text-foreground' : 'border-foreground/14 text-foreground/80 hover:border-foreground/30'}`}
                  >
                    {formatSlotLabel(t)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="mt-5 grid gap-2.5 border-t border-foreground/10 pt-4 sm:grid-cols-2">
            <Field label="First name"><input className={inputClass} value={contact.firstName} onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))} autoComplete="given-name" /></Field>
            <Field label="Last name"><input className={inputClass} value={contact.lastName} onChange={(e) => setContact((c) => ({ ...c, lastName: e.target.value }))} autoComplete="family-name" /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} autoComplete="email" /></Field>
            <Field label="Phone"><input type="tel" className={inputClass} value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} autoComplete="tel" /></Field>
            <Field label="Service address"><input className={inputClass} value={address.line1} onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))} autoComplete="address-line1" placeholder="Street address" /></Field>
            <Field label="ZIP"><input className={inputClass} value={address.zip} onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))} autoComplete="postal-code" inputMode="numeric" /></Field>
          </div>
        </motion.section>

        {error && <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 font-body text-sm font-semibold text-red-200" role="alert">{error}</p>}

        <div className="sticky bottom-0 z-10 -mx-4 mt-3 bg-gradient-to-t from-background via-background/92 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),0.85rem)] pt-3">
          <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-foreground/12 bg-background/82 px-3.5 py-2.5 backdrop-blur-xl">
            <span className="font-body text-[12px] font-bold text-foreground/64">Due today · renews {renews}</span>
            <span className="font-body text-sm font-black text-foreground">{money(dueToday)}</span>
          </div>
          <button
            type="button"
            onClick={startMembership}
            disabled={!canSubmit}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>) : (<>Start membership · {money(dueToday)} <ArrowRight className="h-4 w-4" /></>)}
          </button>
          <p className="mt-2 text-center font-body text-[11px] font-semibold text-foreground/44">Secure checkout · licensed RN visit · clinical review before treatment · 3-month minimum, then pause or cancel</p>
        </div>
      </main>
    </div>
  );
}
