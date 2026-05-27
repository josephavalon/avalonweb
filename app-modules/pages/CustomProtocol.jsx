import React, { useState } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '@/lib/analytics';
import { useCart } from '@/context/CartContext';
import { Droplets, Zap, Syringe, ChevronDown, ArrowRight, Check, Plus } from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];
const QTY_OPTIONS = [1, 2, 3, 4];

// ─── Catalogue ────────────────────────────────────────────────────────────────

const VITAMINS_VARIANTS = [
  { label: 'Hydration',        price: 150, desc: 'Fluids + electrolytes' },
  { label: "Myers' Cocktail",  price: 175, desc: 'B-complex, magnesium, vitamin C, calcium' },
  { label: 'Recovery',         price: 200, desc: 'Amino acids, electrolytes, B12' },
  { label: 'Athletic',         price: 200, desc: 'Performance amino acids + hydration' },
  { label: 'Glow',             price: 200, desc: 'Glutathione, vitamin C, biotin' },
  { label: 'Immunity',         price: 175, desc: 'High-dose vitamin C, zinc, B-complex' },
];

const CBD_DOSES = [
  { label: '33mg',  price: 250 },
  { label: '66mg',  price: 350 },
  { label: '99mg',  price: 450 },
  { label: '132mg', price: 550 },
];

const NAD_DOSES = [
  { label: '250mg',  price: 350  },
  { label: '500mg',  price: 500  },
  { label: '750mg',  price: 650  },
  { label: '1000mg', price: 800  },
  { label: '1250mg', price: 950  },
  { label: '1500mg', price: 1100 },
];

const IM_OPTIONS = [
  { key: 'b12',   label: 'B12',         price: 40, desc: 'Energy + metabolism'       },
  { key: 'gluta', label: 'Glutathione', price: 50, desc: 'Antioxidant + skin clarity' },
  { key: 'mic',   label: 'MIC',         price: 50, desc: 'Fat metabolism + liver'     },
  { key: 'nad',   label: 'NAD+',        price: 80, desc: 'Cellular energy boost'      },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StyledSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-2xl border border-foreground/[0.10] bg-card/[0.72] px-4 py-3 pr-10 font-body text-xs uppercase tracking-[0.18em] text-foreground transition-colors hover:border-foreground/25 focus:outline-none focus:border-foreground/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-background text-foreground normal-case tracking-normal">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" strokeWidth={1.8} />
    </div>
  );
}

