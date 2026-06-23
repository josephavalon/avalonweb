import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, CalendarClock, ChevronDown, Loader2, MapPin, User } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import { useSeo } from '@/lib/seo';

// Dedicated membership checkout — intentionally separate from the one-time
// 5-step /book flow. The customer picks one recurring day/time (their standing
// monthly visit), enters contact + address, and pays via the proven
// create-checkout-session backend (paid-first plan deposit -> membership Acuity type).
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

// Section header — icon chip + Bebas title, the same grammar as /subscription.
function SectionHead({ icon: Icon, title, hint }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-gradient-to-b from-foreground/[0.11] to-foreground/[0.03] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12)]">
        <Icon className="h-[18px] w-[18px] text-foreground/82" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-[1.5rem] uppercase leading-[0.95] tracking-normal text-foreground">{title}</p>
        {hint && <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-foreground/46">{hint}</p>}
      </div>
    </div>
  );
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
  'w-full rounded-xl border border-foreground/16 bg-background/50 px-3.5 py-3 font-body text-base font-semibold text-foreground placeholder:text-foreground/35 focus:border-foreground/45 focus:outline-none';

export default function PlanCheckout() {
  useSeo({ title: 'Start your plan - Avalon Vitality', description: 'Schedule your recurring membership visit and start your Avalon IV therapy plan.', path: '/plan' });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const monthly = Math.max(0, Number(searchParams.get('price')) || 0);
  const termKey = searchParams.get('term') || 'monthly';
  const term = TERMS[termKey] || TERMS.monthly;
  const protocol = searchParams.get('protocol') || 'recovery';
  const sessions = Math.max(1, Number(searchParams.get('sessions')) || 1);
  const peopleCount = Math.max(1, Math.min(4, Number(searchParams.get('people')) || 1));
  // The manifest is JSON-encoded then URI-encoded by the builder. Decode lazily;
  // a malformed param shouldn't break checkout (we just hide the per-person list).
  const peopleManifest = useMemo(() => {
    const raw = searchParams.get('plan');
    if (!raw) return [];
    try {
      const decoded = JSON.parse(decodeURIComponent(raw));
      return Array.isArray(decoded) ? decoded : [];
    } catch (err) {
      return [];
    }
  }, [searchParams]);
  const isMultiPerson = peopleCount > 1;

  // Per-period charge: monthly × term months × (1 − discount). Monthly = monthly.
  const perPeriodTotal = Math.round(monthly * term.months * (1 - term.discount));

  const dates = useMemo(() => upcomingDates(14), []);
  const [date, setDate] = useState(dates[0]?.iso || '');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [slot, setSlot] = useState(null); // offset-aware ISO

  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', emergencyContact: '' });
  const [address, setAddress] = useState({ line1: '', zip: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const normalizedZip = address.zip.replace(/\D/g, '').slice(0, 5);

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
        if (!times.length) {
          setSlotsError('No times open that day — try another date.');
        } else {
          // Land pre-confirmed on the soonest opening so a returning user can
          // hit Start in one tap. They can still pick another time.
          setSlot(times[0]);
        }
      } catch (err) {
        if (!cancelled) { setSlots([]); setSlotsError(err.message || 'Could not load times.'); }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date]);

  const canSubmit = slot
    && contact.firstName.trim()
    && contact.email.trim()
    && contact.dob.trim()
    && contact.emergencyContact.trim()
    && address.line1.trim()
    && normalizedZip.length === 5
    && !submitting;

  const startMembership = async () => {
    if (!canSubmit) {
      setError('Pick a time and fill in your contact, birthdate, emergency contact, address, and 5-digit ZIP.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'payment',
          checkoutUiMode: 'hosted',
          membership: { name: 'custom', price: perPeriodTotal, billing: term.billing },
          contact: {
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            email: contact.email.trim(),
            phone: contact.phone.trim(),
            dob: contact.dob.trim(),
            emergencyContact: contact.emergencyContact.trim(),
          },
          appointment: {
            acuityDatetime: slot, // offset-aware ISO from availability — no tz ambiguity
            acuityTimezone: TZ,
            timeLabel: formatSlotLabel(slot),
            address: address.line1.trim(),
            zip: normalizedZip,
            dob: contact.dob.trim(),
            emergencyContact: contact.emergencyContact.trim(),
            protocol,
            recurring: true,
            recurringTerm: term.billing,
            peopleCount,
            peopleManifest,
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

  // $50/person deposit today (like any first visit); the rest of the first
  // period is collected after the visit, then the full price auto-bills every
  // period. Deposit scales with patients on the plan to match the marginal
  // intake cost — one clinician sees all of them in a single household visit.
  const depositToday = Math.min(50 * peopleCount, perPeriodTotal);
  const firstVisitBalance = Math.max(0, perPeriodTotal - depositToday);
  const renews = term.billing === 'monthly' ? 'every month' : `every ${term.label.toLowerCase()}`;
  const protocolName = protocol.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const planLabel = isMultiPerson
    ? `${peopleCount} patients · ${term.label}${sessions > 1 ? ` · ${sessions} visits/mo` : ''}`
    : `${protocolName} · ${term.label}${sessions > 1 ? ` · ${sessions} visits/mo` : ''}`;

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

        <div className="mb-4 md:mb-5">
          <h1 className="font-heading text-[2.4rem] uppercase leading-[0.88] tracking-normal text-foreground md:text-[3rem]">Start your plan</h1>
          <p className="mt-1.5 font-body text-sm font-semibold text-foreground/64">Confirm your standing monthly visit. Change anytime.</p>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="av-glass-card mb-36 rounded-[1.3rem] border bg-background/82 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:mb-40 md:p-6"
        >
          {isMultiPerson && peopleManifest.length > 0 && (
            <div className="mb-4 rounded-xl border border-foreground/12 bg-foreground/[0.04] p-3">
              <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-foreground/52">
                On this plan
              </p>
              <div className="mt-2 space-y-1.5">
                {peopleManifest.map((person) => (
                  <div key={person.id} className="flex items-center justify-between gap-2 font-body text-sm">
                    <span className="text-foreground/82">
                      <span className="font-black uppercase tracking-[0.06em] text-foreground/60 mr-2">{person.label}</span>
                      {person.therapyLabel || 'IV pending'}
                    </span>
                    <span className="font-semibold text-foreground/72">{money(person.monthly)}/mo</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-body text-[11px] font-semibold text-foreground/52">
                One nurse visit treats everyone on the plan.
              </p>
            </div>
          )}

          {/* When — two compact dropdowns (day + time). Soonest slot auto-selected
              so the screen lands pre-confirmed. */}
          <SectionHead icon={CalendarClock} title="When" hint={`Repeats ${renews} · reschedule anytime`} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="relative">
              <select
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Visit day"
                className="av-treatment-card w-full appearance-none rounded-xl border py-3 pl-3.5 pr-10 font-body text-base font-black text-foreground focus:border-foreground/45 focus:outline-none"
              >
                {dates.map((d) => (
                  <option key={d.iso} value={d.iso} className="bg-background text-foreground">{d.weekday}, {d.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/55" strokeWidth={2} />
            </div>
            <div className="relative">
              {slotsLoading ? (
                <div className="flex h-[50px] items-center gap-2 rounded-xl border border-foreground/14 bg-background/40 px-3.5 font-body text-sm font-semibold text-foreground/55"><Loader2 className="h-4 w-4 animate-spin" /> Loading times…</div>
              ) : slots.length === 0 ? (
                <div className="flex h-[50px] items-center rounded-xl border border-foreground/14 bg-background/40 px-3.5 font-body text-[13px] font-semibold text-foreground/55">{slotsError || 'No times open'}</div>
              ) : (
                <>
                  <select
                    value={slot || ''}
                    onChange={(e) => setSlot(e.target.value)}
                    aria-label="Visit time"
                    className="av-treatment-card w-full appearance-none rounded-xl border py-3 pl-3.5 pr-10 font-body text-base font-black tabular-nums text-foreground focus:border-foreground/45 focus:outline-none"
                  >
                    {slots.map((t) => (
                      <option key={t} value={t} className="bg-background text-foreground">{formatSlotLabel(t)}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/55" strokeWidth={2} />
                </>
              )}
            </div>
          </div>

          {/* You */}
          <div className="mt-6 border-t border-foreground/10 pt-5">
            <SectionHead icon={User} title="You" />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="First name"><input className={inputClass} value={contact.firstName} onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))} autoComplete="given-name" autoCapitalize="words" /></Field>
              <Field label="Last name"><input className={inputClass} value={contact.lastName} onChange={(e) => setContact((c) => ({ ...c, lastName: e.target.value }))} autoComplete="family-name" autoCapitalize="words" /></Field>
              <Field label="Email"><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputClass} value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} autoComplete="email" /></Field>
              <Field label="Phone"><input type="tel" inputMode="tel" className={inputClass} value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} autoComplete="tel" /></Field>
              <Field label="Date of birth"><input type="date" className={inputClass} value={contact.dob} onChange={(e) => setContact((c) => ({ ...c, dob: e.target.value }))} autoComplete="bday" /></Field>
              <Field label="Emergency contact"><input className={inputClass} value={contact.emergencyContact} onChange={(e) => setContact((c) => ({ ...c, emergencyContact: e.target.value }))} autoComplete="off" placeholder="Name + phone" /></Field>
            </div>
          </div>

          {/* Where */}
          <div className="mt-6 border-t border-foreground/10 pt-5">
            <SectionHead icon={MapPin} title="Where" />
            <div className="grid gap-2.5 sm:grid-cols-[1fr_7rem]">
              <Field label="Service address"><input className={inputClass} value={address.line1} onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))} autoComplete="address-line1" autoCapitalize="words" placeholder="Street address" /></Field>
              <Field label="ZIP"><input className={inputClass} value={address.zip} onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value.replace(/\D/g, '').slice(0, 5) }))} autoComplete="postal-code" inputMode="numeric" pattern="[0-9]*" maxLength={5} /></Field>
            </div>
          </div>
        </motion.section>

        {error && <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 font-body text-sm font-semibold text-red-200" role="alert">{error}</p>}

        <div className="sticky bottom-0 z-10 -mx-4 mt-3 bg-gradient-to-t from-background via-background/92 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),0.85rem)] pt-3">
          <div className="mb-2.5 rounded-xl border border-foreground/12 bg-background/82 px-3.5 py-2.5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-body text-[12px] font-black uppercase tracking-[0.08em] text-foreground/82">{planLabel}</span>
              <button
                type="button"
                onClick={() => navigate('/subscription')}
                className="shrink-0 font-body text-[9px] font-black uppercase tracking-[0.12em] text-foreground/45 transition-colors hover:text-foreground/85"
              >
                Change
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-foreground/10 pt-1.5">
              <span className="font-body text-[12px] font-black uppercase tracking-[0.06em] text-foreground/70">Deposit today</span>
              <span className="font-body text-sm font-black text-foreground tabular-nums">{money(depositToday)}</span>
            </div>
            <p className="mt-1 font-body text-[11px] font-semibold leading-snug text-foreground/52 tabular-nums">
              {money(firstVisitBalance)} balance after your first visit · then {money(perPeriodTotal)} {renews}
            </p>
          </div>
          <button
            type="button"
            onClick={startMembership}
            disabled={!canSubmit}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>) : (<>Start plan · {money(depositToday)} deposit <ArrowRight className="h-4 w-4" /></>)}
          </button>
          <p className="mt-2 text-center font-body text-[11px] font-semibold text-foreground/44">Secure checkout · licensed RN · cancel after the 3-month minimum</p>
        </div>
      </main>
    </div>
  );
}
