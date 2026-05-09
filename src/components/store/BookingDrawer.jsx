import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Plus, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { BASE_CATEGORIES, ADD_ONS } from '@/data/storeBuilder';

const EASE = [0.16, 1, 0.3, 1];

// Map a category id to its data (for variants + add-ons)
const findCategory = (id) => BASE_CATEGORIES.find(c => c.id === id);

export default function BookingDrawer({ open, categoryId, onClose }) {
  const { addItem } = useCart();
  const cat = categoryId ? findCategory(categoryId) : null;
  const [variantId, setVariantId] = useState('');
  const [addonIds, setAddonIds] = useState([]);
  const [confirmed, setConfirmed] = useState(false);

  // Reset state whenever the drawer opens for a new category
  useEffect(() => {
    if (open && cat) {
      setVariantId(cat.options[0]?.id || '');
      setAddonIds([]);
      setConfirmed(false);
    }
  }, [open, cat]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  if (!cat) return null;

  const variant = cat.options.find(o => o.id === variantId);
  const compatibleAddons = ADD_ONS.filter(a => a.compatibleBaseCategories.includes(cat.id));
  const selectedAddons = addonIds.map(id => compatibleAddons.find(a => a.id === id)).filter(Boolean);
  const total = (variant?.price || 0) + selectedAddons.reduce((s, a) => s + a.price, 0);

  const toggleAddon = (id) => {
    setAddonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAdd = () => {
    if (!variant) return;
    const displayName = selectedAddons.length === 0
      ? variant.name
      : `${variant.name} + ${selectedAddons.map(a => a.name).join(' + ')}`;
    addItem({
      productId: `${cat.id}-${variant.id}`,
      name: variant.name,
      displayName,
      price: total,
      categoryName: cat.name,
      kind: 'visit',
      addons: selectedAddons.map(a => ({ id: a.id, name: a.name, price: a.price })),
    });
    setConfirmed(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm"
            aria-hidden="true"
          />
          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: EASE }}
            className="booking-drawer fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[440px] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`Book ${cat.name}`}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/10">
              <p className="font-body text-[10px] tracking-[0.32em] uppercase text-foreground/55">Book your visit</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full border border-foreground/20 inline-flex items-center justify-center hover:border-foreground/60 transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-7">
              {!confirmed ? (
                <>
                  <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none mb-2">{cat.name}</h2>
                  <p className="text-sm md:text-base text-foreground/65 leading-relaxed mb-7">{cat.blurb || cat.description}</p>

                  {/* Variants */}
                  <p className="font-body text-[10px] tracking-[0.32em] uppercase text-foreground/55 mb-3">{cat.options.length > 1 ? 'Choose a formula' : 'Formula'}</p>
                  <div className="space-y-2 mb-7">
                    {cat.options.map((opt) => (
                      <label
                        key={opt.id}
                        className={`block rounded-xl border p-3.5 cursor-pointer transition-colors ${variantId === opt.id ? 'border-foreground bg-foreground/[0.04]' : 'border-foreground/15 hover:border-foreground/40'}`}
                      >
                        <input type="radio" name="drawer-variant" className="sr-only" checked={variantId === opt.id} onChange={() => setVariantId(opt.id)} />
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-display text-base md:text-lg uppercase tracking-tight">{opt.name}</span>
                          <span className="font-display text-base md:text-lg shrink-0">${opt.price}</span>
                        </div>
                        <span className="block text-xs text-foreground/60 mt-0.5">{opt.sub}</span>
                      </label>
                    ))}
                  </div>

                  {/* Add-ons (collapsed if many) */}
                  {compatibleAddons.length > 0 && (
                    <>
                      <p className="font-body text-[10px] tracking-[0.32em] uppercase text-foreground/55 mb-3">Add-ons (optional)</p>
                      <div className="drawer-scroll space-y-2 mb-7 max-h-[260px] overflow-y-auto pr-1">
                        {compatibleAddons.map((a) => {
                          const checked = addonIds.includes(a.id);
                          return (
                            <label
                              key={a.id}
                              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${checked ? 'border-foreground bg-foreground/[0.04]' : 'border-foreground/15 hover:border-foreground/35'}`}
                            >
                              <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleAddon(a.id)} />
                              <span className={`mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-md border-2 shrink-0 ${checked ? 'bg-foreground border-foreground' : 'border-foreground/30'}`}>
                                {checked && <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="flex items-baseline justify-between gap-3">
                                  <span className="text-sm font-medium uppercase tracking-tight">{a.name}</span>
                                  <span className="font-display text-sm shrink-0">+${a.price}</span>
                                </span>
                                <span className="block text-xs text-foreground/55 mt-0.5">{a.sub}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="text-center pt-8"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/15 mb-5">
                    <Check className="w-6 h-6 text-accent" strokeWidth={2.5} />
                  </div>
                  <p className="font-display text-2xl md:text-3xl uppercase tracking-tight leading-tight mb-2">Added to cart.</p>
                  <p className="text-sm text-foreground/65 leading-relaxed">
                    {cat.name}{selectedAddons.length > 0 ? ` + ${selectedAddons.length} add-on${selectedAddons.length > 1 ? 's' : ''}` : ''} — ${total}
                  </p>
                </motion.div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-foreground/10 px-6 py-5 space-y-3">
              {!confirmed ? (
                <>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-body text-[10px] tracking-[0.32em] uppercase text-foreground/55">Visit total</span>
                    <span className="font-display text-3xl">${total}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!variant}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background font-body text-xs tracking-[0.3em] uppercase px-7 py-3.5 disabled:opacity-50 hover:opacity-85 transition-opacity"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} /> Add to cart
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/cart"
                    onClick={onClose}
                    className="block text-center rounded-full bg-foreground text-background font-body text-xs tracking-[0.3em] uppercase px-7 py-3.5 hover:opacity-85 transition-opacity"
                  >
                    Continue to cart <ArrowRight className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" strokeWidth={1.5} />
                  </Link>
                  <button
                    type="button"
                    onClick={onClose}
                    className="block w-full text-center font-body text-[11px] tracking-[0.3em] uppercase text-foreground/65 hover:text-foreground transition-colors py-2"
                  >
                    Keep shopping
                  </button>
                </>
              )}
            </div>
          </motion.aside>

          <style>{`
            .booking-drawer {
              background: hsl(var(--background) / 0.92);
              backdrop-filter: saturate(160%) blur(28px);
              -webkit-backdrop-filter: saturate(160%) blur(28px);
              box-shadow: -30px 0 80px -20px hsl(var(--foreground) / 0.20);
            }
            /* Light, subtle scrollbar to match the rest of the menu */
            .drawer-scroll { scrollbar-width: thin; scrollbar-color: hsl(var(--foreground) / 0.18) transparent; }
            .drawer-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .drawer-scroll::-webkit-scrollbar-track { background: transparent; }
            .drawer-scroll::-webkit-scrollbar-thumb { background-color: hsl(var(--foreground) / 0.22); border-radius: 999px; }
            .drawer-scroll::-webkit-scrollbar-thumb:hover { background-color: hsl(var(--foreground) / 0.4); }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}
