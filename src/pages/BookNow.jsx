import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft, ArrowRight, BatteryCharging, Building2, Check, ChevronDown,
  CreditCard, Dumbbell, HeartPulse, Home, Hotel, MapPin, ShieldCheck,
  Sparkles, Users, Zap, SlidersHorizontal, Loader2, RefreshCw, Calendar,
  Droplets, Syringe, Leaf,
} from 'lucide-react';

import { useCart } from '@/context/CartContext';
import { IV_ADDONS, IV_SESSIONS, IM_SHOTS } from '@/config/verticals';
import { useSeo } from '@/lib/seo';
import Navbar from '@/components/landing/Navbar';
import { COVERED_ZIPS } from '@/lib/serviceArea';

const EASE = [0.16, 1, 0.3, 1];
const ACUITY_TYPE_ID = import.meta.env.VITE_ACUITY_DEFAULT_TYPE_ID || '';
const TZ = 'America/Los_Angeles';

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = ['Goal', 'Protocol', 'Schedule', 'About You', 'Confirm'];

// ── Goal options ──────────────────────────────────────────────────────────────
const GOALS = [
  { key: 'recovery',    label: 'Recovery',       sub: 'Feel better fast',        icon: HeartPulse,   category: 'recovery' },
  { key: 'energy',      label: 'Energy',          sub: 'Boost and recharge',      icon: Zap,          category: 'energy'   },
  { key: 'immunity',    label: 'Immunity',        sub: 'Support your defense',    icon: ShieldCheck,  category: 'immunity' },
  { key: 'beauty',      label: 'Beauty / Glow',   sub: 'Radiate from within',     icon: Sparkles,     category: 'beauty'   },
  { key: 'performance', label: 'Performance',     sub: 'Optimize your edge',      icon: Dumbbell,     category: 'energy'   },
  { key: 'longevity',   label: 'Longevity',       sub: 'Invest in your future',   icon: BatteryCharging, category: 'energy' },
  { key: 'event',       label: 'Event / Group',   sub: 'We come to you',          icon: Users,        category: 'recovery' },
];

const LOCATIONS = [
  { key: 'home',   label: 'Home',          icon: Home      },
  { key: 'hotel',  label: 'Hotel',         icon: Hotel     },
  { key: 'office', label: 'Office',        icon: Building2 },
  { key: 'event',  label: 'Event / Venue', icon: Users     },
  { key: 'other',  label: 'Other',         icon: MapPin    },
];

const ADDON_GROUPS = [
  {
    key: 'iv',
    title: 'IV Add-Ons',
    sub: 'Boost your drip with fluids, antioxidants, and specialty pushes.',
    items: IV_ADDONS
      .filter(a => !a.group) // exclude dose-tiered specialties (NAD+, CBD — those are standalone sessions)
      .map(addon => ({ ...addon, cartKey: `iv-${addon.label}`, type: 'addon' })),
  },
  {
    key: 'im',
    title: 'IM Shots',
    sub: 'Fast intramuscular shots for targeted support.',
    items: IM_SHOTS.map(shot => ({ ...shot, cartKey: `im-${shot.label}`, type: 'im' })),
  },
];

const ADDONS_FLAT = ADDON_GROUPS.flatMap(g => g.items);

function formatTimeLabel(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
}

function todayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

