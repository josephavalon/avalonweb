import React, { useState, useMemo, useEffect } from 'react';
import { track } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Check, X, ChevronDown,
  Heart, Zap, Sparkles, Droplets, Syringe,
  CheckCircle2, Package, Clock, MapPin,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/context/CartContext';
import {
  IV_SESSIONS as SESSIONS,
  IV_ADDONS,
  IM_SHOTS,
  PACKAGES,
} from '@/config/verticals';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

/* ─── Goal definitions (rule of 3 + browse all) ─────────────── */
const GOALS = [
  { key: 'recover',  label: 'Recover',  icon: Heart,    cat: 'recovery' },
  { key: 'energize', label: 'Energize', icon: Zap,      cat: 'energy'   },
  { key: 'glow',     label: 'Glow',     icon: Sparkles, cat: 'beauty'   },
];

/* ─── Checkout Sheet ─────────────────────────────────────────── */
function CheckoutSheet({ cart, onRemove, onClose, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  const refNumber = useMemo(
    () => `AV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    [],
  );
  const total = cart.reduce((s, i) => s + i.price, 0);

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.45, ease: EASE }}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
      style={{ maxHeight: '80vh' }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10"
        onClick={onClose}
      />
      <div className="relative bg-background/95 backdrop-blur-2xl border-t border-foreground/10 rounded-t-3xl flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex flex-col px-6 pt-8 pb-8 items-center text-center gap-5"
            >
              <CheckCircle2 className="w-12 h-12 text-accent" strokeWidth={1.5} />
              <div>
                <p className="font-heading text-3xl text-foreground tracking-wide mb-2">Request Received</p>
                <p className="font-body text-sm text-foreground/60 leading-relaxed max-w-xs mx-auto">
                  Your nurse will confirm within 15 minutes. Expect arrival within 90 minutes.
                </p>
              </div>
              <div className="w-full space-y-1.5 border border-foreground/[0.08] rounded-2xl p-4 bg-foreground/[0.02]">
                {cart.map((item) => (
                  <div key={item.cartKey} className="flex items-center justify-between">
                    <span className="font-body text-xs text-foreground/70">{item.label}</span>
                    <span className="font-body text-xs text-foreground">${item.price.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-foreground/[0.06] pt-2 mt-2">
                  <span className="font-body text-xs font-semibold text-foreground/60">Total</span>
                  <span className="font-body text-sm font-semibold text-foreground">${total.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-1 text-center">
                <p className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40">Ref: {refNumber}</p>
                <p className="font-body text-[10px] text-foreground/40">Today · 90-min arrival window</p>
              </div>
              <button
                type="button"
                onClick={() => { onConfirm?.(); onClose(); }}
                className="w-full py-4 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/85 transition-colors"
              >
                Done
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="cart"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-foreground/[0.08]">
                <div>
                  <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-0.5">Your Visit</p>
                  <p className="font-heading text-2xl text-foreground tracking-wide">
                    {cart.length} Item{cart.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="p-2 rounded-full border border-foreground/10 text-foreground/50 hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
                {cart.map((item) => (
                  <div key={item.cartKey} className="flex items-center gap-3 py-2.5 border-b border-foreground/[0.06]">
                    <div className="p-1.5 rounded-lg bg-foreground/[0.06] shrink-0">
                      {item.type === 'im'
                        ? <Syringe className="w-3.5 h-3.5 text-foreground/60" strokeWidth={1.5} />
                        : <Droplets className="w-3.5 h-3.5 text-foreground/60" strokeWidth={1.5} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-xs text-foreground truncate">{item.label}</p>
                      <p className="font-body text-[10px] text-foreground/40">
                        {item.type === 'im' ? '/ shot' : '/ session'}
                      </p>
                    </div>
                    <span className="font-body text-sm font-medium text-foreground shrink-0">${item.price.toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(item.cartKey)}
                      className="p-1 text-foreground/30 hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-6 pt-4 pb-6 border-t border-foreground/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-body text-sm text-foreground/50">Visit Total</p>
                  <p className="font-heading text-2xl text-foreground tracking-tight">${total.toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmed(true)}
                  className="flex items-center justify-center gap-2 w-full py-4 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/85 transition-colors"
                >
                  Request Appointment <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </button>
                <p className="font-body text-[10px] text-center text-foreground/30 tracking-wide">
                  No charge until your RN confirms availability.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─── Picker Row — glass accordion section ───────────────────── */
function PickerRow({ label, value, open, onToggle, children }) {
  return (
    <div className="border-t border-foreground/[0.07] first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        {/* Dark circle marker */}
        <div className="w-8 h-8 rounded-full bg-foreground/[0.08] border border-foreground/[0.14] flex items-center justify-center shrink-0">
          <div className={`w-2 h-2 rounded-full transition-colors ${open ? 'bg-foreground' : 'bg-foreground/25'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-0.5">{label}</p>
          <p className="font-body text-sm tracking-[0.03em] text-foreground truncate">{value}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-foreground/35 transition-transform duration-300 shrink-0 ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-foreground/[0.07]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function Store() {
  useSeo({
    title: 'Book Mobile IV Therapy — Avalon Vitality',
    description: 'Browse IV drip protocols and book a licensed RN to your location in the San Francisco Bay Area.',
    path: '/store',
  });

  const { items: cart, addItem, removeItem, clearItems: clearCart } = useCart();
  const [searchParams] = useSearchParams();

  /* ── Accordion state ── */
  const [goalOpen,    setGoalOpen]    = useState(false);
  const [therapyOpen, setTherapyOpen] = useState(false);
  const [enhOpen,     setEnhOpen]     = useState(false);
  const [pkgOpen,     setPkgOpen]     = useState(false);

  /* ── Selections ── */
  const [selectedGoal, setSelectedGoal] = useState(null); // null = browse all
  const [selectedKey,  setSelectedKey]  = useState(SESSIONS[0].key);
  const [ivSelected,   setIvSelected]   = useState(new Set());
  const [imSelected,   setImSelected]   = useState(new Set());
  const [detailOpen,   setDetailOpen]   = useState(false); // ingredient reveal

  /* ── Purchase type ── */
  const [purchaseType, setPurchaseType] = useState('one-time');

  /* ── Checkout ── */
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  /* Auto-open checkout from URL param */
  useEffect(() => {
    if (searchParams.get('checkout') === '1' && cart.length > 0) {
      setCheckoutOpen(true);
    }
  }, [searchParams, cart.length]);

  /* ── Derived values ── */
  const goal = GOALS.find((g) => g.key === selectedGoal) ?? null;

  const filteredSessions = useMemo(
    () => (selectedGoal && goal ? SESSIONS.filter((s) => s.category === goal.cat) : SESSIONS),
    [selectedGoal, goal],
  );

  const session  = SESSIONS.find((s) => s.key === selectedKey) ?? SESSIONS[0];
  const selIV    = IV_ADDONS.filter((a) => ivSelected.has(a.label));
  const selIM    = IM_SHOTS.filter((s) => imSelected.has(s.label));
  const enhTotal = selIV.reduce((s, x) => s + x.price, 0) + selIM.reduce((s, x) => s + x.price, 0);
  const visitTotal = session.price + enhTotal;

  const enhValue = (() => {
    const n = ivSelected.size + imSelected.size;
    if (n === 0) return 'None';
    return `${n} selected · +$${enhTotal}`;
  })();

  /* ── Helpers ── */
  const closeAll = () => {
    setGoalOpen(false);
    setTherapyOpen(false);
    setEnhOpen(false);
  };

  const toggleIV = (label) =>
    setIvSelected((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });

  const toggleIM = (label) =>
    setImSelected((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });

  const handleBook = () => {
    if (!cart.some((i) => i.cartKey === session.key))
      addItem({ cartKey: session.key, label: session.label, price: session.price, type: 'iv' });
    selIV.forEach((a) => {
      if (!cart.some((i) => i.cartKey === `iv-${a.label}`))
        addItem({ cartKey: `iv-${a.label}`, label: a.label, price: a.price, type: 'addon' });
    });
    selIM.forEach((s) => {
      if (!cart.some((i) => i.cartKey === `im-${s.label}`))
        addItem({ cartKey: `im-${s.label}`, label: `IM · ${s.label}`, price: s.price, type: 'im' });
    });
    track('checkout_opened', { session: session.key, enhancements: ivSelected.size + imSelected.size });
    setCheckoutOpen(true);
  };

  const handleAddPackage = (pkg) => {
    pkg.items.forEach((item) => {
      if (!cart.some((i) => i.cartKey === item.cartKey)) addItem(item);
    });
    track('package_added', { package: pkg.key });
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-lg mx-auto px-5 pt-28 pb-36 space-y-3">

        {/* ── Trust bar (rule of 3) ─────────────────────────────── */}
        <div className="flex items-center justify-center py-3">
          <span className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45">RN</span>
          <div className="w-px h-3 bg-foreground/20 mx-4" />
          <span className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45">Clinical</span>
          <div className="w-px h-3 bg-foreground/20 mx-4" />
          <span className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45">SF Bay Area</span>
        </div>

        {/* ── Main 3-picker accordion ───────────────────────────── */}
        <div className="rounded-2xl border border-foreground/[0.10] bg-white/[0.04] backdrop-blur-xl overflow-hidden">

          {/* ── GOAL ── */}
          <PickerRow
            label="GOAL"
            value={goal ? goal.label : 'All Therapies'}
            open={goalOpen}
            onToggle={() => { setGoalOpen((v) => !v); setTherapyOpen(false); setEnhOpen(false); }}
          >
            {GOALS.map((g, idx) => {
              const isActive = selectedGoal === g.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => {
                    const newGoal = isActive ? null : g.key;
                    setSelectedGoal(newGoal);
                    // If current session doesn't fit the new goal, reset to first match
                    if (newGoal) {
                      const goalDef = GOALS.find((x) => x.key === newGoal);
                      const fits = SESSIONS.filter((s) => s.category === goalDef?.cat);
                      if (fits.length > 0 && !fits.some((s) => s.key === selectedKey)) {
                        setSelectedKey(fits[0].key);
                        setDetailOpen(false);
                      }
                    }
                    setGoalOpen(false);
                    setTherapyOpen(true);
                    track('goal_selected', { goal: newGoal });
                  }}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    idx > 0 ? 'border-t border-foreground/[0.05]' : ''
                  } ${isActive ? 'bg-foreground/[0.07]' : 'hover:bg-foreground/[0.03]'}`}
                >
                  <g.icon
                    className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-foreground' : 'text-foreground/30'}`}
                    strokeWidth={1.5}
                  />
                  <span className={`flex-1 font-body text-sm tracking-[0.04em] transition-colors ${isActive ? 'text-foreground font-medium' : 'text-foreground/60'}`}>
                    {g.label}
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-foreground shrink-0" strokeWidth={2.5} />}
                </button>
              );
            })}
            {/* Browse all */}
            <button
              type="button"
              onClick={() => { setSelectedGoal(null); setGoalOpen(false); setTherapyOpen(true); }}
              className={`w-full flex items-center gap-3 px-5 py-3.5 border-t border-foreground/[0.05] transition-colors ${
                !selectedGoal ? 'bg-foreground/[0.07]' : 'hover:bg-foreground/[0.03]'
              }`}
            >
              <Droplets
                className={`w-4 h-4 shrink-0 ${!selectedGoal ? 'text-foreground' : 'text-foreground/30'}`}
                strokeWidth={1.5}
              />
              <span className={`flex-1 font-body text-sm tracking-[0.04em] ${!selectedGoal ? 'text-foreground font-medium' : 'text-foreground/60'}`}>
                Browse All
              </span>
              {!selectedGoal && <Check className="w-3.5 h-3.5 text-foreground shrink-0" strokeWidth={2.5} />}
            </button>
          </PickerRow>

          {/* ── THERAPY ── */}
          <PickerRow
            label="THERAPY"
            value={session.label}
            open={therapyOpen}
            onToggle={() => { setTherapyOpen((v) => !v); setGoalOpen(false); setEnhOpen(false); }}
          >
            {filteredSessions.map((s, idx) => {
              const isSelected = selectedKey === s.key;
              return (
                <div key={s.key}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        // Second tap on selected row → toggle ingredient detail
                        setDetailOpen((v) => !v);
                      } else {
                        setSelectedKey(s.key);
                        setDetailOpen(false);
                        setTherapyOpen(false);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors ${
                      idx > 0 ? 'border-t border-foreground/[0.05]' : ''
                    } ${isSelected ? 'bg-foreground/[0.06]' : 'hover:bg-foreground/[0.03]'}`}
                  >
                    <s.icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isSelected ? 'text-foreground' : s.elite ? 'text-accent/40' : 'text-foreground/30'
                      }`}
                      strokeWidth={1.5}
                    />
                    <span className={`flex-1 font-body text-sm tracking-[0.04em] transition-colors ${isSelected ? 'text-foreground font-medium' : 'text-foreground/60'}`}>
                      {s.label}
                    </span>
                    {s.popular && !isSelected && (
                      <span className="font-body text-[8px] tracking-[0.2em] uppercase text-accent/60 border border-accent/20 px-1.5 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                    <span className={`font-body text-sm shrink-0 transition-colors ${isSelected ? 'text-foreground font-semibold' : 'text-foreground/40'}`}>
                      ${s.price}
                    </span>
                    {/* Chevron only on selected row to hint at detail expansion */}
                    {isSelected && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-foreground/35 transition-transform duration-200 shrink-0 ${detailOpen ? 'rotate-180' : ''}`}
                        strokeWidth={1.5}
                      />
                    )}
                  </button>

                  {/* ── Ingredient detail sub-row ── */}
                  <AnimatePresence initial={false}>
                    {isSelected && detailOpen && s.inside && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="px-5 pb-4 pt-3 border-t border-foreground/[0.05] bg-foreground/[0.015] space-y-2">
                          <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35">Formulated with</p>
                          <div className="flex flex-wrap gap-1.5">
                            {s.inside.split(' · ').map((ing) => (
                              <span
                                key={ing}
                                className="font-body text-[10px] text-foreground/60 bg-foreground/[0.05] border border-foreground/[0.08] px-2.5 py-1 rounded-full"
                              >
                                {ing}
                              </span>
                            ))}
                          </div>
                          <p className="font-body text-[9px] text-foreground/25 leading-relaxed pt-1">
                            For educational purposes. Formulation may vary based on clinical assessment.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </PickerRow>

          {/* ── ENHANCEMENTS ── */}
          <PickerRow
            label="ENHANCEMENTS"
            value={enhValue}
            open={enhOpen}
            onToggle={() => { setEnhOpen((v) => !v); setGoalOpen(false); setTherapyOpen(false); }}
          >
            {/* IV Bag Add-ons */}
            {IV_ADDONS.map((addon, idx) => {
              const sel = ivSelected.has(addon.label);
              return (
                <button
                  key={addon.label}
                  type="button"
                  onClick={() => toggleIV(addon.label)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    idx > 0 ? 'border-t border-foreground/[0.05]' : ''
                  } ${sel ? 'bg-foreground/[0.06]' : 'hover:bg-foreground/[0.03]'}`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${sel ? 'bg-foreground border-foreground' : 'border-foreground/20'}`}>
                    {sel && <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />}
                  </div>
                  <span className={`flex-1 font-body text-sm tracking-[0.04em] transition-colors ${sel ? 'text-foreground font-medium' : 'text-foreground/60'}`}>
                    {addon.label}
                  </span>
                  <span className={`font-body text-sm shrink-0 transition-colors ${sel ? 'text-foreground font-semibold' : 'text-foreground/40'}`}>
                    +${addon.price}
                  </span>
                </button>
              );
            })}

            {/* IM Shots divider */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-t border-foreground/[0.05] bg-foreground/[0.01]">
              <Syringe className="w-3 h-3 text-foreground/25" strokeWidth={1.5} />
              <span className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/25">IM Shots</span>
            </div>

            {/* IM Shots */}
            {IM_SHOTS.map((shot) => {
              const sel = imSelected.has(shot.label);
              return (
                <button
                  key={shot.label}
                  type="button"
                  onClick={() => toggleIM(shot.label)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 border-t border-foreground/[0.05] transition-colors ${sel ? 'bg-foreground/[0.06]' : 'hover:bg-foreground/[0.03]'}`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${sel ? 'bg-foreground border-foreground' : 'border-foreground/20'}`}>
                    {sel && <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />}
                  </div>
                  <span className={`flex-1 font-body text-sm tracking-[0.04em] transition-colors ${sel ? 'text-foreground font-medium' : 'text-foreground/60'}`}>
                    {shot.label}
                  </span>
                  <span className={`font-body text-sm shrink-0 transition-colors ${sel ? 'text-foreground font-semibold' : 'text-foreground/40'}`}>
                    +${shot.price}
                  </span>
                </button>
              );
            })}
          </PickerRow>
        </div>

        {/* ── Purchase type toggle ──────────────────────────────── */}
        <div className="flex rounded-2xl border border-foreground/[0.10] bg-white/[0.04] backdrop-blur-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setPurchaseType('one-time')}
            className={`flex-1 py-3.5 font-body text-[10px] tracking-[0.2em] uppercase font-semibold transition-all ${
              purchaseType === 'one-time'
                ? 'bg-foreground text-background'
                : 'text-foreground/45 hover:text-foreground/70'
            }`}
          >
            Buy Now
          </button>
          <button
            type="button"
            onClick={() => setPurchaseType('subscribe')}
            className={`flex-1 py-3.5 font-body text-[10px] tracking-[0.2em] uppercase font-semibold transition-all ${
              purchaseType === 'subscribe'
                ? 'bg-foreground text-background'
                : 'text-foreground/45 hover:text-foreground/70'
            }`}
          >
            Subscribe & Save
          </button>
        </div>

        {purchaseType === 'subscribe' && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="font-body text-[10px] text-center text-accent/70 tracking-[0.05em]"
          >
            Save 15–25% with a membership.{' '}
            <Link to="/membership" className="underline underline-offset-2 hover:text-accent transition-colors">
              View plans →
            </Link>
          </motion.p>
        )}

        {/* ── Info strip (rule of 3) ────────────────────────────── */}
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center gap-1.5">
            <span className="font-body text-sm text-foreground font-semibold">${visitTotal.toLocaleString()}</span>
            {enhTotal > 0 && (
              <span className="font-body text-[10px] text-foreground/40">total</span>
            )}
          </div>
          <div className="w-px h-3 bg-foreground/15 mx-5" />
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-foreground/40" strokeWidth={1.5} />
            <span className="font-body text-xs text-foreground/60">30–45 min</span>
          </div>
          <div className="w-px h-3 bg-foreground/15 mx-5" />
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-foreground/40" strokeWidth={1.5} />
            <span className="font-body text-xs text-foreground/60">Mobile</span>
          </div>
        </div>

        {/* ── Book CTA ─────────────────────────────────────────── */}
        <motion.button
          type="button"
          onClick={handleBook}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-foreground text-background font-body text-sm tracking-[0.22em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
        >
          Book Now <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </motion.button>

        {/* ── Members note ─────────────────────────────────────── */}
        <p className="font-body text-[10px] text-center text-foreground/30 tracking-[0.05em]">
          Members save 15–25% on every visit.{' '}
          <Link to="/membership" className="text-foreground/50 hover:text-foreground/70 transition-colors underline underline-offset-2">
            Join →
          </Link>
        </p>

        {/* ── Packages — Bundle & Save ─────────────────────────── */}
        <div className="pt-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-foreground/[0.07]" />
            <span className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/25">Bundle & Save</span>
            <div className="flex-1 h-px bg-foreground/[0.07]" />
          </div>

          <div className="rounded-2xl border border-foreground/[0.10] bg-white/[0.04] backdrop-blur-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPkgOpen((v) => !v)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-foreground/[0.02]"
            >
              <div className="w-8 h-8 rounded-full bg-foreground/[0.08] border border-foreground/[0.14] flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 text-foreground/50" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-0.5">Packages</p>
                <p className="font-body text-sm tracking-[0.03em] text-foreground">Curated Bundles</p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-foreground/35 transition-transform duration-300 shrink-0 ${pkgOpen ? 'rotate-180' : ''}`}
                strokeWidth={1.5}
              />
            </button>

            <AnimatePresence initial={false}>
              {pkgOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="border-t border-foreground/[0.07] divide-y divide-foreground/[0.05]">
                    {PACKAGES.map((pkg) => (
                      <div key={pkg.key} className="px-5 py-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <p className="font-body text-sm tracking-[0.04em] text-foreground font-medium">{pkg.label}</p>
                              <span className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/40 border border-foreground/15 px-1.5 py-0.5 rounded-full">
                                {pkg.tag}
                              </span>
                            </div>
                            <p className="font-body text-[10px] text-foreground/45">{pkg.tagline}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-body text-sm font-semibold text-foreground">${pkg.price}</p>
                            <p className="font-body text-[9px] text-accent/80">Save ${pkg.save}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {pkg.includes.map((item) => (
                            <div key={item} className="flex items-center gap-2">
                              <Check className="w-3 h-3 text-foreground/30 shrink-0" strokeWidth={2} />
                              <span className="font-body text-[10px] text-foreground/55">{item}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddPackage(pkg)}
                          className="w-full py-2.5 rounded-xl bg-foreground text-background font-body text-[10px] tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
                        >
                          Add Package →
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Footer />

      {/* ── Floating cart bar ─────────────────────────────────── */}
      <AnimatePresence>
        {cart.length > 0 && !checkoutOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="fixed bottom-6 left-4 right-4 z-40"
          >
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors shadow-2xl shadow-black/40"
            >
              <span>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-2">
                Review Cart <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Checkout sheet ────────────────────────────────────── */}
      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutSheet
            cart={cart}
            onRemove={removeItem}
            onClose={() => setCheckoutOpen(false)}
            onConfirm={clearCart}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
