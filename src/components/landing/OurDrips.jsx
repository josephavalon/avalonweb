import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Droplets, Zap, Plus, X, Check, ShoppingBag, ArrowRight,
  Syringe, ChevronDown, Leaf, ShieldCheck, FlaskConical, Heart, Brain,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';

const EASE = [0.16, 1, 0.3, 1];

/* ─── IM Recovery Shots ──────────────────────────────────────────
   doses[] = selectable concentrations; no doses = flat price      */
const IM_SHOTS = [
  { label: 'B12',        price: 40, desc: 'Energy + metabolism'       },
  { label: 'MIC',        price: 50, desc: 'Fat metabolism + liver'     },
  { label: 'NAD+ IM',   price: 80, desc: 'Quick cellular energy boost' },
  {
    label: 'Glutathione',
    desc: 'Antioxidant + skin clarity',
    doses: [
      { label: '200mg',  price: 50  },
      { label: '600mg',  price: 80  },
      { label: '1000mg', price: 120 },
    ],
  },
  {
    label: 'Vitamin C',
    desc: 'Immune + antioxidant support',
    doses: [
      { label: '500mg',  price: 30 },
      { label: '1000mg', price: 50 },
      { label: '2000mg', price: 75 },
    ],
  },
];

/* ─── IV Add-Ons ────────────────────────────────────────────────
   Flat-price items added to any session                           */
const IV_ADDONS = [
  { label: 'Extra Fluid',         price: 25,  desc: 'Additional 500ml saline'           },
  { label: 'Extra Ingredients',   price: 30,  desc: 'B-complex, minerals & amino boost' },
  { label: 'High Dose Vitamin C', price: 45,  desc: '5,000mg IV push'                   },
  { label: 'CBD (33mg)',          price: 250, desc: 'Zero THC · full bioavailability'   },
  { label: 'NAD+ (250mg)',        price: 350, desc: 'Cellular energy + repair'          },
];

/* ─── Sessions ───────────────────────────────────────────────── */
const SESSIONS = [
  {
    key: 'hydration',
    icon: Droplets,
    label: 'Hydration',
    price: 150,
    tagline: 'Rehydrate, replenish, and recover fast.',
    features: ['Deep hydration', 'Electrolyte balance', 'Nutrient support', 'Overall wellness'],
    includes: [
      'Premium IV hydration formula',
      'Electrolytes & essential minerals',
      'Vitamin blend',
      'Delivered by a licensed RN',
    ],
  },
  {
    key: 'energy',
    icon: Zap,
    label: 'Energy',
    price: 250,
    tagline: 'Boost energy, sharpen focus, perform.',
    features: ['High-dose B vitamins', 'Amino acids', 'Metabolic support', 'Mental clarity'],
    includes: [
      'B-vitamin complex',
      'Amino acid blend',
      'Magnesium',
      'Delivered by a licensed RN',
    ],
  },
  {
    key: 'immunity',
    icon: ShieldCheck,
    label: 'Immunity',
    price: 250,
    tagline: 'Strengthen your defenses, fast.',
    features: ['High-dose Vitamin C', 'Zinc infusion', 'Antioxidant support', 'Immune modulation'],
    includes: [
      'High-dose Vitamin C',
      'Zinc & selenium',
      'Glutathione push',
      'Delivered by a licensed RN',
    ],
  },
  {
    key: 'wellness',
    icon: FlaskConical,
    label: "Myers' Cocktail",
    tabLabel: 'Wellness',
    price: 250,
    tagline: "The gold standard of IV therapy.",
    features: ["Magnesium", "B-complex vitamins", "Calcium", "Vitamin C"],
    includes: [
      "Classic Myers' formula",
      'Magnesium & calcium',
      'Multi-vitamin blend',
      'Delivered by a licensed RN',
    ],
  },
  {
    key: 'recovery',
    icon: Heart,
    label: 'Recovery',
    price: 250,
    tagline: 'Bounce back faster. Feel better sooner.',
    features: ['Anti-inflammatory support', 'Tissue repair', 'Pain reduction', 'Rehydration'],
    includes: [
      'Recovery formula blend',
      'Anti-nausea support',
      'Electrolytes & minerals',
      'Delivered by a licensed RN',
    ],
  },
  {
    key: 'nad',
    icon: Brain,
    label: 'NAD+',
    price: 350,
    tagline: 'Cellular repair and energy at the source.',
    features: ['Cellular regeneration', 'Cognitive clarity', 'Metabolism boost', 'Anti-aging support'],
    includes: [
      'Pharmaceutical-grade NAD+',
      'Slow IV infusion protocol',
      'MD-supervised dosing',
      'Delivered by a licensed RN',
    ],
    doses: [
      { label: '250mg',  price: 350 },
      { label: '500mg',  price: 500 },
      { label: '750mg',  price: 600 },
      { label: '1000mg', price: 800 },
    ],
  },
  {
    key: 'cbd',
    icon: Leaf,
    label: 'IV CBD',
    price: 250,
    tagline: 'Recovery and calm at full bioavailability.',
    features: ['Zero THC', 'Full bioavailability', 'Muscle relaxation', 'Stress response'],
    includes: [
      'Pharmaceutical IV CBD',
      'Zero THC formula',
      'Magnesium blend',
      'Delivered by a licensed RN',
    ],
    doses: [
      { label: '33mg',  price: 250 },
      { label: '66mg',  price: 300 },
      { label: '99mg',  price: 350 },
      { label: '132mg', price: 400 },
    ],
  },
];

