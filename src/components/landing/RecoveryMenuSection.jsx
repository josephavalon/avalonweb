import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Droplets, Zap, ShieldCheck, Sparkles, Heart, Plane, FlaskConical, Moon,
  ArrowRight, Check, X, ShoppingBag, Plus, Syringe, ChevronDown, ChevronRight,
  Flame, BatteryCharging, Shield, Package, Info, LayoutGrid,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';

const EASE = [0.16, 1, 0.3, 1];

const SESSIONS = [
  { key: 'hydration', label: 'Hydration', price: 150, icon: Droplets, tagline: 'Rehydrate, replenish, and recover fast.', tag: 'Essential', category: 'recovery', duration: '30–45 min', inside: 'Saline (500–1000ml) · Electrolytes · B-Complex · Trace minerals' },
  { key: 'energy',    label: 'Energy',    price: 250, icon: Zap,       tagline: 'Boost energy, sharpen focus, perform.',       tag: 'Performance',    category: 'energy',    duration: '45–60 min', inside: 'Saline · Vitamin B12 · B-Complex · Magnesium · Taurine · Vitamin C' },
  { key: 'immunity',  label: 'Immunity',  price: 250, icon: ShieldCheck,tagline: 'Strengthen your defenses, fast.',             tag: 'Bestseller',     category: 'immunity',  duration: '45–60 min', inside: 'High-dose Vitamin C · Zinc · Selenium · Glutathione · Saline' },
  { key: 'beauty',    label: 'Beauty',    price: 250, icon: Sparkles,   tagline: 'Glow from within.',                           tag: 'Glow Favorite',  category: 'beauty',    duration: '45–60 min', inside: 'Glutathione · Biotin · Vitamin C · B-Complex · Collagen support nutrients · Saline' },
  { key: 'recovery',  label: 'Recovery',  price: 250, icon: Heart,      tagline: 'Bounce back faster. Feel better sooner.',     tag: 'Same-Day Favorite', category: 'recovery', duration: '45–60 min', inside: 'Saline · Magnesium · B-Complex · Amino acids · Anti-nausea support · Electrolytes' },
  { key: 'jetlag',    label: 'Jet Lag',   price: 250, icon: Plane,      tagline: 'Land ready. Recover in flight time.',         tag: 'Travel Essential', category: 'travel',  duration: '45–60 min', inside: 'Saline · Vitamin B12 · Magnesium · B-Complex · Electrolytes · Immune support blend' },
  { key: 'myers',     label: "Myers' Cocktail", price: 250, icon: FlaskConical, tagline: 'The gold standard of IV therapy.',  tag: 'Most Popular',   category: 'energy',    duration: '45–60 min', inside: 'Magnesium · Calcium · Vitamins B1 B2 B3 B5 B6 · Vitamin C · Saline', popular: true },
  { key: 'postnight', label: 'Post-Night-Out', price: 250, icon: Moon,  tagline: 'Back to baseline, fast.',                    tag: 'Same-Day Favorite', category: 'recovery', duration: '45–60 min', inside: 'Saline · Anti-nausea support · B-Complex · Glutathione · Electrolytes' },
];

const IV_ADDONS = [
  { label: 'Extra Fluid',         price: 25,  desc: 'Additional 500ml saline' },
  { label: 'Extra Ingredients',   price: 30,  desc: 'B-complex, minerals & amino boost' },
  { label: 'High Dose Vitamin C', price: 45,  desc: '5,000mg IV push' },
  { label: 'CBD (33mg)',          price: 250, desc: 'Zero THC · full bioavailability' },
  { label: 'NAD+ (250mg)',        price: 350, desc: 'Cellular energy + repair' },
  { label: 'Glutathione Push',    price: 60,  desc: 'Antioxidant master push · 600mg' },
  { label: 'Magnesium Boost',     price: 30,  desc: 'Muscle + nerve support' },
];

const IM_SHOTS = [
  { label: 'B12',         price: 40, icon: Zap,           desc: 'Energy + metabolism support' },
  { label: 'MIC',         price: 50, icon: Flame,         desc: 'Fat metabolism + liver function' },
  { label: 'NAD+',        price: 80, icon: BatteryCharging,desc: 'Quick cellular energy boost' },
  { label: 'Glutathione', price: 50, icon: Sparkles,      desc: 'Antioxidant + skin clarity' },
  { label: 'Vitamin C',   price: 30, icon: Shield,        desc: 'Immune + antioxidant support' },
  { label: 'Vitamin D',   price: 35, icon: Zap,           desc: 'Bone, immune & mood support' },
  { label: 'Biotin',      price: 35, icon: Sparkles,      desc: 'Hair, skin & nail support' },
];