// ── Progress dots ─────────────────────────────────────────────────────────────
function StepProgress({ step }) {
  return (
    <div className="flex items-center gap-2 mb-8 md:mb-10">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done   = i < step;
        return (
          <React.Fragment key={label}>
            <div
              className={`h-2.5 w-2.5 rounded-full border transition-all duration-300 ${
                done || active ? 'bg-foreground border-foreground' : 'bg-transparent border-foreground/20'
              }`}
              title={label}
            />
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 transition-colors duration-300 ${i < step ? 'bg-foreground/40' : 'bg-foreground/12'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Order sidebar (desktop) ───────────────────────────────────────────────────
function OrderSidebar({ protocol, selectedDose, addons, step, subtotal }) {
  if (step === 0 || !protocol) return null;
  const priceDisplay = selectedDose ? selectedDose.price : protocol.price;
  const Icon = protocol.icon || Droplets;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="hidden lg:block sticky top-32 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 space-y-4"
    >
      <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/35">Your Order</p>

      {/* Protocol */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-foreground/[0.05] border border-foreground/[0.07] flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-sm font-semibold text-foreground truncate">
            {protocol.label}{selectedDose ? ` · ${selectedDose.label}` : ''}
          </p>
          <p className="font-body text-[10px] text-foreground/40">IV Session</p>
        </div>
        <span className="font-body text-sm font-semibold text-foreground shrink-0">${priceDisplay.toLocaleString()}</span>
      </div>

      {/* Add-ons */}
      {addons.length > 0 && (
        <div className="space-y-2 border-t border-foreground/[0.06] pt-3">
          {addons.map(addon => (
            <div key={addon.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Syringe className="w-3 h-3 text-foreground/25 shrink-0" strokeWidth={1.5} />
                <span className="font-body text-xs text-foreground/60 truncate">{addon.label}</span>
              </div>
              <span className="font-body text-xs text-foreground/50 shrink-0">+${addon.price}</span>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {step >= 2 && (
        <div className="border-t border-foreground/[0.06] pt-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/35">Subtotal</span>
            <span className="font-heading text-2xl text-foreground">${subtotal.toLocaleString()}</span>
          </div>
          <p className="font-body text-[10px] text-foreground/30">$50 deposit due now. Balance after visit.</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Option card ───────────────────────────────────────────────────────────────
function OptionCard({ active, icon: Icon, title, sub, meta, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className={`w-full flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all ${
        active
          ? 'border-foreground bg-foreground text-background shadow-[0_18px_45px_hsl(var(--foreground)/0.14)]'
          : 'border-foreground/[0.10] bg-card/[0.72] hover:border-foreground/25'
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
        active ? 'border-background/25 bg-background/10' : 'border-foreground/[0.08] bg-foreground/[0.04]'
      }`}>
        <Icon className="h-4 w-4" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-sm font-semibold tracking-[0.02em]">{title}</span>
        {sub && <span className={`mt-0.5 block font-body text-[11px] ${active ? 'text-background/65' : 'text-foreground/45'}`}>{sub}</span>}
      </span>
      {meta && <span className={`font-body text-xs font-semibold shrink-0 ${active ? 'text-background' : 'text-foreground'}`}>{meta}</span>}
    </motion.button>
  );
}

// ── Add-on accordion group ────────────────────────────────────────────────────
function AddonGroup({ group, selected, open, onToggleOpen, onToggleAddon }) {
  const selectedCount = group.items.filter(item => selected.has(item.label)).length;
  return (
    <div className="overflow-hidden rounded-2xl border border-foreground/[0.10] bg-card/[0.72]">
      <button type="button" onClick={onToggleOpen} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left">
        <span>
          <span className="block font-body text-xs font-semibold uppercase tracking-[0.24em] text-foreground">{group.title}</span>
          <span className="mt-1 block font-body text-[11px] leading-relaxed text-foreground/45">
            {selectedCount ? `${selectedCount} selected` : group.sub}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="font-body text-xs font-semibold text-foreground/45">{group.items.length}</span>
          <ChevronDown className={`h-4 w-4 text-foreground transition-transform duration-300 ${open ? 'rotate-180' : ''}`} strokeWidth={1.8} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden border-t border-foreground/[0.08]"
          >
            <div className="px-4 pb-2">
              {group.items.map(addon => {
                const active = selected.has(addon.label);
                return (
                  <button
                    key={addon.cartKey}
                    type="button"
                    onClick={() => onToggleAddon(addon.label)}
                    className="flex w-full items-center gap-3 border-b border-foreground/[0.07] py-4 text-left last:border-b-0"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      active ? 'border-foreground bg-foreground text-background' : 'border-foreground/18'
                    }`}>
                      {active && <Check className="h-3 w-3" strokeWidth={2.5} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-body text-sm font-semibold text-foreground">{addon.label}</span>
                      {addon.desc && <span className="mt-0.5 block font-body text-[10px] leading-relaxed text-foreground/40">{addon.desc}</span>}
                    </span>
                    <span className="font-body text-sm font-semibold text-foreground shrink-0">${addon.price}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BookNow() {
  useSeo({
    title: 'Book Mobile IV Therapy — Avalon Vitality',
    description: 'Choose your goal, protocol, add-ons, and visit time for Avalon Vitality mobile IV therapy in the SF Bay Area.',
    path: '/book',
  });

  const navigate = useNavigate();
  const { addItem, clearItems } = useCart();

  // ── Step & selection state ──────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(GOALS[0]);
  const [groupSize, setGroupSize] = useState(2);
  const [protocol, setProtocol] = useState(
    IV_SESSIONS.find(s => s.key === 'myers') || IV_SESSIONS[0]
  );
  // For sessions with dose tiers, track selected dose
  const [selectedDose, setSelectedDose] = useState(() => {
    const p = IV_SESSIONS.find(s => s.key === 'myers') || IV_SESSIONS[0];
    return p?.doses?.[0] ?? null;
  });
  const [expandedProtocol, setExpandedProtocol] = useState(null);
  const [addons, setAddons] = useState(new Set());
  const [openAddonGroups, setOpenAddonGroups] = useState({ iv: false, im: false });

  // ── Acuity / scheduling state ───────────────────────────────────────────────
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [nextAvailLoading, setNextAvailLoading] = useState(false);

  // ── Checkout state ──────────────────────────────────────────────────────────
  const [appointment, setAppointment] = useState(null);
  const [contact, setContact] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  // ── Forms (steps 3 & 4) ─────────────────────────────────────────────────────
  const aboutForm = useForm({
    defaultValues: {
      firstName: '', lastName: '', email: '', phone: '',
      address: '', zip: '', date: '', notes: '',
      dob: '', guests: '1',
      covidPositive: 'No', infectiousDisease: 'No', ivBefore: 'Yes',
      medicalConditions: 'None of the above',
      allergies: '', medications: '', emergencyContact: '',
      privacyAck: false, treatmentConsent: false, generalConsent: false,
    },
  });

  const selectedDate = aboutForm.watch('date');

  // ── Acuity availability ─────────────────────────────────────────────────────
  const fetchSlots = useCallback(async (date) => {
    if (!date) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    try {
      const params = new URLSearchParams({ date, timezone: TZ });
      if (ACUITY_TYPE_ID) params.set('appointmentTypeID', ACUITY_TYPE_ID);
      const res = await fetch(`/api/acuity-availability?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load availability');
      setSlots(data);
    } catch (err) {
      setSlotsError(err.message);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  const findNextAvailable = useCallback(async (fromDate) => {
    setNextAvailLoading(true);
    try {
      const base = fromDate ? new Date(fromDate + 'T12:00:00') : new Date();
      for (let i = 1; i <= 14; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        const dateStr = d.toLocaleDateString('en-CA', { timeZone: TZ });
        const params = new URLSearchParams({ date: dateStr, timezone: TZ });
        if (ACUITY_TYPE_ID) params.set('appointmentTypeID', ACUITY_TYPE_ID);
        const res = await fetch(`/api/acuity-availability?${params}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.length > 0) { setSlots(data); setNextAvailLoading(false); return dateStr; }
      }
    } catch {}
    setNextAvailLoading(false);
    return null;
  }, []);

  // ── Computed values ─────────────────────────────────────────────────────────
  const recommendedProtocols = useMemo(() => {
    const filtered = IV_SESSIONS.filter(s => s.category === goal.category);
    return (filtered.length ? filtered : IV_SESSIONS).slice(0, 6);
  }, [goal]);

  const selectedAddons = ADDONS_FLAT.filter(a => addons.has(a.label));
  const protocolPrice  = selectedDose ? selectedDose.price : (protocol?.price ?? 0);
  const subtotal       = protocolPrice + selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const groupNeedsContact = step === 0 && goal.key === 'event' && groupSize > 4;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const toggleAddon = (label) => {
    setAddons(cur => {
      const next = new Set(cur);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const toggleAddonGroup = (key) =>
    setOpenAddonGroups(cur => ({ iv: false, im: false, [key]: !cur[key] }));

  const next = () => setStep(cur => Math.min(cur + 1, STEPS.length - 1));
  const back = () => setStep(cur => Math.max(cur - 1, 0));

  const contactForGroup = () => {
    const sub  = encodeURIComponent('Group visit request');
    const body = encodeURIComponent(`Hi Avalon,\n\nI'd like to book a group IV visit for ${groupSize}+ people.\n\n`);
    window.location.href = `mailto:support@avalonvitality.co?subject=${sub}&body=${body}`;
  };

  const handleCheckout = async () => {
    if (!contact || !appointment) return;
    setCheckoutLoading(true);
    setCheckoutError(null);

    clearItems();
    const protocolLabel = `${protocol.label}${selectedDose ? ` (${selectedDose.label})` : ''}`;
    addItem({ cartKey: selectedDose?.key ?? protocol.key, label: protocolLabel, price: protocolPrice, type: 'iv' });
    selectedAddons.forEach(a => addItem({
      cartKey: a.cartKey,
      label: a.type === 'im' ? `IM · ${a.label}` : a.label,
      price: a.price,
      type: a.type,
    }));

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'payment',
          items: [
            { cartKey: selectedDose?.key ?? protocol.key, label: protocolLabel, price: protocolPrice, type: 'iv' },
            ...selectedAddons.map(a => ({ cartKey: a.cartKey, label: a.type === 'im' ? `IM · ${a.label}` : a.label, price: a.price, type: a.type })),
          ],
          membership: null,
          contact: { name: `${contact.firstName} ${contact.lastName}`, ...contact },
          appointment: {
            address: appointment.address,
            notes: appointment.notes ?? '',
            acuityTypeId: appointment.acuitySlot?.appointmentTypeID ?? '',
            acuityDatetime: appointment.acuitySlot?.datetime ?? '',
            acuityTimezone: appointment.acuitySlot?.timezone ?? TZ,
            timeLabel: appointment.acuitySlot?.timeLabel ?? '',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err.message);
      setCheckoutLoading(false);
    }
  };

  // ── Shared styles ────────────────────────────────────────────────────────────
  const fieldCls  = 'w-full bg-foreground/[0.04] border border-foreground/[0.10] text-foreground font-body text-sm rounded-2xl px-4 py-3.5 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 transition-colors';
  const labelCls  = 'font-body text-[10px] tracking-[0.25em] uppercase text-foreground/50 mb-2 block';
  const errCls    = 'font-body text-[10px] text-red-400 mt-1';
  const btnBack   = 'flex h-14 w-14 items-center justify-center rounded-2xl border border-foreground/[0.12] bg-background text-foreground shrink-0 transition-colors hover:bg-foreground/[0.05]';
  const btnFwd    = 'flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-foreground font-body text-xs font-semibold uppercase tracking-[0.22em] text-background shadow-[0_14px_40px_hsl(var(--foreground)/0.16)] transition-opacity hover:opacity-90';
  const btnConfirm = 'flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent font-body text-xs font-semibold uppercase tracking-[0.22em] text-background shadow-[0_14px_40px_hsl(var(--accent)/0.3)] transition-opacity hover:opacity-90';

  // ── Fixed mobile/tablet footer (steps 0–1 only; form steps handle their own) ─
  const mobileFooter = step <= 1 ? (
    <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden px-4 pb-5 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent">
      <div className="flex gap-3 max-w-lg mx-auto">
        {step > 0 && (
          <button type="button" onClick={back} className={btnBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          onClick={groupNeedsContact ? contactForGroup : next}
          className={btnFwd}
        >
          {groupNeedsContact ? 'Contact Us' : 'Continue'}
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  ) : null;

  // Desktop inline footer for steps 0–1
  const desktopFooter = step <= 1 ? (
    <div className="hidden lg:flex gap-3 mt-8">
      {step > 0 && (
        <button type="button" onClick={back} className={btnBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
      <button
        type="button"
        onClick={groupNeedsContact ? contactForGroup : next}
        className={btnFwd}
        style={{ maxWidth: '18rem' }}
      >
        {groupNeedsContact ? 'Contact Us' : 'Continue'}
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar showBack />

      <div className="mx-auto max-w-6xl px-4 md:px-8 pt-24 md:pt-28 pb-36 lg:pb-16">
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-16 lg:items-start">

          {/* ── Left: step content ───────────────────────────────────────── */}
          <div className="max-w-lg lg:max-w-none">
            <StepProgress step={step} />

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20, filter: 'blur(6px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -20, filter: 'blur(6px)' }}
                transition={{ duration: 0.4, ease: EASE }}
              >

                {/* ───────────── STEP 0: Goal ─────────────────────────── */}
                {step === 0 && (
                  <>
                    <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] text-foreground">
                      What do you need today?
                    </h1>
                    <p className="mt-4 font-body text-sm leading-relaxed text-foreground/55">
                      Choose your goal and we'll take care of the rest.
                    </p>
                    <div className="mt-7 space-y-3">
                      {GOALS.map(item => (
                        <div key={item.key} className="space-y-3">
                          <OptionCard
                            active={goal.key === item.key}
                            icon={item.icon}
                            title={item.label}
                            sub={item.sub}
                            onClick={() => {
                              setGoal(item);
                              const match = IV_SESSIONS.find(s => s.category === item.category);
                              if (match) {
                                setProtocol(match);
                                setSelectedDose(match.doses?.[0] ?? null);
                              }
                              if (item.key === 'event') {
                                setProtocol(LOCATIONS.find(l => l.key === 'event') || protocol);
                              }
                            }}
                          />
                          {/* Group size expander */}
                          <AnimatePresence>
                            {goal.key === 'event' && item.key === 'event' && (
                              <motion.div
                                initial={{ opacity: 0, y: -8, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -8, height: 0 }}
                                transition={{ duration: 0.32, ease: EASE }}
                                className="overflow-hidden rounded-2xl border border-foreground/[0.10] bg-card/[0.78] p-4"
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <p className="font-body text-sm font-semibold text-foreground">How many people?</p>
                                    <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/45">We can book up to 4 guests here.</p>
                                  </div>
                                  <span className="font-heading text-3xl text-foreground">{groupSize > 4 ? '5+' : groupSize}</span>
                                </div>
                                <div className="mt-4 grid grid-cols-5 gap-2">
                                  {[1, 2, 3, 4, 5].map(n => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => setGroupSize(n)}
                                      className={`h-11 rounded-xl border font-body text-xs font-semibold transition-all ${
                                        groupSize === n
                                          ? 'border-foreground bg-foreground text-background'
                                          : 'border-foreground/[0.10] bg-background text-foreground/60'
                                      }`}
                                    >
                                      {n === 5 ? '5+' : n}
                                    </button>
                                  ))}
                                </div>
                                <p className={`mt-4 rounded-xl px-3 py-3 font-body text-[11px] leading-relaxed ${
                                  groupSize > 4 ? 'bg-foreground text-background' : 'bg-foreground/[0.04] text-foreground/50'
                                }`}>
                                  {groupSize > 4
                                    ? 'For groups over 4, contact us directly so we can staff the visit and coordinate timing.'
                                    : 'For 1–4 people, continue here and choose your visit details.'}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                    {desktopFooter}
                  </>
                )}

                {/* ───────────── STEP 1: Protocol + Add-ons ─────────── */}
                {step === 1 && (
                  <>
                    <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] text-foreground">
                      Choose your protocol
                    </h1>
                    <p className="mt-4 font-body text-sm leading-relaxed text-foreground/55">
                      Clinician designed. Results driven.
                    </p>

                    {/* Protocol list */}
                    <div className="mt-7 space-y-3">
                      {recommendedProtocols.map(item => (
                        <div key={item.key}>
                          <OptionCard
                            active={protocol.key === item.key}
                            icon={item.icon}
                            title={item.label}
                            sub={item.tagline}
                            meta={item.doses ? `From $${item.doses[0].price}` : `$${item.price}`}
                            onClick={() => {
                              setProtocol(item);
                              setSelectedDose(item.doses?.[0] ?? null);
                              setExpandedProtocol(expandedProtocol === item.key ? null : item.key);
                            }}
                          />
                          {/* Dose selector for tiered sessions */}
                          <AnimatePresence>
                            {protocol.key === item.key && item.doses && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.32, ease: EASE }}
                                className="overflow-hidden"
                              >
                                <div className="mx-1 rounded-b-2xl border border-t-0 border-foreground/[0.08] bg-foreground/[0.03] px-4 pb-4 pt-3">
                                  <p className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/35 mb-2">Select dose</p>
                                  <div className="flex flex-wrap gap-2">
                                    {item.doses.map(dose => {
                                      const active = selectedDose?.key === dose.key;
                                      return (
                                        <button
                                          key={dose.key}
                                          type="button"
                                          onClick={() => setSelectedDose(dose)}
                                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-body text-xs transition-all ${
                                            active
                                              ? 'border-foreground bg-foreground text-background'
                                              : 'border-foreground/[0.12] text-foreground/60 hover:border-foreground/30'
                                          }`}
                                        >
                                          <span className="font-semibold">{dose.label}</span>
                                          <span className={active ? 'text-background/55' : 'text-foreground/35'}>${dose.price.toLocaleString()}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {item.inside && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {item.inside.split(' · ').map(ing => (
                                        <span key={ing} className="rounded-full border border-foreground/[0.10] bg-foreground/[0.04] px-2.5 py-1 font-body text-[10px] text-foreground/60">
                                          {ing.trim()}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {/* Ingredient expander for non-dose sessions */}
                          <AnimatePresence>
                            {expandedProtocol === item.key && !item.doses && item.inside && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.32, ease: EASE }}
                                className="overflow-hidden"
                              >
                                <div className="mx-1 rounded-b-2xl border border-t-0 border-foreground/[0.08] bg-foreground/[0.03] px-4 pb-4 pt-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.inside.split(' · ').map(ing => (
                                      <span key={ing} className="rounded-full border border-foreground/[0.10] bg-foreground/[0.04] px-2.5 py-1 font-body text-[10px] text-foreground/60">
                                        {ing.trim()}
                                      </span>
                                    ))}
                                  </div>
                                  <Link to={`/therapies/${item.key}`} className="mt-3 inline-flex items-center gap-1 font-body text-[10px] tracking-[0.18em] uppercase text-foreground/45 hover:text-foreground transition-colors">
                                    Full details <ArrowRight className="h-3 w-3" strokeWidth={2} />
                                  </Link>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                      <OptionCard
                        active={false}
                        icon={SlidersHorizontal}
                        title="Custom Protocol"
                        sub="Tell us your goals and we'll build it."
                        onClick={() => navigate('/custom')}
                      />
                    </div>

                    {/* Add-ons section */}
                    <div className="mt-8">
                      <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/35 mb-4">
                        Enhance Your Visit
                      </p>
                      <div className="space-y-3">
                        {ADDON_GROUPS.map(group => (
                          <AddonGroup
                            key={group.key}
                            group={group}
                            selected={addons}
                            open={openAddonGroups[group.key]}
                            onToggleOpen={() => toggleAddonGroup(group.key)}
                            onToggleAddon={toggleAddon}
                          />
                        ))}
                      </div>
                    </div>

                    {desktopFooter}
                  </>
                )}

                {/* ───────────── STEP 2: Schedule (Acuity) ──────────── */}
                {step === 2 && (
                  <>
                    <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] text-foreground">
                      When & where?
                    </h1>
                    <p className="mt-4 font-body text-sm leading-relaxed text-foreground/55">
                      Real-time availability. Same-day often open.
                    </p>

                    <div className="mt-7 space-y-5">
                      {/* Address */}
                      <div>
                        <label className={labelCls}>Service Address *</label>
                        <input
                          value={appointment?.address ?? ''}
                          onChange={e => setAppointment(a => ({ ...a, address: e.target.value }))}
                          placeholder="123 Main St, San Francisco, CA"
                          className={fieldCls}
                        />
                      </div>

                      {/* ZIP */}
                      <div>
                        <label className={labelCls}>ZIP Code *</label>
                        <input
                          value={appointment?.zip ?? ''}
                          onChange={e => setAppointment(a => ({ ...a, zip: e.target.value }))}
                          inputMode="numeric"
                          maxLength={5}
                          placeholder="94103"
                          className={fieldCls}
                        />
                        {appointment?.zip?.length === 5 && !COVERED_ZIPS.has(appointment.zip) && (
                          <p className={errCls}>Outside our current service area. <Link to="/service-area" className="underline">View coverage</Link></p>
                        )}
                      </div>

                      {/* Date */}
                      <div>
                        <label className={labelCls}>Select Date *</label>
                        <input
                          type="date"
                          value={appointment?.date ?? ''}
                          min={todayString()}
                          onChange={e => {
                            setAppointment(a => ({ ...a, date: e.target.value }));
                            if (e.target.value) fetchSlots(e.target.value);
                          }}
                          className={fieldCls}
                        />
                      </div>

                      {/* Acuity time slots */}
                      <AnimatePresence>
                        {appointment?.date && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.35, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <label className={labelCls}>Available Times</label>

                            {slotsLoading && (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                  <div key={i} className="h-10 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                                ))}
                              </div>
                            )}

                            {slotsError && (
                              <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 flex items-center justify-between gap-3">
                                <p className="font-body text-xs text-red-400">{slotsError}</p>
                                <button type="button" onClick={() => fetchSlots(appointment.date)} className="flex items-center gap-1.5 font-body text-[10px] uppercase text-foreground/50 hover:text-foreground transition-colors shrink-0">
                                  <RefreshCw className="w-3 h-3" strokeWidth={2} /> Retry
                                </button>
                              </div>
                            )}

                            {!slotsLoading && !slotsError && slots.length === 0 && appointment?.date && (
                              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <Calendar className="w-4 h-4 text-foreground/35 shrink-0" strokeWidth={1.5} />
                                  <p className="font-body text-xs text-foreground/50">No availability on this date.</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={nextAvailLoading}
                                  onClick={async () => {
                                    const next = await findNextAvailable(appointment.date);
                                    if (next) {
                                      setAppointment(a => ({ ...a, date: next }));
                                    }
                                  }}
                                  className="flex items-center gap-1.5 font-body text-[10px] uppercase text-accent hover:text-accent/70 transition-colors shrink-0 disabled:opacity-50"
                                >
                                  {nextAvailLoading ? <><Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} /> Searching…</> : <><RefreshCw className="w-3 h-3" strokeWidth={2} /> Next Available</>}
                                </button>
                              </div>
                            )}

                            {!slotsLoading && slots.length > 0 && (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {slots.map(slot => {
                                  const label  = formatTimeLabel(slot.time);
                                  const active = selectedSlot?.datetime === slot.time;
                                  return (
                                    <button
                                      key={slot.time}
                                      type="button"
                                      onClick={() => setSelectedSlot({ appointmentTypeID: ACUITY_TYPE_ID, datetime: slot.time, date: appointment.date, timeLabel: label, timezone: TZ })}
                                      className={`py-2.5 rounded-xl font-body text-[11px] tracking-wide transition-all duration-200 ${
                                        active
                                          ? 'bg-accent text-background shadow-[0_0_10px_-2px_hsl(var(--accent)/0.5)]'
                                          : 'border border-foreground/[0.12] text-foreground/70 hover:border-accent/50 hover:text-foreground'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Notes */}
                      <div>
                        <label className={labelCls}>Notes for your RN <span className="normal-case text-foreground/30">(optional)</span></label>
                        <textarea
                          rows={2}
                          value={appointment?.notes ?? ''}
                          onChange={e => setAppointment(a => ({ ...a, notes: e.target.value }))}
                          placeholder="Preferences, access notes, anything we should know…"
                          className={`${fieldCls} resize-none`}
                        />
                      </div>
                    </div>

                    {/* Schedule step buttons */}
                    <div className="flex gap-3 mt-8 mb-4">
                      <button type="button" onClick={back} className={btnBack} aria-label="Back">
                        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!appointment?.address || !appointment?.zip || !appointment?.date || !selectedSlot) return;
                          next();
                        }}
                        disabled={!appointment?.address || !appointment?.zip || !appointment?.date || !selectedSlot}
                        className={`${btnFwd} disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        Continue
                        <ArrowRight className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                    {!selectedSlot && appointment?.date && slots.length > 0 && (
                      <p className="font-body text-[10px] text-foreground/35 text-center">Select a time slot to continue</p>
                    )}
                  </>
                )}

                {/* ───────────── STEP 3: About You ──────────────────── */}
                {step === 3 && (
                  <>
                    <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] text-foreground">
                      About you
                    </h1>
                    <p className="mt-4 font-body text-sm leading-relaxed text-foreground/55">
                      Contact info and a quick health screen. Required before every visit.
                    </p>

                    <form
                      onSubmit={aboutForm.handleSubmit(data => {
                        setContact({ firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone });
                        setAppointment(a => ({
                          ...a,
                          dob: data.dob, guests: data.guests,
                          covidPositive: data.covidPositive, infectiousDisease: data.infectiousDisease,
                          ivBefore: data.ivBefore, medicalConditions: data.medicalConditions,
                          allergies: data.allergies, medications: data.medications,
                          emergencyContact: data.emergencyContact,
                          acuitySlot: selectedSlot,
                        }));
                        next();
                      })}
                      className="mt-7 space-y-5"
                    >
                      {/* Contact */}
                      <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/35">Contact</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>First Name *</label>
                          <input {...aboutForm.register('firstName', { required: 'Required' })} placeholder="First" className={fieldCls} />
                          {aboutForm.formState.errors.firstName && <p className={errCls}>{aboutForm.formState.errors.firstName.message}</p>}
                        </div>
                        <div>
                          <label className={labelCls}>Last Name *</label>
                          <input {...aboutForm.register('lastName', { required: 'Required' })} placeholder="Last" className={fieldCls} />
                          {aboutForm.formState.errors.lastName && <p className={errCls}>{aboutForm.formState.errors.lastName.message}</p>}
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Email *</label>
                        <input type="email" inputMode="email" {...aboutForm.register('email', { required: 'Required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Valid email required' } })} placeholder="you@example.com" className={fieldCls} />
                        {aboutForm.formState.errors.email && <p className={errCls}>{aboutForm.formState.errors.email.message}</p>}
                      </div>
                      <div>
                        <label className={labelCls}>Phone *</label>
                        <input type="tel" inputMode="tel" {...aboutForm.register('phone', { required: 'Required' })} placeholder="+1 (415) 000-0000" className={fieldCls} />
                        {aboutForm.formState.errors.phone && <p className={errCls}>{aboutForm.formState.errors.phone.message}</p>}
                      </div>

                      {/* Health info */}
                      <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/35 pt-2">Health Info</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Date of Birth *</label>
                          <input type="date" {...aboutForm.register('dob', { required: 'Required' })} className={fieldCls} />
                          {aboutForm.formState.errors.dob && <p className={errCls}>{aboutForm.formState.errors.dob.message}</p>}
                        </div>
                        <div>
                          <label className={labelCls}>Guests *</label>
                          <select {...aboutForm.register('guests', { required: true })} className={fieldCls}>
                            {['1', '2', '3', '4', '5+'].map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Medical Conditions *</label>
                        <select {...aboutForm.register('medicalConditions', { required: true })} className={fieldCls}>
                          {['None of the above', 'Allergies', 'Active Viral or Bacterial infection', 'Diabetes (Type I or II)', 'Heart Disease', 'Kidney Problems', 'Liver Problems', 'Pregnancy/Breastfeeding', 'Other symptoms or medical conditions not listed above'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[['covidPositive', 'Covid last 14 days?'], ['infectiousDisease', 'Infectious disease?'], ['ivBefore', 'IV before?']].map(([name, lbl]) => (
                          <div key={name}>
                            <label className={labelCls}>{lbl}</label>
                            <select {...aboutForm.register(name, { required: true })} className={fieldCls}>
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className={labelCls}>Allergies / Sensitivities</label>
                        <textarea {...aboutForm.register('allergies')} rows={2} placeholder="None, or list details" className={`${fieldCls} resize-none`} />
                      </div>
                      <div>
                        <label className={labelCls}>Medications / Supplements</label>
                        <textarea {...aboutForm.register('medications')} rows={2} placeholder="None, or list details" className={`${fieldCls} resize-none`} />
                      </div>
                      <div>
                        <label className={labelCls}>Emergency Contact *</label>
                        <input {...aboutForm.register('emergencyContact', { required: 'Required' })} placeholder="Name + phone" className={fieldCls} />
                        {aboutForm.formState.errors.emergencyContact && <p className={errCls}>{aboutForm.formState.errors.emergencyContact.message}</p>}
                      </div>

                      {/* Consent */}
                      <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] overflow-hidden">
                        <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/35 px-4 pt-4 pb-3">
                          Acknowledgments — all required
                        </p>
                        {[
                          { name: 'privacyAck',       text: 'I consent to Avalon Vitality collecting and using my health information to coordinate and deliver my requested wellness services, in accordance with applicable privacy laws and the Avalon Privacy Policy.' },
                          { name: 'treatmentConsent', text: 'I understand that IV therapy and intramuscular injections are wellness support services, not medical treatments. Individual responses vary. Potential side effects include bruising, discomfort at the infusion site, or adverse reactions. I have disclosed all known health conditions and medications above.' },
                          { name: 'generalConsent',   text: "I have read, understand, and agree to Avalon Vitality's Terms of Service and Consent & Waiver. I confirm I am at least 18 years of age, and that the information I have provided is accurate." },
                        ].map(({ name, text }, i) => (
                          <label key={name} className={`flex gap-3 px-4 py-3.5 font-body text-xs leading-relaxed text-foreground/65 cursor-pointer hover:bg-foreground/[0.02] transition-colors ${i > 0 ? 'border-t border-foreground/[0.06]' : ''}`}>
                            <input type="checkbox" {...aboutForm.register(name, { required: true })} className="mt-0.5 h-4 w-4 shrink-0 accent-foreground" />
                            <span>{text}</span>
                          </label>
                        ))}
                        {(aboutForm.formState.errors.privacyAck || aboutForm.formState.errors.treatmentConsent || aboutForm.formState.errors.generalConsent) && (
                          <p className={`${errCls} px-4 pb-3`}>All three acknowledgments are required.</p>
                        )}
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-3 pt-2 pb-4">
                        <button type="button" onClick={back} className={btnBack} aria-label="Back">
                          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button type="submit" className={btnFwd}>
                          Continue
                          <ArrowRight className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </form>
                  </>
                )}

                {/* ───────────── STEP 4: Confirm & Pay ─────────────── */}
                {step === 4 && (
                  <>
                    <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl uppercase leading-[0.9] text-foreground">
                      Review & confirm
                    </h1>
                    <p className="mt-4 font-body text-sm leading-relaxed text-foreground/55">
                      A $50 deposit is collected now. The balance is authorized after your visit.
                    </p>

                    <div className="mt-7 space-y-4">

                      {/* Order */}
                      <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4 space-y-3">
                        <p className={`${labelCls} !mb-0`}>Order</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Droplets className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={1.5} />
                            <span className="font-body text-sm text-foreground">
                              {protocol.label}{selectedDose ? ` · ${selectedDose.label}` : ''}
                            </span>
                          </div>
                          <span className="font-body text-sm font-semibold text-foreground">${protocolPrice.toLocaleString()}</span>
                        </div>
                        {selectedAddons.map(addon => (
                          <div key={addon.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Syringe className="w-3.5 h-3.5 text-foreground/25 shrink-0" strokeWidth={1.5} />
                              <span className="font-body text-sm text-foreground/70">{addon.label}</span>
                            </div>
                            <span className="font-body text-sm text-foreground/70">+${addon.price}</span>
                          </div>
                        ))}
                        <div className="border-t border-foreground/[0.08] pt-3 flex items-center justify-between">
                          <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/35">Subtotal</span>
                          <span className="font-heading text-2xl text-foreground">${subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-body text-[10px] tracking-[0.2em] uppercase text-accent">Due now (deposit)</span>
                          <span className="font-heading text-xl text-accent">$50</span>
                        </div>
                      </div>

                      {/* Appointment summary */}
                      {appointment?.address && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
                            <p className={`${labelCls} !mb-1`}>Appointment</p>
                            <p className="font-body text-xs text-foreground">{appointment.address}</p>
                            {selectedSlot && (
                              <p className="font-body text-[10px] text-foreground/45 mt-0.5">
                                {appointment.date} · {selectedSlot.timeLabel}
                              </p>
                            )}
                          </div>
                          {contact && (
                            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
                              <p className={`${labelCls} !mb-1`}>Contact</p>
                              <p className="font-body text-xs text-foreground">{contact.firstName} {contact.lastName}</p>
                              <p className="font-body text-[10px] text-foreground/45 mt-0.5">{contact.email}</p>
                              <p className="font-body text-[10px] text-foreground/45">{contact.phone}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Error */}
                      {checkoutError && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                          <p className="font-body text-xs text-red-400">{checkoutError}</p>
                        </div>
                      )}

                      {/* Buttons */}
                      <div className="flex gap-3 pt-2 pb-4">
                        <button type="button" onClick={back} className={btnBack} aria-label="Back">
                          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCheckout}
                          disabled={checkoutLoading}
                          className={`${btnConfirm} disabled:opacity-50`}
                        >
                          {checkoutLoading ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> Redirecting…
                            </span>
                          ) : (
                            <>Confirm Booking — $50 Deposit <CreditCard className="h-4 w-4" strokeWidth={2} /></>
                          )}
                        </button>
                      </div>

                      <p className="font-body text-[10px] text-center text-foreground/25 tracking-wide pb-2">
                        Secure checkout · Balance authorized after visit completion
                      </p>
                    </div>
                  </>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Right: Order summary sidebar (desktop lg+) ────────── */}
          <div>
            <OrderSidebar
              protocol={protocol}
              selectedDose={selectedDose}
              addons={selectedAddons}
              step={step}
              subtotal={subtotal}
            />
          </div>

        </div>
      </div>

      {/* Mobile/tablet fixed footer (steps 0–1 only) */}
      {mobileFooter}
    </div>
  );
}
