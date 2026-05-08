import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Plus, Check, ShoppingBag } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/contexts/CartContext';
import { BASE_CATEGORIES, ADD_ONS, findOption } from '@/data/storeBuilder';

const EASE = [0.16, 1, 0.3, 1];

function StepEyebrow({ n, title, subtitle }) {
  return (
    <div className="mb-5 md:mb-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full bg-foreground text-background font-display text-sm md:text-base">{n}</span>
        <h2 className="font-display text-2xl md:text-3xl uppercase tracking-tight leading-none">{title}</h2>
      </div>
      {subtitle && <p className="text-sm md:text-base text-foreground/70 ml-11 md:ml-12">{subtitle}</p>}
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

export default function Store() {
  const { addItem, totalItems, subtotal: cartSubtotal } = useCart();

  // Default: read URL hash to pre-select category (e.g. /store#iv-vitamins)
  const [activeCat, setActiveCat] = useState(() => {
    if (typeof window === 'undefined') return 'iv-vitamins';
    const hash = window.location.hash.slice(1);
    return BASE_CATEGORIES.some(c => c.id === hash) ? hash : 'iv-vitamins';
  });
  const [selectedOptionId, setSelectedOptionId] = useState(() => BASE_CATEGORIES.find(c => c.id === 'iv-vitamins')?.options[0].id || '');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => { document.title = 'Store — Build your visit | Avalon Vitality'; }, []);

  // When the category changes, default to the cheapest option in that category
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

  // Drop incompatible add-ons silently when category changes
  useEffect(() => {
    setSelectedAddons(prev => prev.filter(id => compatibleAddons.some(a => a.id === id)));
  }, [activeCat, compatibleAddons]);

  const addonObjs = selectedAddons.map(id => compatibleAddons.find(a => a.id === id)).filter(Boolean);
  const total = (selectedOption?.price || 0) + addonObjs.reduce((s, a) => s + a.price, 0);

  const toggleAddon = (id) => {
    setSelectedAddons(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

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
      duration: '',
      kind: 'visit',
      addons: addonObjs.map(a => ({ id: a.id, name: a.name, price: a.price })),
    });
    setJustAdded(true);
    // Reset add-ons after add-to-cart but keep base selection so customer can build another quickly
    setSelectedAddons([]);
    setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 md:pt-32 pb-8 md:pb-10 px-5 md:px-10">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <p className="font-body text-xs md:text-sm tracking-[0.3em] uppercase text-accent mb-3">The store</p>
            <h1 className="font-display text-5xl md:text-7xl uppercase tracking-tight leading-[0.9] mb-4">
              Build your visit.
            </h1>
            <p className="text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed">
              Pick your base IV or shot. Stack add-ons. Add to cart. Stack as many visits as you want — schedule each one at checkout.
            </p>
          </motion.div>
        </div>
      </section>

      {/* How it works strip */}
      <section className="px-5 md:px-10 py-6 md:py-8 bg-foreground/[0.03] border-y border-foreground/10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
          {[
            { n: '01', t: 'Pick your base',   d: 'IV Vitamins, NAD+, CBD, or just IM shots.' },
            { n: '02', t: 'Stack add-ons',    d: 'Boots, extra bag, IM shots — only what fits with your base.' },
            { n: '03', t: 'Add to cart',      d: 'Build another visit, or check out and schedule each one.' },
          ].map((s) => (
            <div key={s.n} className="flex gap-3 items-start">
              <span className="font-display text-2xl md:text-3xl text-accent shrink-0 leading-none">{s.n}</span>
              <div>
                <h3 className="font-display text-base md:text-lg uppercase tracking-tight leading-tight mb-0.5">{s.t}</h3>
                <p className="text-sm text-foreground/65">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Builder */}
      <section className="px-5 md:px-10 py-10 md:py-14">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-10">
          {/* LEFT: builder steps */}
          <div>
            <StepEyebrow n="1" title="Pick your base" subtitle={cat?.description} />
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

            <StepEyebrow n="2" title="Stack add-ons" subtitle={compatibleAddons.length === 0 ? 'No add-ons available for this base.' : 'Optional. Pick any combination — extra meds in your IV, stacked shots, or recovery extras.'} />
            {compatibleAddons.length > 0 && (
              <div className="space-y-6 md:space-y-8 mb-10 md:mb-12">
                {Array.from(new Set(compatibleAddons.map(a => a.group || 'Add-ons'))).map((groupName) => {
                  const groupAddons = compatibleAddons.filter(a => (a.group || 'Add-ons') === groupName);
                  return (
                    <div key={groupName}>
                      <p className="font-body text-[11px] md:text-xs tracking-[0.3em] uppercase text-foreground/55 mb-3">{groupName}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                        {groupAddons.map((a) => (
                          <AddOnRow key={a.id} addon={a} checked={selectedAddons.includes(a.id)} onToggle={() => toggleAddon(a.id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <StepEyebrow n="3" title="Review your visit" />
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
                <span className="font-body text-xs tracking-[0.3em] uppercase">Visit total</span>
                <span className="font-display text-3xl md:text-4xl">${total}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!selectedOption}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background font-body text-sm md:text-base tracking-[0.2em] uppercase px-7 py-4 disabled:opacity-50 hover:opacity-85 transition-opacity"
            >
              {justAdded ? (<><Check className="w-4 h-4" strokeWidth={2.5} /> Added — build another or check out</>) : (<><Plus className="w-4 h-4" strokeWidth={2.5} /> Add visit to cart</>)}
            </button>
          </div>

          {/* RIGHT: live cart preview (sticky on desktop) */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-foreground/15 p-5 md:p-6">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-4 h-4 text-foreground/70" strokeWidth={1.5} />
                <p className="font-body text-xs tracking-[0.3em] uppercase text-foreground/70">Your cart</p>
              </div>
              {totalItems === 0 ? (
                <p className="text-sm text-foreground/60">Empty. Build a visit on the left to add it here.</p>
              ) : (
                <>
                  <p className="text-sm text-foreground/70 mb-1">{totalItems} {totalItems === 1 ? 'visit' : 'visits'} in cart</p>
                  <p className="font-display text-3xl md:text-4xl mb-4">${cartSubtotal}</p>
                  <Link to="/cart" className="block text-center rounded-full bg-foreground text-background font-body text-xs md:text-sm tracking-[0.2em] uppercase px-5 py-3 hover:opacity-85 transition-opacity">
                    Review cart <ArrowRight className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" strokeWidth={1.5} />
                  </Link>
                </>
              )}
            </div>
            <p className="text-xs text-foreground/50 mt-4 leading-relaxed">
              Don't see what you need?{' '}
              <Link to="/book" className="underline hover:text-foreground transition-colors">Browse the full menu</Link>.
            </p>
          </aside>
        </div>
      </section>

      <Footer />
    </div>
  );
}
