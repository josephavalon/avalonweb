import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Droplets, Zap, Sparkles, ChevronRight, ArrowRight,
  X, ShoppingBag, Check,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';

const EASE = [0.16, 1, 0.3, 1];

/* ─── Category data ──────────────────────────────────────────── */
const CATEGORIES = [
  {
    key: 'recover',
    icon: Droplets,
    title: 'RECOVER',
    subtitle: 'Hydration, hangover, jet lag',
    price: 'From $150',
    drips: [
      { name: 'Hydration', price: '$150' },
      { name: 'Recovery', price: '$250' },
      { name: "Myers' Cocktail", price: '$250' },
      { name: 'Immunity', price: '$250' },
    ],
  },
  {
    key: 'perform',
    icon: Zap,
    title: 'PERFORM',
    subtitle: 'Energy, immunity, NAD+',
    price: 'From $250',
    drips: [
      { name: 'Energy', price: '$250' },
      { name: 'NAD+ 250mg', price: '$350' },
      { name: 'NAD+ 500mg', price: '$500' },
      { name: 'NAD+ 1000mg', price: '$800' },
    ],
  },
  {
    key: 'elevate',
    icon: Sparkles,
    title: 'ELEVATE',
    subtitle: 'CBD, exosomes, longevity',
    price: 'From $350',
    drips: [
      { name: 'IV CBD 33mg', price: '$250' },
      { name: 'IV CBD 66mg', price: '$300' },
      { name: 'IV CBD 99mg', price: '$350' },
      { name: 'IV CBD 132mg', price: '$400' },
    ],
  },
];

/* ─── Checkout Sheet ─────────────────────────────────────────── */
function CheckoutSheet({ cart, onRemove, onClose }) {
  const navigate = useNavigate();
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
      <div className="relative bg-background/95 backdrop-blur-2xl border-t border-foreground/10 rounded-t-3xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-accent mb-0.5">Your Order</p>
            <p className="font-heading text-2xl text-foreground tracking-wide">{cart.length} Item{cart.length !== 1 ? 's' : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full border border-foreground/10 text-foreground/50 hover:text-foreground transition-colors focus:outline-none" aria-label="Close cart">
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {cart.map((item) => (
            <div key={item.cartKey} className="flex items-center gap-3 py-2.5 border-b border-white/[0.06]">
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs tracking-widest uppercase text-foreground leading-tight truncate">{item.label}</p>
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
          <Link to="/newsletter" className="flex items-center justify-center gap-2.5 w-full py-4 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-accent text-background hover:bg-accent/90 transition-colors">
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
  const { items: cart, removeItem: removeFromCart, clearItems: clearCart, itemsTotal: cartTotal } = useCart();
  const [openKey, setOpenKey] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const toggle = (key) => setOpenKey(openKey === key ? null : key);

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
          <Link to="/newsletter" className="hidden md:flex items-center gap-2 font-body text-xs tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground transition-colors">
            View All Sessions <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </Link>
        </div>

        {/* Category accordion cards */}
        <div className="space-y-2">
          {CATEGORIES.map((cat, i) => {
            const isOpen = openKey === cat.key;
            const CatIcon = cat.icon;
            return (
              <motion.div
                key={cat.key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5, ease: EASE }}
                className="bg-white/[0.03] backdrop-blur-sm border border-foreground/10 rounded-2xl overflow-hidden"
              >
                {/* Card header — always visible */}
                <button
                  type="button"
                  onClick={() => toggle(cat.key)}
                  className="w-full flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  aria-expanded={isOpen}
                >
                  {/* Left: icon + text */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center shrink-0">
                      <CatIcon className="w-5 h-5 text-[#c9a84c]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-base leading-none">{cat.title}</p>
                      <p className="text-white/50 text-sm mt-0.5">{cat.subtitle}</p>
                    </div>
                  </div>
                  {/* Right: price + chevron */}
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-[#c9a84c] font-bold text-sm">{cat.price}</span>
                    <ChevronRight
                      className="w-4 h-4 text-white/30 transition-transform duration-300"
                      style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      strokeWidth={2}
                    />
                  </div>
                </button>

                {/* Expanded drip list */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="drips"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="border-t border-white/[0.06] px-6 pb-5 pt-4 space-y-2">
                        {cat.drips.map((drip) => (
                          <div
                            key={drip.name}
                            className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0"
                          >
                            <span className="text-white/70 text-sm font-body">{drip.name}</span>
                            <span className="text-[#c9a84c] text-sm font-bold ml-4 shrink-0">{drip.price}</span>
                          </div>
                        ))}
                        <Link
                          to="/newsletter"
                          className="mt-3 flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-white/40 hover:text-white transition-colors font-body"
                        >
                          View & Book <ArrowRight className="w-3 h-3" strokeWidth={2} />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-6">
          <Link
            to="/newsletter"
            className="w-full flex items-center justify-center gap-2.5 py-4 font-body text-xs tracking-[0.2em] uppercase font-semibold rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-foreground/20 text-foreground hover:bg-white/[0.08] hover:border-foreground/40 transition-colors"
          >
            VIEW FULL MENU &amp; BOOK <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
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