// Inline 1–4 qty selector used inside each treatment row
function QtyPicker({ value, onChange }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <p className="shrink-0 font-body text-[9px] uppercase tracking-[0.25em] text-foreground/40">
        Monthly Qty
      </p>
      <div className="flex gap-1">
        {QTY_OPTIONS.map(q => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={`h-11 w-11 rounded-lg font-body text-xs font-semibold transition-all duration-150 ${
              value === q
                ? 'bg-foreground text-background'
                : 'border border-foreground/15 bg-card/[0.45] text-foreground/50 hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function OneTimeNote() {
  return (
    <p className="mt-4 inline-flex rounded-full border border-foreground/[0.10] bg-background/[0.22] px-3 py-1.5 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/45">
      One-time visit
    </p>
  );
}

function TreatmentRow({ icon: Icon, title, tag, fromPrice, active, onToggle, children }) {
  return (
    <motion.div layout className="overflow-hidden rounded-3xl border border-foreground/[0.10] bg-card/[0.60] backdrop-blur-md">
      <div className="flex items-start gap-4 p-4">
        <button
          type="button"
          onClick={onToggle}
          className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
            active
              ? 'bg-foreground border-foreground text-background'
              : 'border-border/60 text-foreground/40 hover:border-foreground/50 hover:text-foreground/70'
          }`}
          aria-pressed={active}
        >
          {active ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2} />}
        </button>

        <div className={`min-w-0 flex-1 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-60'}`}>
          <button type="button" onClick={onToggle} className="w-full text-left">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon className="mt-0.5 h-4 w-4 text-foreground/65" strokeWidth={1.5} />
              <span className="font-heading text-2xl uppercase tracking-wide text-foreground">{title}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!active && (
                <span className="font-body text-[10px] uppercase tracking-[0.18em] text-foreground/45">
                  from ${fromPrice}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 text-foreground/60 transition-transform duration-300 ${active ? 'rotate-180' : ''}`} strokeWidth={1.8} />
            </div>
          </div>
          <p className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/50">{tag}</p>
          </button>

          <AnimatePresence>
            {active && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="mt-4 border-t border-foreground/[0.08] pt-4">
                  {children}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomProtocol() {
  useSeo({ title: 'Custom Protocol — Avalon Vitality', description: 'Build a fully custom IV therapy protocol with your choice of drip, add-ons, and frequency.', path: '/custom' });
  const { addItem, clearItems, setMembershipTier, clearMembership } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Treatment on/off
  const [vitaminsOn, setVitaminsOn] = useState(true);
  const [cbdOn, setCbdOn]           = useState(false);
  const [nadOn, setNadOn]           = useState(false);

  // Variant / dose selections
  const [vitaminsVariant, setVitaminsVariant] = useState(VITAMINS_VARIANTS[0]);
  const [cbdDose, setCbdDose]                 = useState(CBD_DOSES[0]);
  const [nadDose, setNadDose]                 = useState(NAD_DOSES[0]);

  // Billing mode
  const [billingMode, setBillingMode] = useState(() => searchParams.get('mode') === 'subscription' ? 'subscription' : 'onetime'); // 'onetime' | 'subscription'
  const isSubscription = billingMode === 'subscription';

  // Per-treatment quantities (per visit for one-time; per month for subscription)
  const [vitaminsQty, setVitaminsQty] = useState(1);
  const [cbdQty, setCbdQty]           = useState(1);
  const [nadQty, setNadQty]           = useState(1);

  // IM shots: selected keys + per-shot qty
  const [imSelected, setImSelected] = useState([]);
  const [imQty, setImQty]           = useState({ b12: 1, gluta: 1, mic: 1, nad: 1 });

  const toggleIM = (key) =>
    setImSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  const setImShotQty = (key, qty) =>
    setImQty(prev => ({ ...prev, [key]: qty }));

  // ── Price calculation ─────────────────────────────────────────────────
  const effectiveVitaminsQty = isSubscription ? vitaminsQty : 1;
  const effectiveCbdQty = isSubscription ? cbdQty : 1;
  const effectiveNadQty = isSubscription ? nadQty : 1;
  const effectiveImQty = (key) => isSubscription ? imQty[key] : 1;

  const vitaminsCost = vitaminsOn ? vitaminsVariant.price * effectiveVitaminsQty : 0;
  const cbdCost      = cbdOn      ? cbdDose.price      * effectiveCbdQty        : 0;
  const nadCost      = nadOn      ? nadDose.price       * effectiveNadQty        : 0;
  const imCost       = IM_OPTIONS
    .filter(s => imSelected.includes(s.key))
    .reduce((sum, s) => sum + s.price * effectiveImQty(s.key), 0);
  const monthlyTotal = vitaminsCost + cbdCost + nadCost + imCost;

  // ── Line items for summary ─────────────────────────────────────────────
  const lineItems = [
    vitaminsOn && {
      label: `IV Vitamins — ${vitaminsVariant.label}`,
      qty:   effectiveVitaminsQty,
      price: vitaminsVariant.price,
      total: vitaminsCost,
    },
    cbdOn && {
      label: `IV CBD — ${cbdDose.label}`,
      qty:   effectiveCbdQty,
      price: cbdDose.price,
      total: cbdCost,
    },
    nadOn && {
      label: `IV NAD+ — ${nadDose.label}`,
      qty:   effectiveNadQty,
      price: nadDose.price,
      total: nadCost,
    },
    ...IM_OPTIONS
      .filter(s => imSelected.includes(s.key))
      .map(s => ({
        label: `IM ${s.label}`,
        qty:   effectiveImQty(s.key),
        price: s.price,
        total: s.price * effectiveImQty(s.key),
      })),
  ].filter(Boolean);

  return (
    <>
      <Navbar showBack />

      <div className="min-h-screen bg-background pt-28 pb-32">
        <div className="max-w-6xl mx-auto px-4">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="mb-8 md:mb-12"
          >
            <p className="mb-3 font-body text-xs uppercase tracking-[0.35em] text-foreground/60">Custom Protocol</p>
            <h1 className="mb-4 font-heading text-[13vw] uppercase leading-[0.88] tracking-wide text-foreground md:text-[7rem] lg:text-[9rem]">
              Build Your<br />Protocol
            </h1>
            <div className="mb-4 h-px w-12 bg-foreground/35" />
            <p className="max-w-lg font-body text-sm leading-relaxed text-foreground/70">
              Choose your stack, set your quantity per treatment, get an instant estimate.
              Final pricing confirmed with your care team before you commit.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-[1fr_340px] gap-10 lg:gap-14 items-start">

            {/* ══ LEFT — Stack Builder ══ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.7, ease: EASE }}
              className="space-y-3"
            >

              {/* ── IV Vitamins ── */}
              <TreatmentRow
                icon={Droplets}
                title="IV Vitamins"
                tag="Hydration & Micronutrients"
                fromPrice={150}
                active={vitaminsOn}
                onToggle={() => setVitaminsOn(v => !v)}
              >
                <div className="space-y-2">
                  <StyledSelect
                    value={vitaminsVariant.label}
                    onChange={val => { setVitaminsVariant(VITAMINS_VARIANTS.find(v => v.label === val)); track('protocol_vitamin_selected', { label: val }); }}
                    options={VITAMINS_VARIANTS.map(v => ({ value: v.label, label: `${v.label}  —  $${v.price}` }))}
                  />
                  <p className="pl-1 font-body text-[11px] text-foreground/60">{vitaminsVariant.desc}</p>
                  {isSubscription ? (
                    <QtyPicker value={vitaminsQty} onChange={setVitaminsQty} />
                  ) : (
                    <OneTimeNote />
                  )}
                </div>
              </TreatmentRow>

              {/* ── IV CBD ── */}
              <TreatmentRow
                icon={CannabisLeaf}
                title="CBD IV Review"
                tag="Approval gated"
                fromPrice={250}
                active={cbdOn}
                onToggle={() => setCbdOn(v => !v)}
              >
                <div className="space-y-2">
                  <StyledSelect
                    value={cbdDose.label}
                    onChange={val => setCbdDose(CBD_DOSES.find(d => d.label === val))}
                    options={CBD_DOSES.map(d => ({ value: d.label, label: `${d.label}  —  $${d.price}` }))}
                  />
                  {isSubscription ? (
                    <QtyPicker value={cbdQty} onChange={setCbdQty} />
                  ) : (
                    <OneTimeNote />
                  )}
                </div>
              </TreatmentRow>

              {/* ── IV NAD+ ── */}
              <TreatmentRow
                icon={Zap}
                title="IV NAD+"
                tag="Cellular Repair"
                fromPrice={350}
                active={nadOn}
                onToggle={() => setNadOn(v => !v)}
              >
                <div className="space-y-2">
                  <StyledSelect
                    value={nadDose.label}
                    onChange={val => { setNadDose(NAD_DOSES.find(d => d.label === val)); track('protocol_nad_selected', { dose: val }); }}
                    options={NAD_DOSES.map(d => ({ value: d.label, label: `${d.label}  —  $${d.price}` }))}
                  />
                  {isSubscription ? (
                    <QtyPicker value={nadQty} onChange={setNadQty} />
                  ) : (
                    <OneTimeNote />
                  )}
                </div>
              </TreatmentRow>

              {/* ── IM Shots ── */}
              <div className="rounded-3xl border border-foreground/[0.10] bg-card/[0.60] p-4 backdrop-blur-md">
                <div className="mb-1 flex items-center gap-2">
                  <Syringe className="h-4 w-4 text-foreground/65" strokeWidth={1.5} />
                  <span className="font-heading text-2xl uppercase tracking-wide text-foreground">IM Shots</span>
                </div>
                <p className="mb-4 font-body text-[10px] uppercase tracking-[0.22em] text-foreground/50">
                  Add-Ons — Select any combination
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {IM_OPTIONS.map(shot => {
                    const on = imSelected.includes(shot.key);
                    return (
                      <div
                        key={shot.key}
                        className={`rounded-2xl border transition-all duration-200 ${
                          on
                            ? 'border-foreground bg-foreground/[0.06]'
                            : 'border-foreground/[0.10] bg-card/[0.45]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleIM(shot.key)}
                          className="flex items-start justify-between gap-2 p-3.5 w-full text-left"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {on && <Check className="w-2.5 h-2.5 text-accent shrink-0" strokeWidth={3} />}
                              <span className="font-heading text-sm tracking-wide text-foreground uppercase">
                                {shot.label}
                              </span>
                            </div>
                            <span className="font-body text-[10px] text-foreground/60 leading-tight">
                              {shot.desc}
                            </span>
                          </div>
                          <span className="font-heading text-base text-accent shrink-0">${shot.price}</span>
                        </button>

                        {/* Monthly quantity — only shown for subscriptions */}
                        <AnimatePresence>
                          {on && isSubscription && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <div className="flex items-center gap-2 px-3.5 pb-3 border-t border-foreground/[0.06] pt-2.5">
                                <p className="shrink-0 font-body text-[9px] uppercase tracking-[0.2em] text-foreground/40">
                                  Qty
                                </p>
                                <div className="flex gap-1">
                                  {QTY_OPTIONS.map(q => (
                                    <button
                                      key={q}
                                      type="button"
                                      onClick={() => setImShotQty(shot.key, q)}
                                      className={`w-7 h-7 rounded-lg font-body text-[11px] font-semibold transition-all duration-150 ${
                                        imQty[shot.key] === q
                                          ? 'bg-foreground text-background'
                                          : 'border border-foreground/15 text-foreground/50 hover:border-foreground/40 hover:text-foreground'
                                      }`}
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* ══ RIGHT — Live Summary ══ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7, ease: EASE }}
              className="lg:sticky lg:top-28"
            >
              <div className="rounded-3xl border border-foreground/[0.10] bg-card/[0.70] p-6 shadow-[0_24px_80px_hsl(var(--foreground)/0.08)] backdrop-blur-md">
                <p className="mb-4 font-body text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                  Protocol Summary
                </p>

                {/* One-time / Subscription toggle */}
                <div className="mb-5 flex gap-1 rounded-2xl border border-foreground/[0.10] bg-background/[0.45] p-1">
                  {['onetime', 'subscription'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBillingMode(mode)}
                      className={`flex-1 min-h-10 rounded-xl py-2.5 font-body text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 ${
                        billingMode === mode
                          ? 'bg-foreground text-background shadow-sm'
                          : 'text-foreground/50 hover:text-foreground/80'
                      }`}
                    >
                      {mode === 'onetime' ? 'One Time' : 'Subscription'}
                    </button>
                  ))}
                </div>

                {/* Line items */}
                <div className="mb-5 min-h-[72px] space-y-2">
                  <AnimatePresence mode="popLayout">
                    {lineItems.length === 0 ? (
                      <motion.p
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="font-body text-xs text-foreground/40"
                      >
                        Add treatments to build your stack.
                      </motion.p>
                    ) : (
                      lineItems.map(item => (
                        <motion.div
                          key={item.label + item.qty}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className="flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <span className="font-body text-xs text-foreground/80 leading-tight block">
                              {item.label}
                            </span>
                            {item.qty > 1 && (
                              <span className="font-body text-[10px] text-foreground/40">
                                ${item.price} × {item.qty}
                              </span>
                            )}
                          </div>
                          <span className="font-heading text-sm text-foreground shrink-0">
                            ${item.total.toLocaleString()}
                          </span>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>

                {/* Monthly total — hero number */}
                <div className="mb-5 border-t border-foreground/[0.10] pt-4">
                  <p className="mb-1 font-body text-[10px] uppercase tracking-[0.3em] text-foreground/55">
                    {billingMode === 'subscription' ? 'Est. Monthly' : 'Est. Total'}
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={monthlyTotal}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="font-heading text-7xl leading-none tracking-tight text-foreground"
                    >
                      ${monthlyTotal.toLocaleString()}
                    </motion.div>
                  </AnimatePresence>
                  <p className="mt-2 font-body text-[10px] leading-relaxed text-foreground/45">
                    {billingMode === 'subscription'
                      ? 'Billed monthly · Cancel anytime'
                      : 'Estimate only — final pricing confirmed with your care team.'}
                  </p>
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => {
                    clearItems();
                    const items = [];
                    if (vitaminsOn && vitaminsVariant) {
                      for (let i = 0; i < effectiveVitaminsQty; i++)
                        items.push({ cartKey: `iv-vitamins-${i}`, label: vitaminsVariant.label, price: vitaminsVariant.price, type: 'iv' });
                    }
                    if (nadOn && nadDose) {
                      for (let i = 0; i < effectiveNadQty; i++)
                        items.push({ cartKey: `iv-nad-${i}`, label: `NAD+ ${nadDose.label}`, price: nadDose.price, type: 'iv' });
                    }
                    if (cbdOn && cbdDose) {
                      for (let i = 0; i < effectiveCbdQty; i++)
                        items.push({ cartKey: `iv-cbd-${i}`, label: `CBD ${cbdDose.label}`, price: cbdDose.price, type: 'iv' });
                    }
                    imSelected.forEach((shotKey) => {
                      const shot = IM_OPTIONS.find(s => s.key === shotKey);
                      if (shot) {
                        for (let i = 0; i < effectiveImQty(shotKey); i++)
                          items.push({ cartKey: `im-${shotKey}-${i}`, label: shot.label, price: shot.price, type: 'im' });
                      }
                    });
                    if (billingMode === 'subscription') {
                      clearMembership?.();
                      setMembershipTier?.({
                        key: 'custom',
                        name: 'Custom Subscription',
                        billing: 'monthly',
                        price: monthlyTotal,
                        ivCount: effectiveVitaminsQty + effectiveCbdQty + effectiveNadQty,
                        custom: true,
                        items,
                      });
                      track('protocol_completed', { item_count: items.length, billing: billingMode });
                      navigate('/checkout');
                      return;
                    }
                    clearMembership?.();
                    items.forEach(item => addItem?.(item));
                    track('protocol_completed', { item_count: items.length, billing: billingMode });
                    navigate('/checkout');
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 font-body text-xs font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-foreground/90"
                >
                  {billingMode === 'subscription' ? 'Start Subscription' : 'Proceed to Checkout'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <p className="mt-3 text-center font-body text-[10px] text-foreground/40">
                  Free consult · No commitment
                </p>
              </div>
            </motion.div>
          </div>

          {/* FDA disclaimer */}
          <div className="mt-20 pt-8 border-t border-border/20">
            <p className="font-body text-xs text-foreground/40 leading-relaxed max-w-2xl">
              Statements made by Avalon Vitality about its services have not been evaluated by the U.S. Food
              and Drug Administration. Services are not intended to diagnose, treat, cure, or prevent any
              disease. Information is for educational purposes only and is not a substitute for professional
              medical advice. Individual results vary. Always consult your physician before beginning any therapy.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
