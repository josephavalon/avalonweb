import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, CalendarClock, ChevronDown, Loader2, Lock, MapPin, Pencil, ShieldCheck, User, UserPlus, Users } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import { useSeo } from '@/lib/seo';
import { useAuthStore } from '@/lib/useAuthStore';
import { apiGet } from '@/lib/apiClient';
import { resolveGfeRequirement } from '@/lib/bookingLifecycle';

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
        {hint && <p className="font-body text-[14px] font-bold uppercase tracking-[0.06em] text-foreground/46">{hint}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block font-body text-[14px] font-black uppercase tracking-[0.12em] text-foreground/56">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-foreground/16 bg-background/50 px-3.5 py-3 font-body text-base font-semibold text-foreground placeholder:text-foreground/35 focus:border-foreground/45 focus:outline-none';

// Three-step membership flow rail: Membership -> Payment -> Review & Confirm.
// Visual only; "Continue to payment" hands off to Stripe (the payment step).
const CHECKOUT_STEPS = ['Membership', 'Payment', 'Review & Confirm'];
function Stepper({ step = 1 }) {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-3">
      {CHECKOUT_STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-body text-[12px] font-black tabular-nums ${active || done ? 'border-foreground bg-foreground text-background' : 'border-foreground/25 text-foreground/45'}`}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
              </span>
              <span className={`font-body text-[12px] font-black uppercase tracking-[0.12em] ${active ? 'text-foreground' : 'text-foreground/40'} ${active ? '' : 'hidden sm:inline'}`}>{label}</span>
            </div>
            {n < CHECKOUT_STEPS.length && <span className="h-px w-4 bg-foreground/15 md:w-8" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Order-summary line with a bold value + muted descriptor underneath.
function SummaryLine({ title, value, sub, emphasize }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-body font-black uppercase tracking-[0.06em] ${emphasize ? 'text-[15px] text-foreground/82' : 'text-[14px] text-foreground/64'}`}>{title}</span>
        <span className={`font-heading tabular-nums leading-none ${emphasize ? 'text-[1.35rem] text-foreground' : 'text-[1.05rem] text-foreground/85'}`}>{value}</span>
      </div>
      {sub && <p className="mt-0.5 font-body text-[13px] font-semibold text-foreground/42">{sub}</p>}
    </div>
  );
}

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

  // Per-visit breakdown (mixed-IV plans). Each person's monthly visits, itemized
  // so the nurse sees exactly what to administer each visit. This string is sent
  // as appointment.notes and flows untouched into the Acuity appointment notes.
  const visitBreakdown = useMemo(() => peopleManifest
    .map((person) => ({ label: person.label, visits: Array.isArray(person.visits) ? person.visits : [] }))
    .filter((p) => p.visits.length), [peopleManifest]);
  const hasVisitDetail = visitBreakdown.some((p) => p.visits.length > 1
    || p.visits.some((v) => (v.addons || []).length));
  const planNote = useMemo(() => {
    if (!visitBreakdown.length) return '';
    const lines = visitBreakdown.map(({ label, visits }) => {
      const vs = visits.map((v, i) => {
        const adds = (v.addons || []).map((a) => `${a.qty}× ${a.label}`).join(', ');
        return `Visit ${i + 1}: ${v.therapyLabel || 'IV'}${adds ? ` + ${adds}` : ''}`;
      }).join('; ');
      return (isMultiPerson ? `${label} — ` : '') + vs;
    });
    return `PLAN VISITS (per month)\n${lines.join('\n')}`;
  }, [visitBreakdown, isMultiPerson]);

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

  // ── Logged-in fast path ──────────────────────────────────────────────────
  // A signed-in patient gets their saved contact + address prefilled, and — if a
  // valid GFE is already on file — skips the new clinical review (the membership
  // clinical step is already satisfied). Checkout collapses to "pick a time + pay".
  const { user } = useAuthStore();
  const loggedIn = Boolean(user);
  const [serverProfile, setServerProfile] = useState(null);
  const [editDetails, setEditDetails] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    apiGet('/api/me/profile')
      .then((d) => { if (active) setServerProfile(d || null); })
      .catch(() => {});
    return () => { active = false; };
  }, [user]);

  // Prefill blanks only — never clobber something the user just typed.
  useEffect(() => {
    const p = serverProfile?.profile;
    if (!p) return;
    const parts = (p.fullName || '').trim().split(/\s+/).filter(Boolean);
    setContact((c) => ({
      ...c,
      firstName: c.firstName || parts[0] || '',
      lastName: c.lastName || parts.slice(1).join(' ') || '',
      email: c.email || p.email || '',
      phone: c.phone || p.phone || '',
      dob: c.dob || p.dateOfBirth || '',
      emergencyContact: c.emergencyContact || p.emergencyContact || '',
    }));
    const saved = serverProfile.savedAddress || p.address || null;
    if (saved) {
      const line1 = typeof saved === 'string' ? saved : (saved.line1 || saved.address || '');
      const zip = typeof saved === 'string' ? '' : (saved.zip || saved.postalCode || '');
      setAddress((a) => ({
        line1: a.line1 || line1 || '',
        zip: a.zip || String(zip || '').replace(/\D/g, '').slice(0, 5),
      }));
    }
  }, [serverProfile]);

  const profileGfe = useMemo(() => resolveGfeRequirement({
    isNewClient: false,
    visitCount: 1,
    gfe: serverProfile?.gfe,
    gfeExpiresAt: serverProfile?.gfe?.expiresAt || serverProfile?.gfe?.validUntil,
  }), [serverProfile]);
  const gfeOnFile = Boolean(loggedIn && serverProfile?.gfe && !profileGfe.required);

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

  // Visits the plan grants each cycle = sum of every person's visits, else
  // sessions × people. Used for display and sent to the checkout API.
  const visitsPerCycle = peopleManifest.length
    ? peopleManifest.reduce((sum, person) => sum + (Array.isArray(person.visits) ? person.visits.length : 0), 0)
    : sessions * peopleCount;

  // Logged in with every required detail already prefilled → collapse the form
  // into a one-line "details on file" summary; they can expand to edit.
  const detailsOnFile = loggedIn
    && Boolean(contact.firstName.trim() && contact.email.trim() && contact.dob.trim()
      && contact.emergencyContact.trim() && address.line1.trim() && normalizedZip.length === 5);
  const showCompactDetails = detailsOnFile && !editDetails;

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
          membership: { name: 'custom', price: perPeriodTotal, billing: term.billing, visitsPerCycle },
          contact: {
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            email: contact.email.trim(),
            phone: contact.phone.trim(),
            dob: contact.dob.trim(),
            emergencyContact: contact.emergencyContact.trim(),
          },
          // Plans require an account. A signed-in patient already has one (and an
          // authed session the backend reads); a logged-out buyer's account is
          // provisioned from the email/name they just entered via signupIntent
          // (normalizeSignupIntent → { email, name }). Without this, the backend
          // rejects logged-out plan checkout with `plan_requires_account`.
          ...(loggedIn ? {} : {
            signupIntent: {
              email: contact.email.trim(),
              name: `${contact.firstName.trim()} ${contact.lastName.trim()}`.trim(),
              firstName: contact.firstName.trim(),
              lastName: contact.lastName.trim(),
            },
          }),
          appointment: {
            acuityDatetime: slot, // offset-aware ISO from availability — no tz ambiguity
            acuityTimezone: TZ,
            timeLabel: formatSlotLabel(slot),
            address: address.line1.trim(),
            zip: normalizedZip,
            dob: contact.dob.trim(),
            emergencyContact: contact.emergencyContact.trim(),
            protocol,
            notes: planNote,
            recurring: true,
            recurringTerm: term.billing,
            peopleCount,
            peopleManifest,
            // Returning, signed-in patient with a valid GFE already on file →
            // the clinical review is satisfied; the backend logs it and skips a
            // new exam (the required intake fields are still sent).
            clinicalReviewOnFile: gfeOnFile,
            gfeRequired: profileGfe.required,
            returning: loggedIn,
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

  const visitsLabel = `${visitsPerCycle} ${visitsPerCycle === 1 ? 'Visit' : 'Visits'} / Month`;
  const membersLabel = `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`;
  const periodPriceLabel = `${money(perPeriodTotal)}${term.billing === 'monthly' ? '/mo' : ''}`;
  // Next billing date = the first visit (their billing date) + one term cycle.
  const nextBillingDate = (() => {
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    const base = new Date(y, (m - 1) + term.months, d);
    return `${MONTH[base.getMonth()]} ${base.getDate()}, ${base.getFullYear()}`;
  })();

  const includedItems = [
    visitsLabel,
    'Up to $250 included per visit',
    gfeOnFile ? 'Clinical review on file' : 'Initial clinical review',
    'Cancel anytime',
  ];

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header><Navbar /></header>
      <main className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[5.75rem]">
        <Stepper step={1} />

        <div className="mt-5 flex flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:items-start md:gap-7 lg:grid-cols-[minmax(0,1fr)_24rem]">
          {/* LEFT — the membership step */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="av-glass-card flex flex-col rounded-[1.3rem] border bg-background/82 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-6"
          >
            <button
              type="button"
              onClick={() => navigate('/subscription')}
              className="mb-3 inline-flex items-center gap-1.5 self-start font-body text-[13px] font-black uppercase tracking-[0.14em] text-foreground/50 hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to plan
            </button>

            <h1 className="font-heading text-[2.4rem] uppercase leading-[0.88] tracking-normal text-foreground md:text-[2.9rem]">Checkout</h1>
            <p className="mt-1 font-body text-sm font-semibold text-foreground/60">Start your Avalon membership today.</p>

            {/* Logged-out nudge — plans require an account, so we either sign them
                in (autofill) or create one for them on purchase. Hidden once
                authed (the fast path already prefills + collapses details). */}
            {!loggedIn && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-foreground/14 bg-foreground/[0.05] px-3.5 py-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/12 bg-gradient-to-b from-foreground/[0.11] to-foreground/[0.03]">
                  <UserPlus className="h-4 w-4 text-foreground/82" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="font-body text-sm font-bold text-foreground/85">
                    Have an account?{' '}
                    <Link
                      to={`/login?next=${encodeURIComponent(`/plan?${searchParams.toString()}`)}`}
                      className="text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      Sign in to autofill
                    </Link>
                  </p>
                  <p className="mt-0.5 font-body text-[13px] font-semibold leading-snug text-foreground/55">
                    We'll create your account so you can manage bookings &amp; plans.
                  </p>
                </div>
              </div>
            )}

            {/* YOUR MEMBERSHIP */}
            <p className="mt-6 font-body text-[13px] font-black uppercase tracking-[0.16em] text-foreground/42">Your membership</p>
            <div className="mt-2.5 flex items-center gap-3.5 rounded-xl border border-foreground/12 bg-foreground/[0.05] px-4 py-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-gradient-to-b from-foreground/[0.11] to-foreground/[0.03]">
                <Users className="h-5 w-5 text-foreground/82" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-[1.4rem] uppercase leading-none tracking-normal text-foreground">{visitsLabel}</p>
                <p className="mt-1 font-body text-[13px] font-semibold text-foreground/55">Up to 4 people on one plan · Cancel anytime</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-heading text-[1.6rem] leading-none text-foreground">{money(monthly)}</p>
                <p className="font-body text-[12px] font-bold text-foreground/45">/month</p>
              </div>
            </div>

            {/* per-person + per-visit detail (only when a manifest carries it) */}
            {isMultiPerson && peopleManifest.length > 0 && (
              <div className="mt-3 rounded-xl border border-foreground/12 bg-foreground/[0.04] p-3">
                <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-foreground/52">On this plan</p>
                <div className="mt-2 space-y-1.5">
                  {peopleManifest.map((person) => (
                    <div key={person.id} className="flex items-center justify-between gap-2 font-body text-sm">
                      <span className="text-foreground/82"><span className="mr-2 font-black uppercase tracking-[0.06em] text-foreground/60">{person.label}</span>{person.therapyLabel || 'IV pending'}</span>
                      <span className="font-semibold text-foreground/72">{money(person.monthly)}/mo</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 font-body text-[13px] font-semibold text-foreground/52">One nurse visit treats everyone on the plan.</p>
              </div>
            )}
            {hasVisitDetail && (
              <div className="mt-3 rounded-xl border border-foreground/12 bg-foreground/[0.04] p-3">
                <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-foreground/52">Your visits this month</p>
                <div className="mt-2 space-y-2.5">
                  {visitBreakdown.map(({ label, visits }, pi) => (
                    <div key={pi}>
                      {isMultiPerson && <p className="font-body text-[12px] font-black uppercase tracking-[0.06em] text-foreground/45">{label}</p>}
                      <div className="mt-1 space-y-1">
                        {visits.map((v, i) => (
                          <div key={i} className="flex items-start justify-between gap-2 font-body text-sm">
                            <span className="text-foreground/82">
                              <span className="mr-2 font-black uppercase tracking-[0.06em] text-foreground/55">Visit {i + 1}</span>
                              {v.therapyLabel || 'IV'}
                              {(v.addons || []).length > 0 && <span className="text-foreground/55"> · {(v.addons).map((a) => `${a.qty}× ${a.label}`).join(', ')}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WHAT'S INCLUDED */}
            <p className="mt-6 font-body text-[13px] font-black uppercase tracking-[0.16em] text-foreground/42">What's included</p>
            <ul className="mt-2.5 grid gap-2">
              {includedItems.map((item) => (
                <li key={item} className="flex items-center gap-2.5 font-body text-sm font-semibold text-foreground/82">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground/20 bg-foreground/[0.06]">
                    <Check className="h-3 w-3 text-foreground/75" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            {/* WHEN — standing monthly visit */}
            <div className="mt-6 border-t border-foreground/10 pt-5">
              <SectionHead icon={CalendarClock} title="When" hint={`Repeats ${renews} · reschedule anytime`} />
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="relative">
                  <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="Visit day" className="av-treatment-card w-full appearance-none rounded-xl border py-3 pl-3.5 pr-10 font-body text-base font-black text-foreground focus:border-foreground/45 focus:outline-none">
                    {dates.map((d) => (<option key={d.iso} value={d.iso} className="bg-background text-foreground">{d.weekday}, {d.label}</option>))}
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
                      <select value={slot || ''} onChange={(e) => setSlot(e.target.value)} aria-label="Visit time" className="av-treatment-card w-full appearance-none rounded-xl border py-3 pl-3.5 pr-10 font-body text-base font-black tabular-nums text-foreground focus:border-foreground/45 focus:outline-none">
                        {slots.map((t) => (<option key={t} value={t} className="bg-background text-foreground">{formatSlotLabel(t)}</option>))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/55" strokeWidth={2} />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* DETAILS — collapsed "on file" when logged in, else the full form */}
            {showCompactDetails ? (
              <div className="mt-6 border-t border-foreground/10 pt-5">
                <div className="rounded-xl border border-foreground/12 bg-foreground/[0.04] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-foreground/52">Your details</p>
                      <p className="mt-1.5 truncate font-body text-sm font-bold text-foreground/85">{contact.firstName} {contact.lastName}</p>
                      <p className="truncate font-body text-[13px] font-semibold text-foreground/55">{contact.email}{contact.phone ? ` · ${contact.phone}` : ''}</p>
                      <p className="truncate font-body text-[13px] font-semibold text-foreground/55">{address.line1}, {normalizedZip}</p>
                    </div>
                    <button type="button" onClick={() => setEditDetails(true)} className="inline-flex shrink-0 items-center gap-1 font-body text-[12px] font-black uppercase tracking-[0.1em] text-foreground/50 hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  </div>
                  {gfeOnFile && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-emerald-400/22 bg-emerald-400/[0.07] px-2.5 py-1.5">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2} />
                      <span className="font-body text-[13px] font-bold text-emerald-100">Clinical review on file — no new exam needed</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
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
                <div className="mt-6 border-t border-foreground/10 pt-5">
                  <SectionHead icon={MapPin} title="Where" />
                  <div className="grid gap-2.5 sm:grid-cols-[1fr_7rem]">
                    <Field label="Service address"><input className={inputClass} value={address.line1} onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))} autoComplete="address-line1" autoCapitalize="words" placeholder="Street address" /></Field>
                    <Field label="ZIP"><input className={inputClass} value={address.zip} onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value.replace(/\D/g, '').slice(0, 5) }))} autoComplete="postal-code" inputMode="numeric" pattern="[0-9]*" maxLength={5} /></Field>
                  </div>
                </div>
              </>
            )}

            {error && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 font-body text-sm font-semibold text-red-200" role="alert">{error}</p>}

            <button
              type="button"
              onClick={startMembership}
              disabled={!canSubmit}
              className="mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[1.05rem] border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.1em] text-background transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>) : (<>Continue to payment <ArrowRight className="h-4 w-4" /></>)}
            </button>
            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center font-body text-[13px] font-semibold text-foreground/44">
              <Lock className="h-3.5 w-3.5" /> Secure checkout. Your information is always protected.
            </p>
          </motion.div>

          {/* RIGHT — order summary */}
          <aside className="mt-5 md:mt-0 md:sticky md:top-[5.75rem]">
            <div className="rounded-[1.25rem] border border-foreground/10 bg-background/70 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-5">
              <p className="font-body text-[13px] font-black uppercase tracking-[0.18em] text-foreground/48">Order summary</p>
              <div className="mt-3 space-y-2 font-body text-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-semibold text-foreground/55">Plan</span><span className="font-bold text-foreground/85">{visitsLabel}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-semibold text-foreground/55">Members</span><span className="font-bold text-foreground/85">{membersLabel}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-semibold text-foreground/55">Billing</span><span className="font-bold text-foreground/85">{term.label}</span></div>
              </div>
              <div className="mt-3 space-y-3 border-t border-foreground/10 pt-3">
                <SummaryLine title="Due today" value={money(depositToday)} sub="$50 deposit to start" emphasize />
                <SummaryLine title="After first visit" value={money(firstVisitBalance)} sub="Balance after your first visit" />
                <SummaryLine title={`Then ${renews}`} value={periodPriceLabel} sub="Starting on your billing date" />
              </div>
              {nextBillingDate && (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2.5">
                  <CalendarClock className="h-4 w-4 shrink-0 text-foreground/55" strokeWidth={2} />
                  <div className="min-w-0">
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-foreground/45">Next billing date</p>
                    <p className="font-body text-sm font-bold text-foreground/85">{nextBillingDate}</p>
                  </div>
                </div>
              )}
              <p className="mt-3 font-body text-[12px] font-semibold text-foreground/40">Cancel anytime after the 3-month minimum.</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
