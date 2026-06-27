import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  Minus,
  User,
} from 'lucide-react';
import { useSeo } from '@/lib/seo';
import { useAuthStore } from '@/lib/useAuthStore';
import { apiGet } from '@/lib/apiClient';
import { IV_SESSIONS, IV_ADDONS, IM_SHOTS } from '@/data/catalog';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';

// A member redeems one Visit Credit (worth $250 of appointment value) toward a
// visit they assemble here. The cart is priced live against the $250 credit:
// anything at/under $250 is "Included", anything over shows the "+$diff" the
// member pays. The POST mirrors the existing one-time checkout body but adds
// creditRedemption:{ useCredits:true, units:1, memberProfileId } so the webhook
// redeems exactly one credit. Clinical fields are prefilled from the member's
// profile and confirmed here (required for Acuity intake — never consolidated).

const TZ = 'America/Los_Angeles';
const VISIT_CREDIT = 250; // 1 credit = $250 of appointment value
const money = (v) => `$${Math.round(Number(v || 0)).toLocaleString()}`;

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

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MEDICAL_CONDITION_OPTIONS = [
  'None of the above',
  'Allergies',
  'Active Viral or Bacterial infection',
  'Diabetes (Type I or II)',
  'Heart Disease',
  'Kidney Problems',
  'Liver Problems',
  'Pregnancy/Breastfeeding',
  'Other symptoms or medical conditions not listed above',
];
const YES_NO = ['No', 'Yes'];

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
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function joinList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value || '');
}

function SectionHead({ icon: Icon, title, hint }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-gradient-to-b from-foreground/[0.11] to-foreground/[0.03] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12)]">
        <Icon className="h-[18px] w-[18px] text-foreground/82" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-[1.5rem] uppercase leading-[0.95] tracking-normal text-foreground">{title}</p>
        {hint ? <p className="font-body text-[13px] font-bold uppercase tracking-[0.06em] text-foreground/46">{hint}</p> : null}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block font-body text-[13px] font-black uppercase tracking-[0.12em] text-foreground/56">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-foreground/16 bg-background/50 px-3.5 py-3 font-body text-base font-semibold text-foreground placeholder:text-foreground/35 focus:border-foreground/45 focus:outline-none';
const selectClass =
  'av-treatment-card w-full appearance-none rounded-xl border py-3 pl-3.5 pr-10 font-body text-base font-black text-foreground focus:border-foreground/45 focus:outline-none';

function SelectWrap({ children }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/55" strokeWidth={2} />
    </div>
  );
}

// A pickable catalog row — IV (single-select via `selected`) or add-on/shot
// (quantity stepper). Shows the price and an Included/+diff hint isn't here;
// the running total at the bottom carries the credit framing.
function PickRow({ label, price, desc, selected, onToggle, qty, onQty }) {
  const isStepper = typeof qty === 'number';
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3.5 py-3"
      style={{ background: selected || qty > 0 ? CARD_STRONG : CARD, border: `1px solid ${selected || qty > 0 ? TEXT : BORDER}` }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-[14px] font-bold" style={{ color: TEXT }}>{label}</p>
        {desc ? <p className="mt-0.5 truncate font-body text-[12px]" style={{ color: DIM }}>{desc}</p> : null}
      </div>
      <span className="shrink-0 font-body text-[13px] font-black tabular-nums" style={{ color: MUTED }}>{money(price)}</span>
      {isStepper ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onQty(Math.max(0, qty - 1))}
            disabled={qty <= 0}
            className="grid h-8 w-8 place-items-center rounded-lg disabled:opacity-40"
            style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
            aria-label={`Remove ${label}`}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
          <span className="w-5 text-center font-heading text-lg uppercase leading-none tabular-nums" style={{ color: TEXT }}>{qty}</span>
          <button
            type="button"
            onClick={() => onQty(qty + 1)}
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ background: TEXT, color: INVERT }}
            aria-label={`Add ${label}`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={selected ? { background: TEXT, color: INVERT } : { background: CARD_STRONG, color: MUTED, border: `1px solid ${BORDER}` }}
          aria-pressed={selected}
          aria-label={`Choose ${label}`}
        >
          {selected ? <Check className="h-4 w-4" strokeWidth={2.6} /> : <Plus className="h-4 w-4" strokeWidth={2.2} />}
        </button>
      )}
    </div>
  );
}