/* ─── Checkout Sheet ─────────────────────────────────────────── */
function CheckoutSheet({ cart, onRemove, onClose }) {
  const total = cart.reduce((sum, i) => sum + i.price, 0);
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
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10"
        onClick={onClose}
      />
      <div className="relative bg-background/95 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-accent mb-0.5">Your Order</p>
            <p className="font-heading text-2xl text-foreground tracking-wide">{cart.length} Item{cart.length !== 1 ? 's' : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full border border-white/10 text-foreground/50 hover:text-foreground transition-colors focus:outline-none" aria-label="Close cart">
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {cart.map((item) => (
            <div key={item.cartKey} className="flex items-center gap-3 py-2.5 border-b border-white/[0.06]">
              <div className="p-1.5 rounded-lg bg-accent/10 shrink-0">
                {item.type === 'im'
                  ? <Syringe className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />
                  : <Droplets className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs tracking-widest uppercase text-foreground leading-tight truncate">{item.label}</p>
                <p className="font-body text-[10px] text-foreground/40">{item.type === 'iv' ? '/ session' : item.type === 'addon' ? '/ IV add-on' : 'per shot'}</p>
              </div>
              <span className="font-heading text-lg text-foreground tracking-wide shrink-0">${item.price.toLocaleString()}</span>
              <button type="button" onClick={() => onRemove(item.cartKey)} className="p-1 text-foreground/30 hover:text-foreground transition-colors focus:outline-none shrink-0" aria-label={`Remove ${item.label}`}>
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
        <div className="px-6 pt-4 pb-6 border-t border-white/8 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-0.5">Visit Total</p>
              <p className="font-heading text-4xl text-foreground tracking-wide leading-none">${total.toLocaleString()}</p>
            </div>
            <p className="font-body text-[10px] text-foreground/30 text-right max-w-[160px] leading-relaxed">
              No charge until your appointment is confirmed.
            </p>
          </div>
          <Link to="/apply" className="flex items-center justify-center gap-2.5 w-full py-4 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-accent text-background hover:bg-accent/90 transition-colors">
            Request Appointment <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
          <p className="font-body text-[10px] text-center text-foreground/30 tracking-wide">A licensed RN will confirm availability and arrive at your location.</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Section ───────────────────────────────────────────── */
export default function OurDrips() {
  const navigate = useNavigate();
  const { items: cart, addItem: addToCart, removeItem: removeFromCart, clearItems: clearCart, itemsTotal: cartTotal } = useCart();
  const [activeKey, setActiveKey] = useState(SESSIONS[0].key);
  const [sessionDropOpen, setSessionDropOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [boostersOpen, setBoostersOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Session dose state
  const [selectedDose, setSelectedDose] = useState(null);

  // IM shot state: Set of selected labels + per-shot dose map
  const [imSelected, setImSelected] = useState(new Set());
  const [imDoses, setImDoses] = useState(() => {
    const init = {};
    IM_SHOTS.forEach((s) => { if (s.doses) init[s.label] = s.doses[0].label; });
    return init;
  });

  // IV add-on state: Set of selected labels (flat-price, no doses)
  const [addonSelected, setAddonSelected] = useState(new Set());

  const session = SESSIONS.find((s) => s.key === activeKey) || SESSIONS[0];

  // When tab changes, reset dose
  const handleTabChange = (key) => {
    setActiveKey(key);
    const s = SESSIONS.find((x) => x.key === key);
    setSelectedDose(s?.doses?.[0] || null);
    setJustAdded(false);
    setSessionDropOpen(false);
  };

  const activeDose = selectedDose || session.doses?.[0] || null;
  const displayPrice = activeDose ? activeDose.price : session.price;
  const cartKey = activeDose ? `${session.key}-${activeDose.label}` : session.key;
  const inCart = cart.some((i) => i.cartKey === cartKey);

  const handleSelectSession = () => {
    if (inCart) return;
    addToCart({
      cartKey,
      label: activeDose ? `${session.label} ${activeDose.label}` : session.label,
      price: displayPrice,
      type: 'iv',
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  // ── IM shot helpers ──────────────────────────────────────────
  const getImCartKey = (shot) => {
    if (!shot.doses) return `im-${shot.label}`;
    return `im-${shot.label}-${imDoses[shot.label]}`;
  };
  const getImPrice = (shot) => {
    if (!shot.doses) return shot.price;
    return shot.doses.find((d) => d.label === imDoses[shot.label])?.price ?? shot.doses[0].price;
  };
  const toggleIM = (label) => {
    const shot = IM_SHOTS.find((s) => s.label === label);
    if (cart.some((i) => i.cartKey === getImCartKey(shot))) return;
    setImSelected((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };
  const setImDose = (label, doseLabel) => {
    setImDoses((prev) => ({ ...prev, [label]: doseLabel }));
  };
  const pendingIM = IM_SHOTS.filter(
    (s) => imSelected.has(s.label) && !cart.some((i) => i.cartKey === getImCartKey(s))
  );
  const handleAddIM = () => {
    pendingIM.forEach((shot) => {
      const doseLabel = shot.doses ? ` ${imDoses[shot.label]}` : '';
      addToCart({
        cartKey: getImCartKey(shot),
        label: `IM · ${shot.label}${doseLabel}`,
        price: getImPrice(shot),
        type: 'im',
      });
    });
    setImSelected(new Set());
  };

  // ── IV add-on helpers (flat-price) ──────────────────────────
  const getAddonCartKey = (addon) => `addon-${addon.label}`;
  const toggleAddon = (label) => {
    const addon = IV_ADDONS.find((a) => a.label === label);
    if (cart.some((i) => i.cartKey === getAddonCartKey(addon))) return;
    setAddonSelected((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };
  const pendingAddons = IV_ADDONS.filter(
    (a) => addonSelected.has(a.label) && !cart.some((i) => i.cartKey === getAddonCartKey(a))
  );
  const handleAddAddons = () => {
    pendingAddons.forEach((addon) => {
      addToCart({
        cartKey: getAddonCartKey(addon),
        label: addon.label,
        price: addon.price,
        type: 'addon',
      });
    });
    setAddonSelected(new Set());
  };

  const anyPending = pendingIM.length > 0 || pendingAddons.length > 0;

  return (
    <section id="treatments" className="scroll-mt-20 md:scroll-mt-28 pt-8 pb-16 md:py-20 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header row */}
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <p className="text-[11px] md:text-xs tracking-[0.3em] text-foreground font-body uppercase mb-2">Therapies</p>
            <h2 className="font-heading text-[9vw] md:text-7xl text-foreground tracking-tight leading-[0.92] uppercase">
              Choose Your Session
            </h2>
            <div className="w-10 h-[2px] bg-foreground mt-3" />
          </div>
          <Link to="/store" className="hidden md:flex items-center gap-2 font-body text-xs tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground transition-colors">
            View All Sessions <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </Link>
        </div>

        {/* Session dropdown — glass, icons */}
        <div className="relative mb-6 md:mb-8">
          {/* Trigger */}
          <button
            type="button"
            onClick={() => setSessionDropOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border border-foreground/15 bg-foreground/[0.03] backdrop-blur-md text-left hover:bg-foreground/[0.06] transition-all duration-200"
          >
            {session.icon && (
              <div className="w-8 h-8 rounded-xl bg-foreground/8 flex items-center justify-center shrink-0">
                <session.icon className="w-4 h-4 text-foreground" strokeWidth={1.5} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-heading text-xl text-foreground uppercase tracking-tight leading-none">
                {session.tabLabel || session.label}
              </p>
              <p className="font-body text-xs text-foreground mt-0.5">${displayPrice.toLocaleString()}</p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-foreground transition-transform duration-300 shrink-0 ${sessionDropOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
          </button>

          {/* Dropdown list */}
          <AnimatePresence>
            {sessionDropOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-10"
                  onClick={() => setSessionDropOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="absolute left-0 right-0 top-full mt-2 z-20 rounded-2xl border border-foreground/15 bg-background/90 backdrop-blur-2xl shadow-2xl overflow-hidden"
                >
                  {SESSIONS.map((s) => {
                    const active = s.key === activeKey;
                    const SIcon = s.icon;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => handleTabChange(s.key)}
                        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left border-b border-foreground/[0.06] last:border-b-0 transition-colors duration-150 ${
                          active ? 'bg-foreground/[0.06]' : 'hover:bg-foreground/[0.03]'
                        }`}
                      >
                        {SIcon && (
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-accent/20' : 'bg-foreground/6'}`}>
                            <SIcon className={`w-4 h-4 ${active ? 'text-accent' : 'text-foreground'}`} strokeWidth={1.5} />
                          </div>
                        )}
                        <span className={`flex-1 font-body text-sm uppercase tracking-[0.1em] ${active ? 'text-foreground font-semibold' : 'text-foreground'}`}>
                          {s.tabLabel || s.label}
                        </span>
                        <span className="font-heading text-base text-foreground tracking-wide">
                          ${s.price.toLocaleString()}
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-accent ml-1 shrink-0" strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Session detail card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={session.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="border border-foreground/10 rounded-2xl overflow-hidden"
          >
            <div className="grid md:grid-cols-[1fr_auto] gap-0">

              {/* Left col — name + features + dose selector */}
              <div className="p-5 md:p-7 border-b md:border-b-0 md:border-r border-foreground/10">
                <h3 className="font-heading text-3xl md:text-4xl text-foreground uppercase tracking-tight leading-none mb-3">
                  {session.label}
                </h3>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4">
                  {session.features.map((f) => (
                    <div key={f} className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-foreground/30 shrink-0" />
                      <span className="font-body text-xs text-foreground/55">{f}</span>
                    </div>
                  ))}
                </div>

                {/* Dose selector (NAD+ / CBD) */}
                {session.doses && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {session.doses.map((d) => (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => setSelectedDose(d)}
                        className={`px-3 py-1 rounded-lg font-body text-xs tracking-wide border transition-all duration-200 ${
                          (activeDose?.label === d.label)
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-foreground/20 text-foreground/50 hover:border-foreground/40'
                        }`}
                      >
                        {d.label} · ${d.price}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right col — price + CTA */}
              <div className="p-5 md:p-7 flex flex-col justify-between min-w-[160px]">
                <div>
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-1">
                    {session.doses ? 'From' : 'From'}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="font-heading text-4xl md:text-5xl text-foreground leading-none tracking-tight">
                      ${displayPrice.toLocaleString()}
                    </p>
                    <p className="font-body text-xs text-foreground/40">/ session</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSelectSession}
                  disabled={inCart || justAdded}
                  className={`mt-5 flex items-center justify-center gap-2 w-full py-3 font-body text-xs tracking-[0.2em] uppercase font-semibold rounded-xl transition-all duration-300 ${
                    inCart || justAdded
                      ? 'bg-foreground/10 text-foreground/40 cursor-default border border-foreground/10'
                      : 'bg-foreground text-background hover:bg-foreground/85'
                  }`}
                >
                  {inCart || justAdded ? (
                    <><Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Added</>
                  ) : (
                    <>Add to Visit <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} /></>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Recovery Boosters accordion ──────────────────────── */}
        <div className="mt-3 border border-foreground/10 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setBoostersOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-foreground/[0.02] transition-colors"
          >
            <span className="font-body text-base font-semibold tracking-[0.12em] uppercase text-foreground">Add Support</span>
            <Plus
              className={`w-4 h-4 text-foreground/50 transition-transform duration-300 ${boostersOpen ? 'rotate-45' : ''}`}
              strokeWidth={2}
            />
          </button>

          <AnimatePresence>
            {boostersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 border-t border-foreground/8">

                  {/* ── IM Shots ── */}
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mt-5 mb-3">
                    IM Recovery Shots
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                    {IM_SHOTS.map((shot) => {
                      const isSelected = imSelected.has(shot.label);
                      const already = cart.some((i) => i.cartKey === getImCartKey(shot));
                      const price = getImPrice(shot);
                      return (
                        <div key={shot.label} className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                          already ? 'border-foreground/10 opacity-50'
                          : isSelected ? 'border-foreground bg-foreground/5'
                          : 'border-foreground/15'
                        }`}>
                          <button
                            type="button"
                            onClick={() => toggleIM(shot.label)}
                            disabled={already}
                            className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-foreground/[0.03] transition-colors"
                          >
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${already || isSelected ? 'border-foreground bg-foreground/20' : 'border-foreground/30'}`}>
                              {(already || isSelected) && <Check className="w-2.5 h-2.5 text-foreground" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-body text-xs text-foreground font-medium">{shot.label}</p>
                              <p className="font-body text-[10px] text-foreground/40">{shot.desc}</p>
                            </div>
                            <span className="font-body text-xs text-foreground/60 shrink-0">${price}</span>
                          </button>

                          {/* Dose selector for dosed IM shots */}
                          {shot.doses && (isSelected || already) && (
                            <div className="px-4 pb-3 flex flex-wrap gap-1.5 border-t border-foreground/8 pt-2.5">
                              {shot.doses.map((d) => (
                                <button
                                  key={d.label}
                                  type="button"
                                  disabled={already}
                                  onClick={() => setImDose(shot.label, d.label)}
                                  className={`px-2.5 py-1 rounded-md font-body text-[10px] tracking-wide border transition-all duration-200 ${
                                    imDoses[shot.label] === d.label
                                      ? 'bg-foreground text-background border-foreground'
                                      : 'border-foreground/20 text-foreground/50 hover:border-foreground/40'
                                  }`}
                                >
                                  {d.label} · ${d.price}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── IV Add-Ons (CBD + NAD+) ── */}
                  <div className="border-t border-foreground/8 pt-5">
                    <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground mb-3">
                      Add To Your IV
                    </p>
                    <div className="space-y-2 mb-4">
                      {IV_ADDONS.map((addon) => {
                        const isSelected = addonSelected.has(addon.label);
                        const already = cart.some((i) => i.cartKey === getAddonCartKey(addon));
                        return (
                          <button
                            key={addon.label}
                            type="button"
                            onClick={() => toggleAddon(addon.label)}
                            disabled={already}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                              already ? 'border-foreground/10 opacity-50 cursor-default'
                              : isSelected ? 'border-foreground bg-foreground/5'
                              : 'border-foreground/15 hover:border-foreground/30'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${already || isSelected ? 'border-foreground bg-foreground' : 'border-foreground/30'}`}>
                              {(already || isSelected) && <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-body text-xs text-foreground">{addon.label}</p>
                              <p className="font-body text-[10px] text-foreground leading-snug">{addon.desc}</p>
                            </div>
                            <span className="font-body text-xs text-foreground shrink-0">+${addon.price}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add all pending button */}
                  {anyPending && (
                    <button
                      type="button"
                      onClick={() => { handleAddIM(); handleAddAddons(); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-foreground text-foreground font-body text-xs tracking-widest uppercase hover:bg-foreground/5 transition-colors"
                    >
                      Add {pendingIM.length + pendingAddons.length} Booster{(pendingIM.length + pendingAddons.length) > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Sticky Cart Bar ── */}
      <AnimatePresence>
        {cart.length > 0 && !checkoutOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="fixed bottom-0 md:bottom-4 left-0 md:left-1/2 md:-translate-x-1/2 z-50 w-full md:w-[calc(100%-2rem)] md:max-w-xl"
          >
            <div className="bg-white/10 backdrop-blur-2xl border-t md:border border-white/20 md:rounded-3xl px-5 py-4 md:py-3.5 shadow-2xl shadow-black/40 flex items-center gap-3">
              <div className="relative shrink-0">
                <ShoppingBag className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-background font-body text-[10px] font-bold flex items-center justify-center leading-none">
                  {cart.length}
                </span>
              </div>
              <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                {cart.slice(0, 3).map((item) => (
                  <span key={item.cartKey} className="font-body text-xs tracking-widest uppercase text-foreground bg-white/[0.12] border border-white/20 rounded-full px-3 py-1 whitespace-nowrap">
                    {item.label}
                  </span>
                ))}
                {cart.length > 3 && <span className="font-body text-xs text-foreground/60 px-1 py-1">+{cart.length - 3} more</span>}
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="font-heading text-2xl text-foreground tracking-wide">${cartTotal.toLocaleString()}</span>
                <button
                  type="button"
                  onClick={() => navigate('/checkout')}
                  className="px-6 py-2.5 font-body text-sm tracking-widest uppercase font-semibold rounded-full bg-accent text-background hover:bg-accent/90 transition-colors"
                >
                  Review Request
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  aria-label="Clear cart"
                  className="w-8 h-8 rounded-full border border-white/20 bg-white/[0.06] flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-white/[0.12] hover:border-white/40 transition-colors flex-shrink-0"
                  title="Clear all items"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Checkout Sheet ── */}
      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutSheet
            cart={cart}
            onRemove={removeFromCart}
            onClose={() => setCheckoutOpen(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
