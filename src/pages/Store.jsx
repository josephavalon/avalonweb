import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Check, X, ShoppingBag, Plus, Syringe, ChevronDown, ChevronRight,
  Package, Info, Droplets, Heart, Zap, Sparkles, LayoutGrid, CheckCircle2,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/context/CartContext';
import {
  IV_SESSIONS  as SESSIONS,
  IV_ADDONS,
  IM_SHOTS,
  PACKAGES,
  IV_CATEGORIES as IV_CATEGORIES,
  IV_GOAL_RECOMMENDATION as GOAL_RECOMMENDATION,
} from '@/config/verticals';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

/* ─── QtyControl: compact +/- stepper ───────────────────────── */
function QtyControl({ qty, onInc, onDec, max = 3 }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button" onClick={onDec} disabled={qty <= 0}
        className="w-6 h-6 rounded-full border border-foreground/15 flex items-center justify-center text-foreground/50 hover:text-foreground hover:border-foreground/35 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        aria-label="Decrease"
      >
        <span className="leading-none text-sm select-none">−</span>
      </button>
      <span className="font-body text-xs text-foreground w-4 text-center tabular-nums select-none">{qty}</span>
      <button
        type="button" onClick={onInc} disabled={qty >= max}
        className="w-6 h-6 rounded-full border border-foreground/15 flex items-center justify-center text-foreground/50 hover:text-foreground hover:border-foreground/35 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        aria-label="Increase"
      >
        <span className="leading-none text-sm select-none">+</span>
      </button>
    </div>
  );
}

