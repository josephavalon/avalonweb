import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Plus,
  Check,
  ShoppingBag,
  Droplets,
  Zap,
  Sparkles,
  Syringe,
  Layers,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/contexts/CartContext';
import { BASE_CATEGORIES, ADD_ONS, findOption } from '@/data/storeBuilder';

const EASE = [0.16, 1, 0.3, 1];

// =====================================================================
// Hero
// =====================================================================
function Hero() {
  return (
    <section className="relative pt-28 md:pt-36 pb-14 md:pb-20 px-5 md:px-10">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <h1 className="font-display text-[44px] sm:text-[64px] md:text-[88px] lg:text-[112px] uppercase leading-[0.92] tracking-tight mb-2 md:mb-3">
            Mobile IV Therapy.
          </h1>
          <h1 className="font-display text-[44px] sm:text-[64px] md:text-[88px] lg:text-[112px] uppercase leading-[0.92] tracking-tight mb-7 md:mb-10 text-foreground/60">
            Recovery, Delivered.
          </h1>
          <p className="text-base md:text-xl text-foreground/75 max-w-2xl leading-relaxed mb-9 md:mb-12">
            Book an Avalon RN to your home, hotel, office, or event. Choose your treatment, schedule your visit, complete clinical clearance, and recover where you are.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-7 md:mb-9">
            <a
              href="#treatments"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background font-body text-xs md:text-sm tracking-[0.3em] uppercase px-9 py-4 hover:opacity-85 transition-opacity"
            >
              Book now <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </a>
            <a
              href="#popular"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-foreground/35 font-body text-xs md:text-sm tracking-[0.3em] uppercase px-9 py-4 hover:border-foreground transition-colors"
            >
              View treatments
            </a>
          </div>

          <p className="font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground/55">
            Licensed RNs · Physician-Supervised · Bay Area Mobile Service
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// =====================================================================
// Page sub-nav (sticky after scroll past hero)
// =====================================================================
function StoreSubNav() {
  return (
    <nav
      aria-label="Store sections"
      className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-y border-foreground/10 py-3"
    >
      <div className="max-w-6xl mx-auto px-5 md:px-10 flex items-center justify-center gap-3 md:gap-8 overflow-x-auto no-scrollbar">
        {[
          { href: '#treatments',  label: 'Treatments' },
          { href: '#how',         label: 'How it works' },
          { href: '/apply',       label: 'Membership', external: true },
          { href: '/events/race', label: 'Events',     external: true },
          { href: '#popular',     label: 'Book now',   highlight: true },
        ].map((item) => {
          const cls = `font-body text-[10px] md:text-xs tracking-[0.32em] uppercase whitespace-nowrap transition-colors ${item.highlight ? 'rounded-full bg-foreground text-background px-4 py-2' : 'text-foreground/65 hover:text-foreground'}`;
          if (item.external) {
            return <Link key={item.label} to={item.href} className={cls}>{item.label}</Link>;
          }
          return <a key={item.label} href={item.href} className={cls}>{item.label}</a>;
        })}
      </div>
    </nav>
  );
}

// =====================================================================
// Category cards (5 cards above the configurator)
// =====================================================================
const CATEGORY_CARDS = [
  {
    id: 'iv-vitamins',
    icon: Droplets,
    name: 'IV Vitamins',
    blurb: 'Hydration and vitamin support for travel, fatigue, recovery, and general wellness.',
    fromPrice: 150,
    targetCategoryId: 'iv-vitamins',
  },
  {
    id: 'iv-nad',
    icon: Zap,
    name: 'NAD+ IV',
    blurb: 'Premium cellular energy and longevity support.',
    fromPrice: 350,
    targetCategoryId: 'iv-nad',
  },
  {
    id: 'iv-cbd',
    icon: Sparkles,
    name: 'CBD IV',
    blurb: 'Advanced recovery and relaxation support.',
    fromPrice: 250,
    targetCategoryId: 'iv-cbd',
  },
  {
    id: 'im-shots',
    icon: Syringe,
    name: 'IM Shots',
    blurb: 'Quick vitamin injections. Stack with any IV or book solo.',
    fromPrice: 60,
    targetCategoryId: null,
    targetAnchor: 'popular',
  },
  {
    id: 'add-ons',
    icon: Layers,
    name: 'Add-Ons',
    blurb: 'Stack compression, extra meds, and recovery modalities with any IV.',
    fromPrice: 25,
    targetCategoryId: null,
  },
];

function CategoryCards({ onSelect }) {
  return (
    <section id="treatments" className="px-5 md:px-10 py-14 md:py-20 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 md:mb-14 max-w-3xl">
          <p className="font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground/55 mb-3">The menu</p>
          <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight leading-[0.95]">Choose your treatment.</h2>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {CATEGORY_CARDS.map((c, i) => {
            const Icon = c.icon;
            const handleClick = (e) => {
              e.preventDefault();
              if (c.targetCategoryId) {
                onSelect(c.targetCategoryId);
                document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else if (c.targetAnchor) {
                document.getElementById(c.targetAnchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            };
            return (
              <motion.button
                type="button"
                key={c.id}
                onClick={handleClick}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.55, ease: EASE, delay: i * 0.05 }}
                className="group relative text-left rounded-2xl border border-foreground/15 bg-background p-7 md:p-8 transition-colors hover:border-foreground/45 focus:outline-none focus:ring-2 focus:ring-foreground/30"
              >
                <Icon className="w-5 h-5 text-foreground/70 mb-6" strokeWidth={1.5} />
                <h3 className="font-display text-2xl md:text-3xl uppercase tracking-tight leading-none mb-3">{c.name}</h3>
                <p className="text-sm md:text-base text-foreground/65 leading-snug mb-7 min-h-[3.25rem]">{c.blurb}</p>
                <div className="flex items-baseline justify-between pt-5 border-t border-foreground/10">
                  <span className="font-body text-[10px] md:text-xs tracking-[0.32em] uppercase text-foreground/55">From ${c.fromPrice}</span>
                  <span className="inline-flex items-center gap-1.5 font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground group-hover:gap-2.5 transition-all">
                    Book <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// How Avalon works — 4 step section
// =====================================================================
const STEPS = [
  { n: '01', t: 'Choose your treatment',    d: 'Browse the menu, pick your IV, stack add-ons or shots if you want.' },
  { n: '02', t: 'Book your time',            d: 'Pick a date, time, and address. Card authorized at booking.' },
  { n: '03', t: 'Complete clinical clearance', d: 'Quick intake form. We confirm contraindications before your visit.' },
  { n: '04', t: 'RN arrives',                d: 'Avalon RN at your door within your booked window. 20–60 minutes total.' },
];

function HowItWorks() {
  return (
    <section id="how" className="px-5 md:px-10 py-14 md:py-20 border-y border-foreground/10 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 md:mb-14 max-w-3xl">
          <p className="font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground/55 mb-3">The flow</p>
          <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight leading-[0.95]">How Avalon works.</h2>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.55, ease: EASE, delay: i * 0.06 }}
            >
              <p className="font-display text-5xl md:text-6xl text-foreground/15 leading-none mb-4 select-none">{s.n}</p>
              <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight leading-tight mb-2">{s.t}</h3>
              <p className="text-sm md:text-base text-foreground/65 leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Popular treatments — 6 quick-add cards
// =====================================================================
const POPULAR = [
  { id: 'pop-hydration',  productId: 'iv-vitamins-hydration', categoryId: 'iv-vitamins', name: 'Hydration IV',         price: 150 },
  { id: 'pop-myers',      productId: 'iv-vitamins-myers',     categoryId: 'iv-vitamins', name: 'Premium Vitamin IV',   price: 200, displayOverride: 'Premium Vitamin IV' },
  { id: 'pop-nad',        productId: 'iv-nad-nad-250',        categoryId: 'iv-nad',      name: 'NAD+ IV',              price: 350 },
  { id: 'pop-cbd',        productId: 'iv-cbd-cbd-33',         categoryId: 'iv-cbd',      name: 'CBD IV',               price: 250 },
  { id: 'pop-b12',        productId: 'im-only-im-b12',        categoryId: 'im-only',     name: 'B-12 Shot',            price: 60 },
  { id: 'pop-gluta',      productId: 'im-only-im-glutathione',categoryId: 'im-only',     name: 'Glutathione Shot',     price: 80 },
];

function PopularTreatments({ onSelectCategory }) {
  const { addItem, items } = useCart();
  return (
    <section id="popular" className="px-5 md:px-10 py-14 md:py-20 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 md:mb-14 flex items-end justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <p className="font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground/55 mb-3">Popular treatments</p>
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight leading-[0.95]">Quick add to visit.</h2>
          </div>
          <a href="#builder" className="inline-flex items-center gap-2 font-body text-xs tracking-[0.3em] uppercase text-foreground/65 hover:text-foreground transition-colors">
            Build a custom visit <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </a>
        </header>
        <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
          {POPULAR.map((t, i) => {
            const inCart = items.some(it => it.productId === t.productId);
            const handleAdd = () => {
              addItem({
                productId: t.productId,
                name: t.name,
                displayName: t.displayOverride || t.name,
                price: t.price,
                kind: 'visit',
              });
            };
            return (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.04 }}
                className="flex items-center justify-between gap-4 py-5 md:py-7"
              >
                <div className="min-w-0">
                  <h3 className="font-display text-xl md:text-3xl uppercase tracking-tight leading-none truncate">{t.name}</h3>
                  <p className="font-body text-[10px] md:text-xs tracking-[0.32em] uppercase text-foreground/55 mt-2">From ${t.price}</p>
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  className={`inline-flex items-center gap-2 rounded-full font-body text-[10px] md:text-xs tracking-[0.3em] uppercase px-5 md:px-7 py-3 md:py-3.5 transition-colors shrink-0 ${inCart ? 'bg-foreground/[0.07] text-foreground/80 border-2 border-foreground/20' : 'bg-foreground text-background hover:opacity-85'}`}
                >
                  {inCart ? (<><Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Added</>) : (<>Book <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} /></>)}
                </button>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// =====================================================================
// Configurator (kept inline — for users who want full control)
// =====================================================================
function StepEyebrow({ n, title, subtitle }) {
  return (
    <div className="mb-5 md:mb-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full bg-foreground text-background font-display text-sm md:text-base">{n}</span>
        <h3 className="font-display text-2xl md:text-3xl uppercase tracking-tight leading-none">{title}</h3>
      </div>
      {subtitle && <p className="text-sm md:text-base text-foreground/65 ml-11 md:ml-12">{subtitle}</p>}
    </div>
  );
}

function CategoryTabs({ active, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5 md:mb-6">
      {BASE_CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={`px-4 py-2 rounded-full font-body text-xs md:text-sm tracking-[0.2em] uppercase transition-colors border ${active === c.id ? 'bg-foreground text-background border-foreground' : 'border-foreground/25 text-foreground/80 hover:border-foreground/60'}`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function BaseOption({ option, selected, onSelect }) {
  return (
    <label className={`group block rounded-2xl border p-4 md:p-5 cursor-pointer transition-colors ${selected ? 'border-foreground bg-foreground/[0.03]' : 'border-foreground/15 hover:border-foreground/40'}`}>
      <input type="radio" name="base-option" className="sr-only" checked={selected} onChange={onSelect} />
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight leading-none">{option.name}</h3>
        <span className="font-display text-2xl md:text-3xl shrink-0">${option.price}</span>
      </div>
      <p className="text-xs md:text-sm text-foreground/65">{option.sub}</p>
      {selected && (
        <div className="mt-3 inline-flex items-center gap-1.5 font-body text-[10px] tracking-[0.2em] uppercase text-accent">
          <Check className="w-3 h-3" strokeWidth={2.5} /> Selected
        </div>
      )}
    </label>
  );
}

function AddOnRow({ addon, checked, onToggle }) {
  return (
    <label className={`flex items-start gap-4 rounded-xl border p-3 md:p-4 cursor-pointer transition-colors ${checked ? 'border-foreground bg-foreground/[0.03]' : 'border-foreground/15 hover:border-foreground/35'}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
      <span className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-md border-2 shrink-0 ${checked ? 'bg-foreground border-foreground' : 'border-foreground/30'}`}>
        {checked && <Check className="w-3 h-3 text-background" strokeWidth={3} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-body text-sm md:text-base font-medium uppercase tracking-tight">{addon.name}</span>
          <span className="font-display text-base md:text-lg shrink-0">+${addon.price}</span>
        </span>
        <span className="block text-xs md:text-sm text-foreground/60 mt-0.5">{addon.sub}</span>
      </span>
    </label>
  );
}

function Configurator({ activeCat, setActiveCat }) {
  const { addItem, totalItems, subtotal: cartSubtotal } = useCart();
  const [selectedOptionId, setSelectedOptionId] = useState(() => BASE_CATEGORIES.find(c => c.id === 'iv-vitamins')?.options[0].id || '');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    const cat = BASE_CATEGORIES.find(c => c.id === activeCat);
    if (cat && !cat.options.some(o => o.id === selectedOptionId)) {
      setSelectedOptionId(cat.options[0].id);
    }
  }, [activeCat, selectedOptionId]);

  const cat = BASE_CATEGORIES.find(c => c.id === activeCat);
  const selectedOption = findOption(activeCat, selectedOptionId);
  const compatibleAddons = useMemo(
    () => ADD_ONS.filter(a => a.compatibleBaseCategories.includes(activeCat)),
    [activeCat]
  );

  useEffect(() => {
    setSelectedAddons(prev => prev.filter(id => compatibleAddons.some(a => a.id === id)));
  }, [activeCat, compatibleAddons]);

  const addonObjs = selectedAddons.map(id => compatibleAddons.find(a => a.id === id)).filter(Boolean);
  const total = (selectedOption?.price || 0) + addonObjs.reduce((s, a) => s + a.price, 0);

  const toggleAddon = (id) => setSelectedAddons(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAddToCart = () => {
    if (!selectedOption) return;
    const displayName = addonObjs.length === 0
      ? selectedOption.name
      : `${selectedOption.name} + ${addonObjs.map(a => a.name).join(' + ')}`;
    addItem({
      productId: `${activeCat}-${selectedOption.id}`,
      name: selectedOption.name,
      displayName,
      price: total,
      categoryName: cat?.name || '',
      kind: 'visit',
      addons: addonObjs.map(a => ({ id: a.id, name: a.name, price: a.price })),
    });
    setJustAdded(true);
    setSelectedAddons([]);
    setTimeout(() => setJustAdded(false), 1800);
  };

  const groupedAddons = useMemo(() => {
    const groups = new Map();
    compatibleAddons.forEach(a => {
      const key = a.group || 'Add-ons';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    });
    return Array.from(groups.entries());
  }, [compatibleAddons]);

  return (
    <section id="builder" className="px-5 md:px-10 py-14 md:py-20 border-t border-foreground/10 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 md:mb-14 max-w-3xl">
          <p className="font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground/55 mb-3">Build your visit</p>
          <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight leading-[0.95]">Customize the protocol.</h2>
          <p className="text-base md:text-lg text-foreground/70 mt-4 leading-relaxed">Pick your IV. Stack add-ons. Add the visit to cart. Repeat for additional sessions.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-10">
          <div>
            <StepEyebrow n="1" title="Pick your IV" subtitle={cat?.description} />
            <CategoryTabs active={activeCat} onSelect={setActiveCat} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-10 md:mb-12">
              {cat?.options.map((opt) => (
                <BaseOption
                  key={opt.id}
                  option={opt}
                  selected={selectedOptionId === opt.id}
                  onSelect={() => setSelectedOptionId(opt.id)}
                />
              ))}
            </div>

            <StepEyebrow n="2" title="Stack add-ons" subtitle={compatibleAddons.length === 0 ? 'No add-ons available for this base.' : 'Optional. Extra meds in your IV, stacked shots, or recovery extras.'} />
            {compatibleAddons.length > 0 && (
              <div className="space-y-6 md:space-y-8 mb-10 md:mb-12">
                {groupedAddons.map(([groupName, groupAddons]) => (
                  <div key={groupName}>
                    <p className="font-body text-[11px] md:text-xs tracking-[0.32em] uppercase text-foreground/55 mb-3">{groupName}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      {groupAddons.map((a) => (
                        <AddOnRow key={a.id} addon={a} checked={selectedAddons.includes(a.id)} onToggle={() => toggleAddon(a.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <StepEyebrow n="3" title="Review" />
            <div className="rounded-2xl border border-foreground/15 p-5 md:p-6 mb-6">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-display text-lg md:text-xl uppercase tracking-tight">{selectedOption?.name || '—'}</span>
                <span className="font-display text-lg md:text-xl">${selectedOption?.price || 0}</span>
              </div>
              {addonObjs.map((a) => (
                <div key={a.id} className="flex items-baseline justify-between text-sm md:text-base text-foreground/75 mb-1">
                  <span>+ {a.name}</span>
                  <span>+${a.price}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-3 mt-3 border-t border-foreground/10">
                <span className="font-body text-xs tracking-[0.32em] uppercase">Visit total</span>
                <span className="font-display text-3xl md:text-4xl">${total}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!selectedOption}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background font-body text-xs md:text-sm tracking-[0.3em] uppercase px-7 py-4 disabled:opacity-50 hover:opacity-85 transition-opacity"
            >
              {justAdded ? (<><Check className="w-4 h-4" strokeWidth={2.5} /> Added — build another or check out</>) : (<><Plus className="w-4 h-4" strokeWidth={2.5} /> Add visit to cart</>)}
            </button>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-foreground/15 p-5 md:p-6">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-4 h-4 text-foreground/70" strokeWidth={1.5} />
                <p className="font-body text-[11px] tracking-[0.32em] uppercase text-foreground/65">Your cart</p>
              </div>
              {totalItems === 0 ? (
                <p className="text-sm text-foreground/60">Empty. Build a visit on the left to add it here.</p>
              ) : (
                <>
                  <p className="text-sm text-foreground/70 mb-1">{totalItems} {totalItems === 1 ? 'visit' : 'visits'} in cart</p>
                  <p className="font-display text-3xl md:text-4xl mb-4">${cartSubtotal}</p>
                  <Link to="/cart" className="block text-center rounded-full bg-foreground text-background font-body text-[11px] md:text-xs tracking-[0.3em] uppercase px-5 py-3 hover:opacity-85 transition-opacity">
                    Review cart <ArrowRight className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" strokeWidth={1.5} />
                  </Link>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Page shell
// =====================================================================
export default function Store() {
  const [activeCat, setActiveCat] = useState(() => {
    if (typeof window === 'undefined') return 'iv-vitamins';
    const hash = window.location.hash.slice(1);
    return BASE_CATEGORIES.some(c => c.id === hash) ? hash : 'iv-vitamins';
  });

  useEffect(() => { document.title = 'Store — Avalon Vitality'; }, []);

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <Hero />
      <StoreSubNav />
      <CategoryCards onSelect={setActiveCat} />
      <HowItWorks />
      <PopularTreatments onSelectCategory={setActiveCat} />
      <Configurator activeCat={activeCat} setActiveCat={setActiveCat} />
      <Footer />
    </div>
  );
}