const PACKAGES = [
  { key: 'hangover',    label: 'Hangover Kit',        tagline: 'Recover from a rough night — fast.',        includes: ['Post-Night-Out IV', 'B12 IM shot', 'Glutathione IM shot'],           price: 340, save: 30, icon: Moon,        tag: 'Best for Tonight', items: [{ cartKey: 'pkg-hangover-iv', label: 'Post-Night-Out IV', price: 250, type: 'iv' }, { cartKey: 'pkg-hangover-b12', label: 'IM · B12', price: 40, type: 'im' }, { cartKey: 'pkg-hangover-glut', label: 'IM · Glutathione', price: 50, type: 'im' }] },
  { key: 'performance', label: 'Performance Bundle',  tagline: 'Built for peak output. Before or after.',   includes: ['Energy IV', 'NAD+ IM shot', 'MIC IM shot'],                          price: 380, save: 30, icon: Zap,         tag: 'Athlete Favorite', items: [{ cartKey: 'pkg-perf-iv', label: 'Energy IV', price: 250, type: 'iv' }, { cartKey: 'pkg-perf-nad', label: 'IM · NAD+', price: 80, type: 'im' }, { cartKey: 'pkg-perf-mic', label: 'IM · MIC', price: 50, type: 'im' }] },
  { key: 'glow',        label: 'Glow Stack',          tagline: 'Skin, hair, and radiance from within.',     includes: ['Beauty IV', 'Glutathione IM shot', 'Biotin IM shot'],                price: 335, save: 30, icon: Sparkles,    tag: 'Most Requested',  items: [{ cartKey: 'pkg-glow-iv', label: 'Beauty IV', price: 250, type: 'iv' }, { cartKey: 'pkg-glow-glut', label: 'IM · Glutathione', price: 50, type: 'im' }, { cartKey: 'pkg-glow-biotin', label: 'IM · Biotin', price: 35, type: 'im' }] },
  { key: 'reset',       label: 'Total Reset',         tagline: "The full protocol. Myers' + NAD+ + B12.",   includes: ["Myers' Cocktail IV", 'NAD+ add-on (250mg)', 'B12 IM shot'],          price: 680, save: 60, icon: FlaskConical,tag: 'Highest Impact',   items: [{ cartKey: 'pkg-reset-iv', label: "Myers' Cocktail IV", price: 250, type: 'iv' }, { cartKey: 'pkg-reset-nad', label: 'NAD+ Add-On (250mg)', price: 350, type: 'addon' }, { cartKey: 'pkg-reset-b12', label: 'IM · B12', price: 40, type: 'im' }] },
];

const IV_CATEGORIES = [
  { key: 'all',      label: 'All',      icon: LayoutGrid },
  { key: 'recovery', label: 'Recovery', icon: Heart },
  { key: 'energy',   label: 'Energy',   icon: Zap },
  { key: 'beauty',   label: 'Beauty',   icon: Sparkles },
  { key: 'immunity', label: 'Immunity', icon: ShieldCheck },
  { key: 'travel',   label: 'Travel',   icon: Plane },
];

const TABS = [
  { key: 'iv',       label: 'IV Drips' },
  { key: 'im',       label: 'IM Shots' },
  { key: 'packages', label: 'Packages' },
];