/* ─── Checkout Sheet ─────────────────────────────────────────── */
function CheckoutSheet({ cart, onRemove, onClose, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  const refNumber = useMemo(() => `AV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, []);
  const total = cart.reduce((s, i) => s + i.price, 0);

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ duration: 0.45, ease: EASE }}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
      style={{ maxHeight: '80vh' }}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                <button type="button" onClick={onClose} aria-label="Close"
                  className="p-2 rounded-full border border-foreground/10 text-foreground/50 hover:text-foreground transition-colors">
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
                    <button type="button" onClick={() => onRemove(item.cartKey)}
                      className="p-1 text-foreground/30 hover:text-foreground transition-colors">
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

/* ─── RecommendedCard ────────────────────────────────────────── */
function RecommendedCard({ session, onBook }) {
  const Icon = session.icon;
  return (
    <motion.div
      key={session.key}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-body text-[9px] tracking-[0.25em] uppercase text-accent">Recommended</span>
        {session.tag && (
          <span className="font-body text-[8px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-foreground/15 text-foreground/40">
            {session.tag}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-4 h-4 text-foreground/60 shrink-0" strokeWidth={1.5} />
            <h3 className="font-heading text-2xl text-foreground uppercase tracking-wide leading-none">{session.label}</h3>
          </div>
          <p className="font-body text-[11px] text-foreground/55 leading-snug mb-2">{session.tagline}</p>
          <p className="font-body text-[10px] tracking-[0.15em] text-foreground/35 uppercase">{session.duration}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <p className="font-heading text-3xl text-foreground leading-none">${session.price}</p>
          <button
            type="button"
            onClick={() => onBook(session)}
            className="px-5 py-2.5 rounded-full bg-foreground text-background font-body text-[10px] tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
          >
            Book This →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function Store() {
  useSeo({ title: 'Book Mobile IV Therapy — Avalon Vitality', description: 'Browse IV drip protocols and book a licensed RN to your location in the San Francisco Bay Area.', path: '/store' });
  const navigate = useNavigate();
  const { items: cart, addItem, removeItem, clearItems: clearCart, itemsTotal: cartTotal } = useCart();

  // Tab state
  const [activeTab, setActiveTab] = useState('iv');

  // Goal chip state — null = no chip active yet
  const [activeGoal, setActiveGoal] = useState(null);

  // IV state
  const [selectedKey,  setSelectedKey]  = useState(SESSIONS[0].key);
  const [insideOpen,   setInsideOpen]   = useState(false);
  const [ivCategory,   setIvCategory]   = useState('all');
  const [ivSelected,   setIvSelected]   = useState(new Set());
  const [showAllSessions, setShowAllSessions] = useState(false);

  // IM state
  const [imSelected, setImSelected] = useState(new Set());

  // Group
  const [groupOpen,  setGroupOpen]  = useState(false);
  const [groupCount, setGroupCount] = useState(1);

  // Checkout
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Auto-open checkout when navigated from mobile cart bar
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('checkout') === '1' && cart.length > 0) {
      setCheckoutOpen(true);
    }
  }, [searchParams, cart.length]);

  // Pricing mode: 'one-time' | 'member'
  const [pricingMode, setPricingMode] = useState('one-time');

  // Custom builder state
  const [customSessionKey, setCustomSessionKey] = useState('myers');
  const [customIVQty, setCustomIVQty] = useState({});
  const [customIMQty, setCustomIMQty] = useState({});

  const session  = SESSIONS.find((s) => s.key === selectedKey) || SESSIONS[0];
  const selIM    = IM_SHOTS.filter((s) => imSelected.has(s.label));
  const selIV    = IV_ADDONS.filter((a) => ivSelected.has(a.label));
  const baseTotal = session.price
    + selIM.reduce((s, x) => s + x.price, 0)
    + selIV.reduce((s, x) => s + x.price, 0);
  const visitTotal = baseTotal * groupCount;

  // Custom builder computed values
  const customSession  = SESSIONS.find((s) => s.key === customSessionKey) || SESSIONS[0];
  const customIVItems  = IV_ADDONS.filter((a) => (customIVQty[a.label] || 0) > 0);
  const customIMItems  = IM_SHOTS.filter((s)  => (customIMQty[s.label] || 0) > 0);
  const customIVTotal  = customIVItems.reduce((sum, a) => sum + a.price * customIVQty[a.label], 0);
  const customIMTotal  = customIMItems.reduce((sum, s)  => sum + s.price * customIMQty[s.label], 0);
  const customTotal    = (customSession.price + customIVTotal + customIMTotal) * groupCount;

  const filteredSessions = ivCategory === 'all'
    ? SESSIONS
    : SESSIONS.filter((s) => s.category === ivCategory);

  const visibleSessions = showAllSessions ? filteredSessions : filteredSessions.slice(0, 4);
  const hasMore = filteredSessions.length > 4 && !showAllSessions;

  const selectSession = (key) => {
    setSelectedKey(key);
    setInsideOpen(false);
  };

  const toggleIM = (label) =>
    setImSelected((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });

  const toggleIV = (label) =>
    setIvSelected((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });

  // One-tap book from RecommendedCard
  const handleBookRecommended = (sess) => {
    if (!cart.some((i) => i.cartKey === sess.key))
      addItem({ cartKey: sess.key, label: sess.label, price: sess.price, type: 'iv' });
    setCheckoutOpen(true);
  };

  const handleBookIV = () => {
    if (!cart.some((i) => i.cartKey === session.key))
      addItem({ cartKey: session.key, label: session.label, price: session.price, type: 'iv' });
    selIM.forEach((s) => {
      if (!cart.some((i) => i.cartKey === `im-${s.label}`))
        addItem({ cartKey: `im-${s.label}`, label: `IM · ${s.label}`, price: s.price, type: 'im' });
    });
    selIV.forEach((a) => {
      if (!cart.some((i) => i.cartKey === `iv-${a.label}`))
        addItem({ cartKey: `iv-${a.label}`, label: a.label, price: a.price, type: 'addon' });
    });
    setImSelected(new Set());
    setIvSelected(new Set());
    setCheckoutOpen(true);
  };

  const handleBookIM = () => {
    selIM.forEach((s) => {
      if (!cart.some((i) => i.cartKey === `im-${s.label}`))
        addItem({ cartKey: `im-${s.label}`, label: `IM · ${s.label}`, price: s.price, type: 'im' });
    });
    setImSelected(new Set());
    setCheckoutOpen(true);
  };

  const handleAddPackage = (pkg) => {
    pkg.items.forEach((item) => {
      if (!cart.some((i) => i.cartKey === item.cartKey))
        addItem(item);
    });
    setCheckoutOpen(true);
  };

  const handleBookCustom = () => {
    addItem({ cartKey: 'custom-base', label: `Custom · ${customSession.label}`, price: customSession.price, type: 'iv' });
    customIVItems.forEach((a) => {
      const qty = customIVQty[a.label];
      addItem({ cartKey: `custom-iv-${a.label}`, label: `${a.label}${qty > 1 ? ` ×${qty}` : ''}`, price: a.price * qty, type: 'addon' });
    });
    customIMItems.forEach((s) => {
      const qty = customIMQty[s.label];
      addItem({ cartKey: `custom-im-${s.label}`, label: `IM · ${s.label}${qty > 1 ? ` ×${qty}` : ''}`, price: s.price * qty, type: 'im' });
    });
    setCustomIVQty({});
    setCustomIMQty({});
    setCheckoutOpen(true);
  };

  const imTotal = selIM.reduce((s, x) => s + x.price, 0);

  const TABS = [
    { key: 'iv',       label: 'IV Drips'      },
    { key: 'packages', label: 'Packages'       },
    { key: 'custom',   label: 'Build Your Own' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-5xl mx-auto px-5 md:px-8 pt-24 pb-36">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-5">

        {/* ── ETA Signal ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 pt-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
          <p className="font-body text-[11px] tracking-[0.25em] uppercase text-foreground/60">
            Available today · SF Bay Area
          </p>
        </div>

        {/* ── Page header ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/60">Book a Visit</p>
            <span className="font-body text-[9px] tracking-[0.2em] uppercase px-2.5 py-0.5 rounded-full border border-foreground/20 text-foreground/50">
              One-Time
            </span>
          </div>
          <h1 className="font-heading text-4xl md:text-5xl text-foreground uppercase tracking-tight leading-none">
            Recovery Menu
          </h1>
        </div>

        {/* Trust anchor */}
        <div className="flex items-center justify-center gap-6 py-3 mb-6 border-y border-foreground/[0.06]">
          <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/50">Licensed RN</span>
          <span className="text-foreground/20">·</span>
          <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/50">Clinically Supervised</span>
          <span className="text-foreground/20">·</span>
          <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/50">SF Bay Area</span>
        </div>

        {/* ── Goal Chips — primary entry point ─────────────────── */}
        <div className="space-y-2">
          <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40">Pick your protocol</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'recovery', label: 'Recover Faster', tab: 'iv',       cat: 'recovery',  icon: Heart    },
              { key: 'energy',   label: 'Boost Energy',   tab: 'iv',       cat: 'energy',    icon: Zap      },
              { key: 'beauty',   label: 'Glow & Beauty',  tab: 'iv',       cat: 'beauty',    icon: Sparkles },
              { key: 'packages', label: 'Bundle & Save',  tab: 'packages', cat: null,        icon: Package  },
              { key: null,       label: 'Not Sure',       tab: 'iv',       cat: 'all',       icon: LayoutGrid },
            ].map((chip) => {
              const Icon = chip.icon;
              const isActive = activeGoal === chip.key;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setActiveGoal(chip.key);
                    setActiveTab(chip.tab);
                    if (chip.cat !== null) setIvCategory(chip.cat);
                    setShowAllSessions(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border font-body text-[10px] tracking-[0.15em] uppercase font-semibold transition-all ${
                    isActive
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-foreground/15 text-foreground/60 hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" strokeWidth={isActive ? 2.5 : 1.8} />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Recommended card — surfaces on goal chip select ───── */}
        <AnimatePresence mode="wait">
          {activeGoal && activeGoal !== 'packages' && GOAL_RECOMMENDATION[activeGoal] && (() => {
            const rec = SESSIONS.find(s => s.key === GOAL_RECOMMENDATION[activeGoal]);
            return rec ? (
              <RecommendedCard key={activeGoal} session={rec} onBook={handleBookRecommended} />
            ) : null;
          })()}
        </AnimatePresence>


        {/* ═══════════════════════════════════════════════════════
            IV DRIPS TAB
        ═══════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {activeTab === 'iv' && (
            <motion.div
              key="iv"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="space-y-4"
            >

              {/* Pricing mode toggle */}
              <div className="space-y-2">
                <div className="inline-flex items-center rounded-full border border-foreground/[0.12] bg-foreground/[0.02] p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setPricingMode('one-time')}
                    className={`px-4 py-1.5 rounded-full font-body text-[10px] tracking-[0.15em] uppercase font-semibold transition-all ${
                      pricingMode === 'one-time'
                        ? 'bg-foreground text-background'
                        : 'text-foreground/50 hover:text-foreground'
                    }`}
                  >
                    One-Time Session
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingMode('member')}
                    className={`px-4 py-1.5 rounded-full font-body text-[10px] tracking-[0.15em] uppercase font-semibold transition-all ${
                      pricingMode === 'member'
                        ? 'bg-accent text-background'
                        : 'text-foreground/50 hover:text-foreground'
                    }`}
                  >
                    With Membership
                    <span className="ml-1 font-body text-[8px] tracking-[0.1em] normal-case opacity-75">save up to 25%</span>
                  </button>
                </div>
                {pricingMode === 'member' && (
                  <p className="font-body text-[10px] text-accent/80 tracking-[0.05em]">
                    Join a membership plan and save on every visit.{' '}
                    <Link to="/membership" className="underline underline-offset-2 hover:text-accent transition-colors">View plans →</Link>
                  </p>
                )}
              </div>

              {/* Session label */}
              <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40">IV Drip</p>

              {/* Session card grid */}
              <div className="grid grid-cols-2 gap-2">
                {visibleSessions.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => selectSession(s.key)}
                    className={`relative flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all duration-200 ${
                      selectedKey === s.key
                        ? 'border-foreground/50 bg-foreground/[0.06]'
                        : s.elite
                          ? 'border-accent/30 hover:border-accent/50 hover:bg-accent/[0.02]'
                          : 'border-foreground/[0.12] hover:border-foreground/25 hover:bg-foreground/[0.02]'
                    }`}
                  >
                    {/* Elite badge */}
                    {s.elite && (
                      <div className="absolute top-2 right-2 font-body text-[8px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                        ELITE
                      </div>
                    )}
                    {/* Selected checkmark */}
                    {selectedKey === s.key && !s.elite && (
                      <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-foreground flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <s.icon className={`w-4 h-4 shrink-0 ${selectedKey === s.key ? 'text-foreground' : s.elite ? 'text-accent/60' : 'text-foreground/40'}`} strokeWidth={1.5} />
                      <span className={`font-body text-xs font-semibold tracking-[0.08em] ${selectedKey === s.key ? 'text-foreground' : 'text-foreground/70'}`}>
                        {s.label}
                      </span>
                    </div>
                    {s.tag && (
                      <span className={`self-start font-body text-[8px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border ${
                        s.popular ? 'bg-accent/20 text-accent border-accent/30' : 'bg-foreground/[0.06] text-foreground/40 border-foreground/[0.08]'
                      }`}>
                        {s.tag}
                      </span>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-body text-[10px] text-foreground/40 leading-tight flex-1 pr-2">{s.tagline}</span>
                      <div className="flex flex-col items-end shrink-0">
                        <span className={`font-body text-sm font-semibold ${selectedKey === s.key ? 'text-foreground' : 'text-foreground/50'}`}>${s.price}</span>
                        {s.elite && (
                          <span className="font-body text-[8px] text-accent/70 leading-tight">Consultation req.</span>
                        )}
                      </div>
                    </div>
                    {s.elite && (
                      <span className="font-body text-[8px] text-foreground/40 tracking-[0.1em] mt-0.5">Add — By Appointment</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Show more / Show less */}
              {(hasMore || showAllSessions) && (
                <button
                  type="button"
                  onClick={() => setShowAllSessions((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40 hover:text-foreground/70 transition-colors border border-foreground/[0.08] rounded-xl hover:border-foreground/20"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showAllSessions ? 'rotate-180' : ''}`} strokeWidth={2} />
                  {showAllSessions ? `Show less` : `Show ${filteredSessions.length - 4} more`}
                </button>
              )}

              {/* What's Inside */}
              <button
                type="button"
                onClick={() => setInsideOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-foreground/10 text-left hover:bg-foreground/[0.02] transition-colors"
              >
                <Info className={`w-3.5 h-3.5 transition-colors ${insideOpen ? 'text-accent' : 'text-foreground/40'}`} strokeWidth={1.8} />
                <span className="flex-1 font-body text-xs tracking-[0.1em] uppercase text-foreground/60">What's Inside</span>
                <span className="font-body text-[10px] text-foreground/30">{session.duration}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-foreground/30 transition-transform duration-300 ${insideOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>

              <AnimatePresence>
                {insideOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pt-2 pb-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] space-y-2">
                      <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40">
                        Formulated with
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {session.inside.split(' · ').map((ingredient) => (
                          <span key={ingredient} className="font-body text-[10px] text-foreground/70 bg-foreground/[0.06] border border-foreground/[0.08] px-2.5 py-1 rounded-full">
                            {ingredient}
                          </span>
                        ))}
                      </div>
                      <p className="font-body text-[10px] text-foreground/30 pt-1">
                        For educational purposes only. Formulation may vary based on clinical assessment.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Build Your Bag — always visible, no accordion ── */}
              <div className="space-y-4 pt-2">

                {/* Header row */}
                <div className="flex items-center justify-between">
                  <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40">Build Your Bag</p>
                  <div className="flex items-center gap-2">
                    {(ivSelected.size > 0 || imSelected.size > 0) && (
                      <span className="font-body text-[9px] tracking-[0.15em] uppercase text-foreground/30">
                        +${selIV.reduce((s, x) => s + x.price, 0) + selIM.reduce((s, x) => s + x.price, 0)} added ·
                      </span>
                    )}
                    <span className="font-heading text-base text-foreground tracking-tight">${visitTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* IV Bag Enhancements */}
                <div>
                  <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/30 mb-2 px-1">Bag Enhancements</p>
                  <div className="space-y-1.5">
                    {IV_ADDONS.map((addon) => {
                      const sel = ivSelected.has(addon.label);
                      return (
                        <button
                          key={addon.label} type="button" onClick={() => toggleIV(addon.label)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                            sel ? 'border-foreground/30 bg-foreground/[0.05]' : 'border-foreground/10 hover:border-foreground/20'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${sel ? 'border-foreground bg-foreground' : 'border-foreground/25'}`}>
                            {sel && <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-body text-xs text-foreground">{addon.label}</p>
                            <p className="font-body text-[10px] text-foreground/40">{addon.desc}</p>
                          </div>
                          <span className="font-body text-xs text-foreground/50 shrink-0">+${addon.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* IM Recovery Shots */}
                <div>
                  <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/30 mb-2 px-1">IM Recovery Shots</p>
                  <div className="space-y-1.5">
                    {IM_SHOTS.map((shot) => {
                      const sel = imSelected.has(shot.label);
                      return (
                        <button
                          key={shot.label} type="button" onClick={() => toggleIM(shot.label)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                            sel ? 'border-foreground/30 bg-foreground/[0.05]' : 'border-foreground/10 hover:border-foreground/20'
                          }`}
                        >
                          <shot.icon className={`w-4 h-4 shrink-0 transition-colors ${sel ? 'text-foreground' : 'text-foreground/35'}`} strokeWidth={1.5} />
                          <div className="flex-1 min-w-0">
                            <p className={`font-body text-xs transition-colors ${sel ? 'text-foreground' : 'text-foreground/70'}`}>{shot.label}</p>
                            <p className="font-body text-[10px] text-foreground/40">{shot.desc}</p>
                          </div>
                          <span className={`font-body text-xs shrink-0 transition-colors ${sel ? 'text-foreground' : 'text-foreground/40'}`}>${shot.price}</span>
                          {sel && <Check className="w-3.5 h-3.5 text-foreground ml-1 shrink-0" strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Future modalities — locked placeholder */}
                <div>
                  <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/20 mb-2 px-1">More Modalities</p>
                  <div className="space-y-1.5 opacity-40 pointer-events-none select-none">
                    {[
                      { label: 'Peptide Therapy', note: "Jul '26" },
                      { label: 'NAD+ Optimization', note: "Q4 '26" },
                    ].map(({ label, note }) => (
                      <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-foreground/[0.07]">
                        <div className="w-4 h-4 rounded-full border border-foreground/20 shrink-0" />
                        <p className="flex-1 font-body text-xs text-foreground/50">{label}</p>
                        <span className="font-body text-[9px] tracking-[0.15em] uppercase text-foreground/30">{note}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Group Booking */}
              <div>
                <button
                  type="button" onClick={() => setGroupOpen((v) => !v)}
                  className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity"
                >
                  <span className="font-body text-xs text-foreground/50 tracking-[0.1em]">Booking for a group?</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-foreground/40 transition-transform duration-300 ${groupOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                </button>
                <AnimatePresence>
                  {groupOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-2xl border border-foreground/15 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-body text-xs text-foreground tracking-[0.05em]">Number of guests</p>
                            <p className="font-body text-[10px] text-foreground/40 mt-0.5">We bring additional RNs for groups of 4+</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setGroupCount((c) => Math.max(1, c - 1))}
                              className="w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors font-body text-lg leading-none" aria-label="Decrease">−</button>
                            <span className="font-heading text-xl text-foreground w-5 text-center">{groupCount}</span>
                            <button type="button" onClick={() => setGroupCount((c) => Math.min(8, c + 1))}
                              className="w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors font-body text-lg leading-none" aria-label="Increase">+</button>
                          </div>
                        </div>
                        {groupCount >= 8 && (
                          <p className="font-body text-[10px] text-foreground/50">
                            For groups of 9+, <Link to="/events" className="text-accent hover:text-accent/80 transition-colors">use our Events booking →</Link>
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Members save note — inline, desktop too */}
              <div className="flex items-center gap-2 pt-1">
                <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40">Members save 20% ·</span>
                <Link to="/membership" className="font-body text-[10px] tracking-[0.2em] uppercase text-accent hover:text-accent/80 transition-colors">View memberships →</Link>
              </div>

              {/* Mobile CTA — live total, only visible on mobile (desktop uses sticky right panel) */}
              <motion.button
                type="button"
                onClick={handleBookIV}
                whileTap={{ scale: 0.98 }}
                className="md:hidden w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors mt-2"
              >
                <span>Request This Visit</span>
                <span className="font-heading text-lg tracking-tight">${visitTotal.toLocaleString()}</span>
              </motion.button>

            </motion.div>
          )}


          {/* ═══════════════════════════════════════════════════════
              PACKAGES TAB
          ═══════════════════════════════════════════════════════ */}
          {activeTab === 'packages' && (
            <motion.div
              key="packages"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="space-y-4"
            >
              <div>
                <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-1">Curated Packages</p>
                <p className="font-body text-xs text-foreground/50">Pre-built protocols — IV + IM, priced together. Save vs. à la carte.</p>
              </div>

              <div className="space-y-3">
                {PACKAGES.map((pkg, i) => (
                  <motion.div
                    key={pkg.key}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: i * 0.06 }}
                    className="border border-foreground/15 rounded-2xl overflow-hidden"
                  >
                    <div className="px-5 pt-5 pb-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full border border-foreground/20 bg-foreground/[0.04] flex items-center justify-center shrink-0">
                            <pkg.icon className="w-3.5 h-3.5 text-foreground/60" strokeWidth={1.5} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-heading text-lg text-foreground uppercase tracking-wide leading-none">{pkg.label}</h3>
                              <span className="font-body text-[8px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-full bg-foreground/[0.06] text-foreground/50 border border-foreground/10">{pkg.tag}</span>
                            </div>
                            <p className="font-body text-[10px] text-foreground/45 mt-0.5">{pkg.tagline}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-heading text-xl text-foreground tracking-tight">${pkg.price}</p>
                          <p className="font-body text-[9px] text-accent mt-0.5">Save ${pkg.save}</p>
                        </div>
                      </div>

                      {/* What's included */}
                      <div className="space-y-1 mb-4">
                        {pkg.includes.map((item) => (
                          <div key={item} className="flex items-center gap-2">
                            <ChevronRight className="w-3 h-3 text-foreground/30 shrink-0" strokeWidth={2} />
                            <span className="font-body text-[10px] text-foreground/60">{item}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddPackage(pkg)}
                        className="w-full flex items-center justify-between px-5 py-3 rounded-xl bg-foreground text-background font-body text-[10px] tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
                      >
                        <span>Add Package</span>
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex items-center gap-2 px-1 pt-1">
                <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40">Members save an additional 20% ·</span>
                <Link to="/membership" className="font-body text-[10px] tracking-[0.2em] uppercase text-accent hover:text-accent/80 transition-colors">Join →</Link>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════
              CUSTOM BUILD TAB
          ═══════════════════════════════════════════════════════ */}
          {activeTab === 'custom' && (
            <motion.div
              key="custom"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="space-y-5"
            >
              <div>
                <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-1">Build Your Own IV Visit</p>
                <p className="font-body text-xs text-foreground/50">Choose a base drip, dial in your add-ons, pick your IM shots. No guesswork.</p>
              </div>

              {/* Base drip selection */}
              <div>
                <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">Base Drip</p>
                <div className="grid grid-cols-2 gap-2">
                  {SESSIONS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setCustomSessionKey(s.key)}
                      className={`relative flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all duration-200 ${
                        customSessionKey === s.key
                          ? 'border-foreground/50 bg-foreground/[0.06]'
                          : 'border-foreground/[0.12] hover:border-foreground/25 hover:bg-foreground/[0.02]'
                      }`}
                    >
                      {customSessionKey === s.key && (
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-foreground flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <s.icon className={`w-4 h-4 shrink-0 ${customSessionKey === s.key ? 'text-foreground' : 'text-foreground/40'}`} strokeWidth={1.5} />
                        <span className={`font-body text-xs font-semibold tracking-[0.08em] ${customSessionKey === s.key ? 'text-foreground' : 'text-foreground/70'}`}>
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-body text-[10px] text-foreground/40 leading-tight flex-1 pr-2">{s.tagline}</span>
                        <span className={`font-body text-sm font-semibold shrink-0 ${customSessionKey === s.key ? 'text-foreground' : 'text-foreground/50'}`}>${s.price}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* IV Add-Ons with qty */}
              <div>
                <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">
                  IV Add-Ons <span className="font-body text-[9px] tracking-normal normal-case text-foreground/25">· boost your drip</span>
                </p>
                <div className="space-y-2">
                  {IV_ADDONS.map((addon) => {
                    const qty = customIVQty[addon.label] || 0;
                    return (
                      <div
                        key={addon.label}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          qty > 0 ? 'border-foreground/30 bg-foreground/[0.04]' : 'border-foreground/10'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-xs text-foreground">{addon.label}</p>
                          <p className="font-body text-[10px] text-foreground/40">{addon.desc}</p>
                        </div>
                        <span className="font-body text-[10px] text-foreground/45 shrink-0">
                          +${qty > 1 ? `${addon.price * qty}` : addon.price}
                        </span>
                        <QtyControl
                          qty={qty}
                          onInc={() => setCustomIVQty((p) => ({ ...p, [addon.label]: (p[addon.label] || 0) + 1 }))}
                          onDec={() => setCustomIVQty((p) => ({ ...p, [addon.label]: Math.max(0, (p[addon.label] || 0) - 1) }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* IM Shots with qty */}
              <div>
                <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">IM Recovery Shots</p>
                <div className="space-y-2">
                  {IM_SHOTS.map((shot) => {
                    const qty = customIMQty[shot.label] || 0;
                    return (
                      <div
                        key={shot.label}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          qty > 0 ? 'border-foreground/30 bg-foreground/[0.04]' : 'border-foreground/10'
                        }`}
                      >
                        <shot.icon className={`w-4 h-4 shrink-0 ${qty > 0 ? 'text-foreground' : 'text-foreground/35'}`} strokeWidth={1.5} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-body text-xs ${qty > 0 ? 'text-foreground font-medium' : 'text-foreground/70'}`}>{shot.label}</p>
                          <p className="font-body text-[10px] text-foreground/40">{shot.desc}</p>
                        </div>
                        <span className="font-body text-[10px] text-foreground/45 shrink-0">
                          +${qty > 1 ? `${shot.price * qty}` : shot.price}
                        </span>
                        <QtyControl
                          qty={qty}
                          onInc={() => setCustomIMQty((p) => ({ ...p, [shot.label]: (p[shot.label] || 0) + 1 }))}
                          onDec={() => setCustomIMQty((p) => ({ ...p, [shot.label]: Math.max(0, (p[shot.label] || 0) - 1) }))}
                          max={shot.max ?? 2}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group count */}
              <div>
                <button
                  type="button" onClick={() => setGroupOpen((v) => !v)}
                  className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity"
                >
                  <span className="font-body text-xs text-foreground/50 tracking-[0.1em]">Booking for a group?</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-foreground/40 transition-transform duration-300 ${groupOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                </button>
                <AnimatePresence>
                  {groupOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-2xl border border-foreground/15 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-body text-xs text-foreground">Number of guests</p>
                            <p className="font-body text-[10px] text-foreground/40 mt-0.5">Additional RNs for groups of 4+</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setGroupCount((c) => Math.max(1, c - 1))}
                              className="w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors font-body text-lg leading-none">−</button>
                            <span className="font-heading text-xl text-foreground w-5 text-center">{groupCount}</span>
                            <button type="button" onClick={() => setGroupCount((c) => Math.min(8, c + 1))}
                              className="w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors font-body text-lg leading-none">+</button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Live total summary + CTA */}
              <div className="rounded-2xl border border-foreground/[0.12] bg-foreground/[0.02] p-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs text-foreground/60">{customSession.label} IV</span>
                    <span className="font-body text-xs text-foreground">${customSession.price}</span>
                  </div>
                  {customIVItems.map((a) => (
                    <div key={a.label} className="flex items-center justify-between pl-3">
                      <span className="font-body text-[10px] text-foreground/40">{a.label}{customIVQty[a.label] > 1 ? ` ×${customIVQty[a.label]}` : ''}</span>
                      <span className="font-body text-[10px] text-foreground/40">+${a.price * customIVQty[a.label]}</span>
                    </div>
                  ))}
                  {customIMItems.map((s) => (
                    <div key={s.label} className="flex items-center justify-between pl-3">
                      <span className="font-body text-[10px] text-foreground/40">IM · {s.label}{customIMQty[s.label] > 1 ? ` ×${customIMQty[s.label]}` : ''}</span>
                      <span className="font-body text-[10px] text-foreground/40">+${s.price * customIMQty[s.label]}</span>
                    </div>
                  ))}
                  {groupCount > 1 && (
                    <div className="flex items-center justify-between pl-3">
                      <span className="font-body text-[10px] text-foreground/40">{groupCount} guests</span>
                      <span className="font-body text-[10px] text-foreground/40">×{groupCount}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-foreground/[0.08] pt-3">
                  <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40">Estimated Total</span>
                  <span className="font-heading text-2xl text-foreground tracking-tight">${customTotal.toLocaleString()}</span>
                </div>
                <motion.button
                  type="button" onClick={handleBookCustom} whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
                >
                  <span>Request This Visit</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </motion.button>
                <p className="font-body text-[10px] text-center text-foreground/30">No charge until your RN confirms.</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40">Members save 20% ·</span>
                <Link to="/membership" className="font-body text-[10px] tracking-[0.2em] uppercase text-accent hover:text-accent/80 transition-colors">View memberships →</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>{/* end left col */}

        {/* ── Desktop sticky right panel ──────────────────────── */}
        <div className="hidden md:block">
          <div className="sticky top-24 space-y-3 pt-16">

            {/* Summary card */}
            <div className="border border-foreground/10 rounded-2xl overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-foreground/[0.06]">
                <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/40">Visit Summary</p>
              </div>
              <div className="px-5 py-4 space-y-2.5 min-h-[80px]">
                {activeTab === 'iv' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <session.icon className="w-3.5 h-3.5 text-foreground/50 shrink-0" strokeWidth={1.5} />
                        <span className="font-body text-xs text-foreground">{session.label} IV</span>
                      </div>
                      <span className="font-body text-xs text-foreground">${session.price}</span>
                    </div>
                    {selIV.map((a) => (
                      <div key={a.label} className="flex items-center justify-between pl-5">
                        <span className="font-body text-[10px] text-foreground/55">{a.label}</span>
                        <span className="font-body text-[10px] text-foreground/55">+${a.price}</span>
                      </div>
                    ))}
                    {selIM.map((s) => (
                      <div key={s.label} className="flex items-center justify-between pl-5">
                        <span className="font-body text-[10px] text-foreground/55">IM · {s.label}</span>
                        <span className="font-body text-[10px] text-foreground/55">+${s.price}</span>
                      </div>
                    ))}
                    {groupCount > 1 && (
                      <p className="font-body text-[10px] text-foreground/40">{groupCount} guests</p>
                    )}
                  </>
                )}
                {activeTab === 'packages' && (
                  <p className="font-body text-[10px] text-foreground/30 italic">Select a package to the left</p>
                )}
                {activeTab === 'custom' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <customSession.icon className="w-3.5 h-3.5 text-foreground/50 shrink-0" strokeWidth={1.5} />
                        <span className="font-body text-xs text-foreground">{customSession.label} IV</span>
                      </div>
                      <span className="font-body text-xs text-foreground">${customSession.price}</span>
                    </div>
                    {customIVItems.map((a) => (
                      <div key={a.label} className="flex items-center justify-between pl-5">
                        <span className="font-body text-[10px] text-foreground/55">{a.label}{customIVQty[a.label] > 1 ? ` ×${customIVQty[a.label]}` : ''}</span>
                        <span className="font-body text-[10px] text-foreground/55">+${a.price * customIVQty[a.label]}</span>
                      </div>
                    ))}
                    {customIMItems.map((s) => (
                      <div key={s.label} className="flex items-center justify-between pl-5">
                        <span className="font-body text-[10px] text-foreground/55">IM · {s.label}{customIMQty[s.label] > 1 ? ` ×${customIMQty[s.label]}` : ''}</span>
                        <span className="font-body text-[10px] text-foreground/55">+${s.price * customIMQty[s.label]}</span>
                      </div>
                    ))}
                    {groupCount > 1 && (
                      <p className="font-body text-[10px] text-foreground/40">{groupCount} guests ×{groupCount}</p>
                    )}
                  </>
                )}
              </div>
              <div className="px-5 py-3 border-t border-foreground/[0.06] flex items-center justify-between">
                <span className="font-body text-[10px] tracking-[0.15em] uppercase text-foreground/40">Total</span>
                <span className="font-heading text-xl text-foreground tracking-tight">
                  {activeTab === 'iv' ? `$${visitTotal.toLocaleString()}` : activeTab === 'custom' ? `$${customTotal.toLocaleString()}` : '—'}
                </span>
              </div>
            </div>

            {/* CTA */}
            {activeTab === 'iv' && (
              <motion.button
                type="button" onClick={handleBookIV} whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-accent text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-accent/85 transition-colors"
              >
                <span>Book Now</span>
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </motion.button>
            )}
            {activeTab === 'custom' && (
              <motion.button
                type="button" onClick={handleBookCustom} whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-accent text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-accent/85 transition-colors"
              >
                <span>Book Now</span>
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </motion.button>
            )}

            <p className="font-body text-[9px] text-center text-foreground/30 tracking-wide">No commitment required.</p>
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-body text-[9px] tracking-[0.15em] uppercase text-foreground/35">Members save 20% ·</span>
              <Link to="/membership" className="font-body text-[9px] tracking-[0.15em] uppercase text-accent hover:text-accent/80 transition-colors">Join →</Link>
            </div>

          </div>
        </div>{/* end right panel */}

        </div>{/* end 2-col grid */}
      </div>{/* end max-w-5xl */}

      <Footer />


      {/* ── Desktop floating cart bar (cart items only) ─────────── */}
      <AnimatePresence>
        {cart.length > 0 && !checkoutOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="hidden md:block fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl"
          >
            <div className="bg-background/90 backdrop-blur-2xl border border-foreground/15 rounded-3xl px-5 py-3.5 shadow-2xl shadow-black/30 flex items-center gap-3">
              <div className="relative shrink-0">
                <ShoppingBag className="w-5 h-5 text-foreground" strokeWidth={1.5} />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-background font-body text-[10px] font-bold flex items-center justify-center leading-none">{cart.length}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs text-foreground/70 truncate">{cart.map((i) => i.label).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="font-heading text-xl text-foreground tracking-wide">${cartTotal.toLocaleString()}</span>
                <button type="button" onClick={() => setCheckoutOpen(true)}
                  className="px-5 py-2 font-body text-xs tracking-widest uppercase font-semibold rounded-full bg-foreground text-background hover:bg-foreground/85 transition-colors">
                  Review Request
                </button>
                <button type="button" onClick={clearCart} aria-label="Clear cart"
                  className="w-8 h-8 rounded-full border border-foreground/15 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutSheet cart={cart} onRemove={removeItem} onClose={() => setCheckoutOpen(false)} onConfirm={clearCart} />
        )}
      </AnimatePresence>
    </div>
  );
}
