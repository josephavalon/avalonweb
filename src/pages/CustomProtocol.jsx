import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { track } from '@/lib/analytics';
import { useCart } from '@/context/CartContext';
import { Droplets, Zap, Syringe, ChevronDown, ArrowRight, Check, Plus, Minus } from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import StickyMobileCTA from '@/components/landing/StickyMobileCTA';
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
        className="w-full appearance-none bg-white/[0.04] border border-border/50 text-foreground font-body text-xs tracking-widest uppercase rounded-xl px-3 py-2.5 pr-8 focus:outline-none focus:border-accent/60 cursor-pointer transition-colors hover:border-foreground/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-background text-foreground normal-case tracking-normal">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/50" strokeWidth={1.8} />
    </div>
  );
}

// Inline 1–4 qty selector used inside each treatment row
function QtyPicker({ value, onChange, label = 'per month' }) {
  return (
    <div className="flex items-center gap-3 mt-3">
      <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/40 shrink-0">
        × / mo
      </p>
      <div className="flex gap-1">
        {QTY_OPTIONS.map(q => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={`w-8 h-8 rounded-lg font-body text-xs font-semibold transition-all duration-150 ${
              value === q
                ? 'bg-foreground text-background'
                : 'border border-foreground/15 text-foreground/50 hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            {q}
          </button>
        ))}
      </div>
      <p className="font-body text-[9px] text-foreground/30">per month</p>
    </div>
  );
}

function TreatmentRow({ icon: Icon, title, tag, fromPrice, active, onToggle, children }) {
  return (
    <motion.div layout className="border-b border-border/20 py-5">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={onToggle}
          className={`mt-1 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 ${
            active
              ? 'bg-foreground border-foreground text-background'
              : 'border-border/60 text-foreground/40 hover:border-foreground/50 hover:text-foreground/70'
          }`}
          aria-pressed={active}
        >
          {active ? <Check className="w-3 h-3" strokeWidth={2.5} /> : <Plus className="w-3 h-3" strokeWidth={2} />}
        </button>

        <div className={`flex-1 min-w-0 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-50'}`}>
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />
              <span className="font-heading text-xl tracking-wide text-foreground uppercase">{title}</span>
            </div>
            {!active && (
              <span className="font-body text-xs tracking-widest uppercase text-foreground/50 shrink-0">
                from ${fromPrice}
              </span>
            )}
          </div>
          <p className="font-body text-[10px] tracking-[0.22em] uppercase text-foreground/50 mb-3">{tag}</p>

          <AnimatePresence>
            {active && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {children}
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
  const { addItem } = useCart();
  const navigate = useNavigate();
  // Treatment on/off
  const [vitaminsOn, setVitaminsOn] = useState(true);
  const [cbdOn, setCbdOn]           = useState(false);
  const [nadOn, setNadOn]           = useState(false);

  // Variant / dose selections
  const [vitaminsVariant, setVitaminsVariant] = useState(VITAMINS_VARIANTS[0]);
  const [cbdDose, setCbdDose]                 = useState(CBD_DOSES[0]);
  const [nadDose, setNadDose]                 = useState(NAD_DOSES[0]);

  // Per-treatment monthly quantities (1–4)
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
  const vitaminsCost = vitaminsOn ? vitaminsVariant.price * vitaminsQty : 0;
  const cbdCost      = cbdOn      ? cbdDose.price      * cbdQty        : 0;
  const nadCost      = nadOn      ? nadDose.price       * nadQty        : 0;
  const imCost       = IM_OPTIONS
    .filter(s => imSelected.includes(s.key))
    .reduce((sum, s) => sum + s.price * imQty[s.key], 0);
  const monthlyTotal = vitaminsCost + cbdCost + nadCost + imCost;

  // ── Line items for summary ─────────────────────────────────────────────
  const lineItems = [
    vitaminsOn && {
      label: `IV Vitamins — ${vitaminsVariant.label}`,
      qty:   vitaminsQty,
      price: vitaminsVariant.price,
      total: vitaminsCost,
    },
    cbdOn && {
      label: `IV CBD — ${cbdDose.label}`,
      qty:   cbdQty,
      price: cbdDose.price,
      total: cbdCost,
    },
    nadOn && {
      label: `IV NAD+ — ${nadDose.label}`,
      qty:   nadQty,
      price: nadDose.price,
      total: nadCost,
    },
    ...IM_OPTIONS
      .filter(s => imSelected.includes(s.key))
      .map(s => ({
        label: `IM ${s.label}`,
        qty:   imQty[s.key],
        price: s.price,
        total: s.price * imQty[s.key],
      })),
  ].filter(Boolean);

  // Apply URL params
  const applyParams = new URLSearchParams({
    tier: 'custom',
    ...(vitaminsOn && { vitamins: vitaminsVariant.label, vitaminsQty }),
    ...(cbdOn      && { cbd: cbdDose.label, cbdQty }),
    ...(nadOn      && { nad: nadDose.label, nadQty }),
    ...(imSelected.length > 0 && { im: imSelected.join(',') }),
  });

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-background pt-24 pb-32">
        <div className="max-w-6xl mx-auto px-4">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="mb-12 md:mb-16"
          >
            <p className="font-body text-xs tracking-[0.35em] uppercase text-accent mb-3">Custom Protocol</p>
            <h1 className="font-heading text-[13vw] md:text-[7rem] lg:text-[9rem] text-foreground leading-[0.88] uppercase tracking-wide mb-4">
              Build Your<br />Protocol
            </h1>
            <div className="w-12 h-[2px] bg-accent mb-4" />
            <p className="font-body text-sm text-foreground/70 max-w-lg">
              Choose your stack, set your cadence per treatment, get an instant estimate.
              Final pricing confirmed with your care team before you commit.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-[1fr_340px] gap-10 lg:gap-14 items-start">

            {/* ══ LEFT — Stack Builder ══ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.7, ease: EASE }}
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
                  <p className="font-body text-[11px] text-foreground/60 pl-1">{vitaminsVariant.desc}</p>
                  <QtyPicker value={vitaminsQty} onChange={setVitaminsQty} />
                </div>
              </TreatmentRow>

              {/* ── IV CBD ── */}
              <TreatmentRow
                icon={CannabisLeaf}
                title="IV CBD"
                tag="Recovery & Calm · Zero THC"
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
                  <QtyPicker value={cbdQty} onChange={setCbdQty} />
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
                  <QtyPicker value={nadQty} onChange={setNadQty} />
                </div>
              </TreatmentRow>

              {/* ── IM Shots ── */}
              <div className="py-5">
                <div className="flex items-center gap-2 mb-1">
                  <Syringe className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />
                  <span className="font-heading text-xl tracking-wide text-foreground uppercase">IM Shots</span>
                </div>
                <p className="font-body text-[10px] tracking-[0.22em] uppercase text-foreground/50 mb-4">
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
                            : 'border-border/40'
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

                        {/* Qty picker — only shown when selected */}
                        <AnimatePresence>
                          {on && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <div className="flex items-center gap-2 px-3.5 pb-3 border-t border-foreground/[0.06] pt-2.5">
                                <p className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/40 shrink-0">
                                  × / mo
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
              <div className="border border-white/20 bg-white/[0.04] backdrop-blur-md rounded-3xl p-6">
                <p className="font-body text-[10px] tracking-[0.3em] uppercase text-accent mb-5">
                  Protocol Summary
                </p>

                {/* Line items */}
                <div className="min-h-[72px] mb-5 space-y-2">
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
                <div className="border-t border-border/30 pt-4 mb-5">
                  <p className="font-body text-[10px] tracking-[0.3em] uppercase text-accent mb-1">
                    Est. Monthly
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={monthlyTotal}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="font-heading text-7xl text-foreground leading-none tracking-tight"
                    >
                      ${monthlyTotal.toLocaleString()}
                    </motion.div>
                  </AnimatePresence>
                  <p className="font-body text-[10px] text-foreground/40 mt-2">
                    Estimate only — final pricing set with your care team.
                  </p>
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => {
                    const items = [];
                    if (vitaminsOn && vitaminsVariant) {
                      for (let i = 0; i < vitaminsQty; i++)
                        items.push({ key: 'iv-vitamins', label: vitaminsVariant.label, price: vitaminsVariant.price, type: 'iv' });
                    }
                    if (nadOn && nadDose) {
                      for (let i = 0; i < nadQty; i++)
                        items.push({ key: 'iv-nad', label: `NAD+ ${nadDose.label}`, price: nadDose.price, type: 'iv' });
                    }
                    if (cbdOn && cbdDose) {
                      for (let i = 0; i < cbdQty; i++)
                        items.push({ key: 'iv-cbd', label: `CBD ${cbdDose.label}`, price: cbdDose.price, type: 'iv' });
                    }
                    imSelected.forEach((key) => {
                      const shot = IM_OPTIONS.find(s => s.key === key);
                      if (shot) {
                        for (let i = 0; i < (imQty[key] || 1); i++)
                          items.push({ key: `im-${key}`, label: shot.label, price: shot.price, type: 'im' });
                      }
                    });
                    items.forEach(item => addItem?.(item));
                    track('protocol_completed', { item_count: items.length });
                    navigate('/store?from=protocol');
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-foreground text-background font-body text-xs tracking-[0.3em] uppercase font-semibold rounded-full hover:bg-foreground/90 transition-colors"
                >
                  Add to Order
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <p className="font-body text-[10px] text-foreground/40 text-center mt-3">
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
      <StickyMobileCTA />
    </>
  );
}