function CheckoutSheet({ cart, onRemove, onClose }) {
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
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-foreground/[0.08]">
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-0.5">Your Order</p>
            <p className="font-heading text-2xl text-foreground tracking-wide">{cart.length} Item{cart.length !== 1 ? 's' : ''}</p>
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
                <p className="font-body text-[10px] text-foreground/40">{item.type === 'im' ? '/ shot' : '/ session'}</p>
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
          <Link to="/apply"
            className="flex items-center justify-center gap-2 w-full py-4 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/85 transition-colors">
            Request Appointment <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
          <p className="font-body text-[10px] text-center text-foreground/30 tracking-wide">
            No charge until your RN confirms availability.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function RecoveryMenuSection() {
  const { items: cart, addItem, removeItem, clearItems: clearCart, itemsTotal: cartTotal } = useCart();

  const [activeTab,    setActiveTab]    = useState('iv');
  const [selectedKey,  setSelectedKey]  = useState(SESSIONS[0].key);
  const [addonsOpen,   setAddonsOpen]   = useState(false);
  const [insideOpen,   setInsideOpen]   = useState(false);
  const [ivCategory,   setIvCategory]   = useState('all');
  const [ivSelected,   setIvSelected]   = useState(new Set());
  const [imSelected,   setImSelected]   = useState(new Set());
  const [imDropOpen,   setImDropOpen]   = useState(false);
  const [groupOpen,    setGroupOpen]    = useState(false);
  const [groupCount,   setGroupCount]   = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const session       = SESSIONS.find((s) => s.key === selectedKey) || SESSIONS[0];
  const selIM         = IM_SHOTS.filter((s) => imSelected.has(s.label));
  const selIV         = IV_ADDONS.filter((a) => ivSelected.has(a.label));
  const baseTotal     = session.price + selIM.reduce((s, x) => s + x.price, 0) + selIV.reduce((s, x) => s + x.price, 0);
  const visitTotal    = baseTotal * groupCount;
  const imTotal       = selIM.reduce((s, x) => s + x.price, 0);

  const filteredSessions = ivCategory === 'all' ? SESSIONS : SESSIONS.filter((s) => s.category === ivCategory);

  const toggleIM = (label) => setImSelected((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });
  const toggleIV = (label) => setIvSelected((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });

  const handleBookIV = () => {
    if (!cart.some((i) => i.cartKey === session.key))
      addItem({ cartKey: session.key, label: session.label, price: session.price, type: 'iv' });
    selIM.forEach((s) => { if (!cart.some((i) => i.cartKey === `im-${s.label}`)) addItem({ cartKey: `im-${s.label}`, label: `IM · ${s.label}`, price: s.price, type: 'im' }); });
    selIV.forEach((a) => { if (!cart.some((i) => i.cartKey === `iv-${a.label}`)) addItem({ cartKey: `iv-${a.label}`, label: a.label, price: a.price, type: 'addon' }); });
    setImSelected(new Set()); setIvSelected(new Set());
    setCheckoutOpen(true);
  };

  const handleBookIM = () => {
    selIM.forEach((s) => { if (!cart.some((i) => i.cartKey === `im-${s.label}`)) addItem({ cartKey: `im-${s.label}`, label: `IM · ${s.label}`, price: s.price, type: 'im' }); });
    setImSelected(new Set());
    setCheckoutOpen(true);
  };

  const handleAddPackage = (pkg) => {
    pkg.items.forEach((item) => { if (!cart.some((i) => i.cartKey === item.cartKey)) addItem(item); });
    setCheckoutOpen(true);
  };

  return (
    <section
      id="treatments"
      className="scroll-mt-20 md:scroll-mt-28 py-16 md:py-24"
    >
      <div className="max-w-lg mx-auto px-5 md:px-8 space-y-5">

        {/* ── Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/60">One-Time Visit</p>
            <span className="font-body text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full border border-foreground/20 text-foreground/50 font-semibold">
              No membership required
            </span>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl text-foreground uppercase tracking-tight leading-none">
            Recovery Menu
          </h2>
        </div>

        {/* ── Category Tabs */}
        <div className="flex items-center border border-foreground/10 rounded-2xl p-1 bg-foreground/[0.02]">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-xl font-body text-[10px] tracking-[0.15em] uppercase font-semibold transition-all duration-200 ${
                activeTab === tab.key ? 'bg-foreground text-background shadow-sm' : 'text-foreground/50 hover:text-foreground/80'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ══ IV DRIPS ══ */}
          {activeTab === 'iv' && (
            <motion.div key="iv" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }} className="space-y-4">

              {/* Filter chips */}
              <div className="-mx-5 px-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {IV_CATEGORIES.map((cat) => (
                  <button key={cat.key} type="button"
                    onClick={() => { setIvCategory(cat.key); if (cat.key !== 'all' && !SESSIONS.find(s => s.category === cat.key && s.key === selectedKey)) { const first = SESSIONS.find(s => s.category === cat.key); if (first) setSelectedKey(first.key); } }}
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-body text-[9px] tracking-[0.15em] uppercase font-semibold border transition-all ${
                      ivCategory === cat.key ? 'bg-foreground text-background border-foreground' : 'border-foreground/15 text-foreground/50 hover:border-foreground/30 hover:text-foreground/70'
                    }`}>
                    <cat.icon className="w-3 h-3" strokeWidth={1.8} />{cat.label}
                  </button>
                ))}
              </div>

              <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40">IV Drip</p>

              {/* Session grid */}
              <div className="grid grid-cols-2 gap-2">
                {filteredSessions.map((s) => (
                  <button key={s.key} type="button" onClick={() => { setSelectedKey(s.key); setInsideOpen(false); }}
                    className={`relative flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all duration-200 ${
                      selectedKey === s.key ? 'border-foreground/50 bg-foreground/[0.06]' : 'border-foreground/[0.12] hover:border-foreground/25 hover:bg-foreground/[0.02]'
                    }`}>
                    {selectedKey === s.key && (
                      <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-foreground flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <s.icon className={`w-4 h-4 shrink-0 ${selectedKey === s.key ? 'text-foreground' : 'text-foreground/40'}`} strokeWidth={1.5} />
                      <span className={`font-body text-xs font-semibold tracking-[0.08em] ${selectedKey === s.key ? 'text-foreground' : 'text-foreground/70'}`}>{s.label}</span>
                    </div>
                    {s.tag && (
                      <span className={`self-start font-body text-[8px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border ${
                        s.popular ? 'bg-accent/20 text-accent border-accent/30' : 'bg-foreground/[0.06] text-foreground/40 border-foreground/[0.08]'
                      }`}>{s.tag}</span>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-body text-[10px] text-foreground/40 leading-tight flex-1 pr-2">{s.tagline}</span>
                      <span className={`font-body text-sm font-semibold shrink-0 ${selectedKey === s.key ? 'text-foreground' : 'text-foreground/50'}`}>${s.price}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* What's Inside */}
              <button type="button" onClick={() => setInsideOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-foreground/10 text-left hover:bg-foreground/[0.02] transition-colors">
                <Info className={`w-3.5 h-3.5 transition-colors ${insideOpen ? 'text-accent' : 'text-foreground/40'}`} strokeWidth={1.8} />
                <span className="flex-1 font-body text-xs tracking-[0.1em] uppercase text-foreground/60">What's Inside</span>
                <span className="font-body text-[10px] text-foreground/30">{session.duration}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-foreground/30 transition-transform duration-300 ${insideOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>
              <AnimatePresence>
                {insideOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                    <div className="px-4 pt-2 pb-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] space-y-2">
                      <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40">Formulated with</p>
                      <div className="flex flex-wrap gap-1.5">
                        {session.inside.split(' · ').map((ing) => (
                          <span key={ing} className="font-body text-[10px] text-foreground/70 bg-foreground/[0.06] border border-foreground/[0.08] px-2.5 py-1 rounded-full">{ing}</span>
                        ))}
                      </div>
                      <p className="font-body text-[10px] text-foreground/30 pt-1">For educational purposes only. Formulation may vary based on clinical assessment.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Add to IV */}
              <button type="button" onClick={() => setAddonsOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-foreground/10 text-left hover:bg-foreground/[0.02] transition-colors">
                <Plus className={`w-3.5 h-3.5 text-foreground/40 transition-transform duration-300 ${addonsOpen ? 'rotate-45' : ''}`} strokeWidth={2} />
                <span className="flex-1 font-body text-xs tracking-[0.1em] uppercase text-foreground/60">Add to your IV</span>
                {ivSelected.size > 0 && <span className="font-body text-xs text-foreground/50">+${selIV.reduce((s, x) => s + x.price, 0)} · {ivSelected.size} added</span>}
              </button>
              <AnimatePresence>
                {addonsOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                    <div className="space-y-1.5 pt-1">
                      {IV_ADDONS.map((addon) => {
                        const sel = ivSelected.has(addon.label);
                        return (
                          <button key={addon.label} type="button" onClick={() => toggleIV(addon.label)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${sel ? 'border-foreground/30 bg-foreground/[0.04]' : 'border-foreground/10 hover:border-foreground/20'}`}>
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
                  </motion.div>
                )}
              </AnimatePresence>

              {/* IM shots as add-on */}
              <div className="border border-foreground/15 rounded-2xl overflow-hidden">
                <button type="button" onClick={() => setImDropOpen((v) => !v)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-foreground/[0.02] transition-colors">
                  <Syringe className="w-4 h-4 text-foreground/50 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 font-body text-sm text-foreground">IM Recovery Shots</span>
                  {imSelected.size > 0 && <span className="font-body text-xs text-foreground/50 mr-1">+${selIM.reduce((s, x) => s + x.price, 0)} · {imSelected.size} selected</span>}
                  <ChevronDown className={`w-4 h-4 text-foreground/40 transition-transform duration-300 shrink-0 ${imDropOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                </button>
                <AnimatePresence>
                  {imDropOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden border-t border-foreground/[0.08]">
                      {IM_SHOTS.map((shot) => {
                        const sel = imSelected.has(shot.label);
                        return (
                          <button key={shot.label} type="button" onClick={() => toggleIM(shot.label)}
                            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left border-b border-foreground/[0.05] last:border-b-0 transition-colors ${sel ? 'bg-foreground/[0.04]' : 'hover:bg-foreground/[0.02]'}`}>
                            <shot.icon className={`w-4 h-4 shrink-0 ${sel ? 'text-foreground' : 'text-foreground/35'}`} strokeWidth={1.5} />
                            <div className="flex-1 min-w-0">
                              <p className={`font-body text-sm ${sel ? 'text-foreground font-medium' : 'text-foreground/70'}`}>{shot.label}</p>
                              <p className="font-body text-[10px] text-foreground/40">{shot.desc}</p>
                            </div>
                            <span className={`font-body text-sm shrink-0 ${sel ? 'text-foreground' : 'text-foreground/40'}`}>${shot.price}</span>
                            {sel && <Check className="w-3.5 h-3.5 text-foreground ml-1 shrink-0" strokeWidth={2.5} />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Group booking */}
              <div>
                <button type="button" onClick={() => setGroupOpen((v) => !v)}
                  className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity">
                  <span className="font-body text-xs text-foreground/50 tracking-[0.1em]">Booking for a group?</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-foreground/40 transition-transform duration-300 ${groupOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                </button>
                <AnimatePresence>
                  {groupOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                      <div className="mt-3 rounded-2xl border border-foreground/15 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-body text-xs text-foreground">Number of guests</p>
                            <p className="font-body text-[10px] text-foreground/40 mt-0.5">We bring additional RNs for groups of 4+</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setGroupCount((c) => Math.max(1, c - 1))} className="w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors text-lg leading-none">−</button>
                            <span className="font-heading text-xl text-foreground w-5 text-center">{groupCount}</span>
                            <button type="button" onClick={() => setGroupCount((c) => Math.min(8, c + 1))} className="w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors text-lg leading-none">+</button>
                          </div>
                        </div>
                        {groupCount >= 8 && (
                          <p className="font-body text-[10px] text-foreground/50">For groups of 9+, <Link to="/events" className="text-accent hover:text-accent/80 transition-colors">use our Events booking →</Link></p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Total + CTA */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <span className="font-body text-sm text-foreground/50 tracking-[0.15em] uppercase">Estimated Visit Total</span>
                    {groupCount > 1 && <p className="font-body text-[10px] text-foreground/40 mt-0.5">{groupCount} guests × ${baseTotal.toLocaleString()} each</p>}
                  </div>
                  <span className="font-heading text-2xl text-foreground tracking-tight">${visitTotal.toLocaleString()}</span>
                </div>
                <motion.button type="button" onClick={handleBookIV} whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors">
                  <span>Request This Visit</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </motion.button>
                <div className="flex items-center gap-2 px-1">
                  <span className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40">Members save 20% ·</span>
                  <Link to="/membership" className="font-body text-[10px] tracking-[0.2em] uppercase text-accent hover:text-accent/80 transition-colors">View memberships →</Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ IM SHOTS ══ */}
          {activeTab === 'im' && (
            <motion.div key="im" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }} className="space-y-4">
              <div>
                <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-1">IM Recovery Shots</p>
                <p className="font-body text-xs text-foreground/50">Under 5 minutes. No IV line. Select one or more.</p>
              </div>
              <div className="space-y-2">
                {IM_SHOTS.map((shot) => {
                  const sel = imSelected.has(shot.label);
                  return (
                    <button key={shot.label} type="button" onClick={() => toggleIM(shot.label)}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-all ${sel ? 'border-foreground/40 bg-foreground/[0.05]' : 'border-foreground/15 hover:border-foreground/25 hover:bg-foreground/[0.02]'}`}>
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-colors ${sel ? 'border-foreground bg-foreground' : 'border-foreground/20 bg-foreground/[0.04]'}`}>
                        {sel ? <Check className="w-3.5 h-3.5 text-background" strokeWidth={2.5} /> : <shot.icon className="w-3.5 h-3.5 text-foreground/50" strokeWidth={1.5} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-body text-sm ${sel ? 'text-foreground font-medium' : 'text-foreground/80'}`}>{shot.label}</p>
                        <p className="font-body text-[10px] text-foreground/45 mt-0.5">{shot.desc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-body text-sm ${sel ? 'text-foreground' : 'text-foreground/50'}`}>${shot.price}</p>
                        <p className="font-body text-[9px] text-foreground/30 mt-0.5">/ shot</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <span className="font-body text-sm text-foreground/50 tracking-[0.15em] uppercase">Estimated Total</span>
                    {imSelected.size > 0 && <p className="font-body text-[10px] text-foreground/40 mt-0.5">{imSelected.size} shot{imSelected.size !== 1 ? 's' : ''} selected</p>}
                  </div>
                  <span className="font-heading text-2xl text-foreground tracking-tight">{imSelected.size > 0 ? `$${imTotal.toLocaleString()}` : '—'}</span>
                </div>
                <motion.button type="button" onClick={handleBookIM} whileTap={{ scale: 0.98 }} disabled={imSelected.size === 0}
                  className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <span>{imSelected.size === 0 ? 'Select a shot to continue' : 'Request IM Shots'}</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </motion.button>
                <p className="font-body text-[10px] text-center text-foreground/30 tracking-wide">Add on to any IV visit.</p>
              </div>
            </motion.div>
          )}

          {/* ══ PACKAGES ══ */}
          {activeTab === 'packages' && (
            <motion.div key="packages" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }} className="space-y-4">
              <div>
                <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-1">Curated Packages</p>
                <p className="font-body text-xs text-foreground/50">Pre-built protocols — IV + IM, priced together. Save vs. à la carte.</p>
              </div>
              <div className="space-y-3">
                {PACKAGES.map((pkg, i) => (
                  <motion.div key={pkg.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: i * 0.06 }} className="border border-foreground/15 rounded-2xl overflow-hidden">
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
                      <div className="space-y-1 mb-4">
                        {pkg.includes.map((item) => (
                          <div key={item} className="flex items-center gap-2">
                            <ChevronRight className="w-3 h-3 text-foreground/30 shrink-0" strokeWidth={2} />
                            <span className="font-body text-[10px] text-foreground/60">{item}</span>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => handleAddPackage(pkg)}
                        className="w-full flex items-center justify-between px-5 py-3 rounded-xl bg-foreground text-background font-body text-[10px] tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors">
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
        </AnimatePresence>
      </div>

      {/* ── Sticky cart bar */}
      <AnimatePresence>
        {cart.length > 0 && !checkoutOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="fixed bottom-0 md:bottom-4 left-0 md:left-1/2 md:-translate-x-1/2 z-50 w-full md:w-[calc(100%-2rem)] md:max-w-xl"
          >
            <div className="bg-white/10 backdrop-blur-2xl border-t md:border border-white/20 md:rounded-3xl px-5 py-4 md:py-3.5 shadow-2xl shadow-black/40 flex items-center gap-3">
              <div className="relative shrink-0">
                <ShoppingBag className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-background font-body text-[10px] font-bold flex items-center justify-center leading-none">{cart.length}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs text-foreground truncate">{cart.map((i) => i.label).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="font-heading text-xl text-foreground tracking-wide">${cartTotal.toLocaleString()}</span>
                <button type="button" onClick={() => setCheckoutOpen(true)}
                  className="px-5 py-2.5 font-body text-xs tracking-widest uppercase font-semibold rounded-full bg-foreground text-background hover:bg-foreground/85 transition-colors">
                  Review Request
                </button>
                <button type="button" onClick={clearCart} aria-label="Clear cart"
                  className="w-8 h-8 rounded-full border border-white/20 bg-white/[0.06] flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-white/[0.12] transition-colors flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutSheet cart={cart} onRemove={removeItem} onClose={() => setCheckoutOpen(false)} />
        )}
      </AnimatePresence>
    </section>
  );
}