export default function MemberBook() {
  useSeo({
    title: 'Book a visit - Avalon Vitality',
    description: 'Use a visit credit to book your next in-home IV visit.',
    path: '/members/book',
    robots: 'noindex, nofollow',
  });

  const navigate = useNavigate();
  const { signOut, user } = useAuthStore();
  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };

  // --- Credits + profile prefill ------------------------------------------
  const [credits, setCredits] = useState({ loading: true, balance: 0 });
  const [memberProfileId, setMemberProfileId] = useState(null);

  // Schedule
  const dates = useMemo(() => upcomingDates(14), []);
  const [date, setDate] = useState(dates[0]?.iso || '');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [slot, setSlot] = useState(null);

  // Services
  const [ivKey, setIvKey] = useState(IV_SESSIONS[0]?.key || '');
  const [addonQty, setAddonQty] = useState({}); // label -> qty
  const [shotQty, setShotQty] = useState({}); // label -> qty

  // Contact + clinical (the 6 clinical fields are required for Acuity intake)
  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', emergencyContact: '' });
  const [address, setAddress] = useState({ line1: '', zip: '' });
  const [clinical, setClinical] = useState({
    allergies: '',
    medications: '',
    medicalConditions: 'None of the above',
    covidPositive: 'No',
    infectiousDisease: 'No',
    ivBefore: 'Yes',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const normalizedZip = address.zip.replace(/\D/g, '').slice(0, 5);

  // Load credit balance + member profile (prefill identity, address, PHI).
  useEffect(() => {
    let active = true;
    apiGet('/api/me/credits')
      .then((data) => { if (active) setCredits({ loading: false, balance: Math.max(0, Number(data?.balance || 0)) }); })
      .catch(() => { if (active) setCredits({ loading: false, balance: 0 }); });
    apiGet('/api/me/profile')
      .then((data) => {
        if (!active) return;
        const p = data?.profile || {};
        setMemberProfileId(p.id || null);
        const full = String(p.fullName || user?.name || '').trim();
        const parts = full ? full.split(/\s+/) : [];
        const phi = p.phi || {};
        const ec = p.emergencyContact;
        const ecText = typeof ec === 'string'
          ? ec
          : [ec?.name, ec?.phone].filter(Boolean).join(' · ');
        setContact((c) => ({
          ...c,
          firstName: c.firstName || parts[0] || '',
          lastName: c.lastName || parts.slice(1).join(' ') || '',
          email: c.email || p.email || user?.email || '',
          phone: c.phone || p.phone || '',
          dob: c.dob || p.dateOfBirth || '',
          emergencyContact: c.emergencyContact || ecText || '',
        }));
        if (p.address) setAddress((a) => ({ ...a, line1: a.line1 || String(p.address) }));
        if (p.savedAddress?.zip) setAddress((a) => ({ ...a, zip: a.zip || String(p.savedAddress.zip) }));
        setClinical((cl) => ({
          ...cl,
          allergies: cl.allergies || joinList(phi.allergies),
          medications: cl.medications || joinList(phi.medications),
          medicalConditions: MEDICAL_CONDITION_OPTIONS.includes(joinList(phi.conditions))
            ? joinList(phi.conditions)
            : cl.medicalConditions,
        }));
      })
      .catch(() => { /* prefill is best-effort; member can fill manually */ });
    return () => { active = false; };
  }, [user]);

  // Availability for the chosen day (same endpoint + shape as PlanCheckout).
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
        else setSlot(times[0]);
      } catch (err) {
        if (!cancelled) { setSlots([]); setSlotsError(err.message || 'Could not load times.'); }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date]);

  // --- Cart -> items + live pricing ---------------------------------------
  const selectedIv = IV_SESSIONS.find((s) => s.key === ivKey) || null;

  const chosenAddons = useMemo(
    () => IV_ADDONS.filter((a) => (addonQty[a.label] || 0) > 0).map((a) => ({ ...a, qty: addonQty[a.label] })),
    [addonQty],
  );
  const chosenShots = useMemo(
    () => IM_SHOTS.filter((s) => (shotQty[s.label] || 0) > 0).map((s) => ({ ...s, qty: shotQty[s.label] })),
    [shotQty],
  );

  const subtotal = useMemo(() => {
    let sum = selectedIv ? Number(selectedIv.price || 0) : 0;
    chosenAddons.forEach((a) => { sum += Number(a.price || 0) * a.qty; });
    chosenShots.forEach((s) => { sum += Number(s.price || 0) * s.qty; });
    return sum;
  }, [selectedIv, chosenAddons, chosenShots]);

  // Credit covers up to $250; member pays the rest.
  const creditApplied = Math.min(subtotal, VISIT_CREDIT);
  const dueDiff = Math.max(0, subtotal - VISIT_CREDIT);

  const hasCredits = !credits.loading && credits.balance > 0;
  const canSubmit = hasCredits
    && slot
    && selectedIv
    && contact.firstName.trim()
    && contact.email.trim()
    && contact.phone.trim()
    && contact.dob.trim()
    && contact.emergencyContact.trim()
    && address.line1.trim()
    && normalizedZip.length === 5
    && !submitting;

  // Build the checkout items[] — chosen IV + add-ons + IM shots, all type:'iv'
  // so the credit's IV-only guard passes and they price into the visit subtotal.
  function buildItems() {
    const items = [];
    if (selectedIv) {
      items.push({ type: 'iv', key: selectedIv.key, label: selectedIv.label, price: Number(selectedIv.price || 0), quantity: 1 });
    }
    chosenAddons.forEach((a) => {
      items.push({ type: 'iv', key: `addon-${a.label}`, label: a.label, price: Number(a.price || 0), quantity: a.qty });
    });
    chosenShots.forEach((s) => {
      items.push({ type: 'iv', key: `shot-${s.label}`, label: s.label, price: Number(s.price || 0), quantity: s.qty });
    });
    return items;
  }

  function buildServicesNote() {
    const lines = [];
    if (selectedIv) lines.push(`IV: ${selectedIv.label}`);
    if (chosenAddons.length) lines.push(`Add-ons: ${chosenAddons.map((a) => `${a.qty}× ${a.label}`).join(', ')}`);
    if (chosenShots.length) lines.push(`Shots: ${chosenShots.map((s) => `${s.qty}× ${s.label}`).join(', ')}`);
    return `Member visit redemption — ${lines.join(' · ')}`;
  }

  const bookVisit = async () => {
    if (!canSubmit) {
      setError('Choose an IV, a time, and complete your contact, birthdate, emergency contact, address, and 5-digit ZIP.');
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
          items: buildItems(),
          creditRedemption: { useCredits: true, units: 1, memberProfileId: memberProfileId || user?.id || null },
          contact: {
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            email: contact.email.trim(),
            phone: contact.phone.trim(),
            dob: contact.dob.trim(),
            emergencyContact: contact.emergencyContact.trim(),
          },
          appointment: {
            acuityDatetime: slot,
            acuityTimezone: TZ,
            timeLabel: formatSlotLabel(slot),
            address: address.line1.trim(),
            zip: normalizedZip,
            dob: contact.dob.trim(),
            emergencyContact: contact.emergencyContact.trim(),
            // The 6 clinical fields — required by Acuity intake, never renamed.
            allergies: clinical.allergies.trim(),
            medications: clinical.medications.trim(),
            medicalConditions: clinical.medicalConditions,
            covidPositive: clinical.covidPositive,
            infectiousDisease: clinical.infectiousDisease,
            ivBefore: clinical.ivBefore,
            notes: buildServicesNote(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not start checkout.');
      if (data?.url) {
        window.location.href = data.url; // Stripe hosted checkout (or pre-API preview)
        return;
      }
      // $0 difference with no redirect — credit fully covered the visit.
      navigate('/booking/confirmation?payment=success', { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong booking your visit.');
      setSubmitting(false);
    }
  };

  const visitsRemaining = credits.loading ? '—' : credits.balance;
  const confirmLabel = dueDiff > 0 ? `Use 1 visit · pay ${money(dueDiff)}` : 'Use 1 visit · pay $0';

  return (
    <main className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center"><AvalonMark className="h-[22px] w-[14px] text-foreground" /></Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Member · Book</p>
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

      <div className="mx-auto w-full max-w-3xl px-4 pt-5 md:px-6 md:pt-7">
        <MemberSectionNav />
      </div>

      <section className="mx-auto w-full max-w-3xl px-4 pt-5 md:px-6">
        <Link
          to="/members/dashboard"
          className="mb-3 inline-flex items-center gap-1.5 font-body text-[12px] font-black uppercase tracking-[0.14em]"
          style={{ color: MUTED }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="font-heading text-5xl uppercase leading-none md:text-6xl">Book a visit</h1>
          <p className="font-body text-sm font-semibold" style={{ color: MUTED }}>
            {credits.loading ? 'Loading credits…' : `${visitsRemaining} visit${visitsRemaining === 1 ? '' : 's'} remaining`}
          </p>
        </div>

        {!credits.loading && !hasCredits ? (
          <div className="mt-5 rounded-[24px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>No visit credits</p>
            <h3 className="mt-2 font-heading text-3xl uppercase leading-none">Out of visits</h3>
            <p className="mt-2 font-body text-[13px]" style={{ color: MUTED }}>Add a plan to bank more visit credits, then come back to book.</p>
            <Link to="/subscription" className="mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 font-body text-[11px] font-bold uppercase tracking-[0.18em]" style={{ background: TEXT, color: INVERT }}>
              Get more visits <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        ) : null}
      </section>

      {hasCredits ? (
        <>
          {/* When */}
          <section className="mx-auto mt-6 w-full max-w-3xl px-4 md:px-6">
            <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <SectionHead icon={CalendarClock} title="When" hint="Pick a day and time" />
              <div className="grid gap-2.5 sm:grid-cols-2">
                <SelectWrap>
                  <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="Visit day" className={selectClass}>
                    {dates.map((d) => (
                      <option key={d.iso} value={d.iso} className="bg-background text-foreground">{d.weekday}, {d.label}</option>
                    ))}
                  </select>
                </SelectWrap>
                <div>
                  {slotsLoading ? (
                    <div className="flex h-[50px] items-center gap-2 rounded-xl border border-foreground/14 bg-background/40 px-3.5 font-body text-sm font-semibold text-foreground/55"><Loader2 className="h-4 w-4 animate-spin" /> Loading times…</div>
                  ) : slots.length === 0 ? (
                    <div className="flex h-[50px] items-center rounded-xl border border-foreground/14 bg-background/40 px-3.5 font-body text-[13px] font-semibold text-foreground/55">{slotsError || 'No times open'}</div>
                  ) : (
                    <SelectWrap>
                      <select value={slot || ''} onChange={(e) => setSlot(e.target.value)} aria-label="Visit time" className={`${selectClass} tabular-nums`}>
                        {slots.map((t) => (
                          <option key={t} value={t} className="bg-background text-foreground">{formatSlotLabel(t)}</option>
                        ))}
                      </select>
                    </SelectWrap>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Services */}
          <section className="mx-auto mt-4 w-full max-w-3xl px-4 md:px-6">
            <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <SectionHead icon={Check} title="Your visit" hint="1 IV required · add-ons optional" />

              <p className="mb-2 font-body text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: DIM }}>Choose your IV</p>
              <div className="grid gap-2">
                {IV_SESSIONS.map((s) => (
                  <PickRow
                    key={s.key}
                    label={s.label}
                    price={s.price}
                    desc={s.tagline}
                    selected={s.key === ivKey}
                    onToggle={() => setIvKey(s.key)}
                  />
                ))}
              </div>

              <p className="mb-2 mt-5 font-body text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: DIM }}>IV add-ons (optional)</p>
              <div className="grid gap-2">
                {IV_ADDONS.map((a) => (
                  <PickRow
                    key={a.label}
                    label={a.label}
                    price={a.price}
                    desc={a.desc}
                    qty={addonQty[a.label] || 0}
                    onQty={(q) => setAddonQty((prev) => ({ ...prev, [a.label]: q }))}
                  />
                ))}
              </div>

              <p className="mb-2 mt-5 font-body text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: DIM }}>IM shots (optional)</p>
              <div className="grid gap-2">
                {IM_SHOTS.map((s) => (
                  <PickRow
                    key={s.label}
                    label={s.label}
                    price={s.price}
                    desc={s.desc}
                    qty={shotQty[s.label] || 0}
                    onQty={(q) => setShotQty((prev) => ({ ...prev, [s.label]: q }))}
                  />
                ))}
              </div>

              {/* Live credit math */}
              <div className="mt-5 rounded-xl p-4" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-baseline justify-between font-body text-[13px]">
                  <span style={{ color: MUTED }}>Visit subtotal</span>
                  <span className="font-black tabular-nums" style={{ color: TEXT }}>{money(subtotal)}</span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between font-body text-[13px]">
                  <span style={{ color: MUTED }}>Visit credit (1)</span>
                  <span className="font-black tabular-nums" style={{ color: GOOD }}>− {money(creditApplied)}</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between border-t pt-2" style={{ borderColor: BORDER }}>
                  <span className="font-heading text-xl uppercase" style={{ color: TEXT }}>You pay</span>
                  <span className="font-heading text-xl uppercase tabular-nums" style={{ color: dueDiff > 0 ? TEXT : GOOD }}>
                    {dueDiff > 0 ? `+${money(dueDiff)}` : 'Included'}
                  </span>
                </div>
                <p className="mt-2 font-body text-[12px]" style={{ color: DIM }}>
                  Your credit covers up to {money(VISIT_CREDIT)} of this visit.
                </p>
              </div>
            </div>
          </section>

          {/* You + clinical */}
          <section className="mx-auto mt-4 w-full max-w-3xl px-4 md:px-6">
            <div className="rounded-[24px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <SectionHead icon={User} title="You" hint="Confirm or edit — required for your nurse" />
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="First name"><input className={inputClass} value={contact.firstName} onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))} autoComplete="given-name" autoCapitalize="words" /></Field>
                <Field label="Last name"><input className={inputClass} value={contact.lastName} onChange={(e) => setContact((c) => ({ ...c, lastName: e.target.value }))} autoComplete="family-name" autoCapitalize="words" /></Field>
                <Field label="Email"><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputClass} value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} autoComplete="email" /></Field>
                <Field label="Phone"><input type="tel" inputMode="tel" className={inputClass} value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} autoComplete="tel" /></Field>
                <Field label="Date of birth"><input type="date" className={inputClass} value={contact.dob} onChange={(e) => setContact((c) => ({ ...c, dob: e.target.value }))} autoComplete="bday" /></Field>
                <Field label="Emergency contact"><input className={inputClass} value={contact.emergencyContact} onChange={(e) => setContact((c) => ({ ...c, emergencyContact: e.target.value }))} placeholder="Name + phone" autoComplete="off" /></Field>
              </div>

              <div className="mt-5 border-t border-foreground/10 pt-5">
                <p className="mb-3 font-body text-[13px] font-black uppercase tracking-[0.12em]" style={{ color: MUTED }}>Health screening</p>
                <div className="grid gap-2.5">
                  <Field label="Health">
                    <SelectWrap>
                      <select className={selectClass} value={clinical.medicalConditions} onChange={(e) => setClinical((cl) => ({ ...cl, medicalConditions: e.target.value }))}>
                        {MEDICAL_CONDITION_OPTIONS.map((v) => <option key={v} value={v} className="bg-background text-foreground">{v}</option>)}
                      </select>
                    </SelectWrap>
                  </Field>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <Field label="Covid?">
                      <SelectWrap>
                        <select className={selectClass} value={clinical.covidPositive} onChange={(e) => setClinical((cl) => ({ ...cl, covidPositive: e.target.value }))}>
                          {YES_NO.map((v) => <option key={v} value={v} className="bg-background text-foreground">{v}</option>)}
                        </select>
                      </SelectWrap>
                    </Field>
                    <Field label="Infection?">
                      <SelectWrap>
                        <select className={selectClass} value={clinical.infectiousDisease} onChange={(e) => setClinical((cl) => ({ ...cl, infectiousDisease: e.target.value }))}>
                          {YES_NO.map((v) => <option key={v} value={v} className="bg-background text-foreground">{v}</option>)}
                        </select>
                      </SelectWrap>
                    </Field>
                    <Field label="IV before?">
                      <SelectWrap>
                        <select className={selectClass} value={clinical.ivBefore} onChange={(e) => setClinical((cl) => ({ ...cl, ivBefore: e.target.value }))}>
                          {YES_NO.map((v) => <option key={v} value={v} className="bg-background text-foreground">{v}</option>)}
                        </select>
                      </SelectWrap>
                    </Field>
                  </div>
                  <Field label="Allergies"><input className={inputClass} value={clinical.allergies} onChange={(e) => setClinical((cl) => ({ ...cl, allergies: e.target.value }))} placeholder="None, or list them" /></Field>
                  <Field label="Medications"><input className={inputClass} value={clinical.medications} onChange={(e) => setClinical((cl) => ({ ...cl, medications: e.target.value }))} placeholder="None, or list them" /></Field>
                </div>
              </div>

              <div className="mt-5 border-t border-foreground/10 pt-5">
                <SectionHead icon={MapPin} title="Where" />
                <div className="grid gap-2.5 sm:grid-cols-[1fr_7rem]">
                  <Field label="Service address"><input className={inputClass} value={address.line1} onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))} autoComplete="address-line1" autoCapitalize="words" placeholder="Street address" /></Field>
                  <Field label="ZIP"><input className={inputClass} value={address.zip} onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value.replace(/\D/g, '').slice(0, 5) }))} autoComplete="postal-code" inputMode="numeric" pattern="[0-9]*" maxLength={5} /></Field>
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <section className="mx-auto mt-4 w-full max-w-3xl px-4 md:px-6">
              <p className="rounded-xl px-4 py-3 font-body text-sm font-semibold" style={{ background: 'hsl(0 70% 62% / 0.10)', color: BAD, border: `1px solid hsl(0 70% 62% / 0.30)` }} role="alert">{error}</p>
            </section>
          ) : null}

          {/* Confirm */}
          <section className="mx-auto mt-4 w-full max-w-3xl px-4 md:px-6">
            <div className="mb-2.5 rounded-xl px-4 py-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-body text-[13px] font-black uppercase tracking-[0.08em]" style={{ color: MUTED }}>{selectedIv ? selectedIv.label : 'Pick an IV'}{slot ? ` · ${formatSlotLabel(slot)}` : ''}</span>
                <span className="font-body text-sm font-black tabular-nums" style={{ color: TEXT }}>{dueDiff > 0 ? `+${money(dueDiff)}` : 'Included'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={bookVisit}
              disabled={!canSubmit}
              className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl px-4 font-body text-sm font-black uppercase tracking-[0.08em] transition-transform active:scale-[0.99] disabled:opacity-50"
              style={{ background: TEXT, color: INVERT, border: `1px solid ${TEXT}` }}
            >
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Booking…</>) : (<>{confirmLabel} <ArrowRight className="h-4 w-4" /></>)}
            </button>
            <p className="mt-2 text-center font-body text-[12px] font-semibold" style={{ color: DIM }}>
              Secure checkout · 1 visit credit redeemed at booking
            </p>
          </section>
        </>
      ) : null}

      <MemberBottomNav />
    </main>
  );
}
