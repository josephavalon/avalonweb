import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Plus, X, ShoppingBag, ArrowLeft } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/contexts/CartContext';

const EASE = [0.16, 1, 0.3, 1];

export default function Cart() {
  const { items, subtotal, removeItem, updateQty, clearCart } = useCart();
  const isEmpty = items.length === 0;

  useEffect(() => { document.title = 'Review Order — Avalon Vitality'; }, []);

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      <section className="pt-28 md:pt-32 pb-12 md:pb-16 px-5 md:px-10">
        <div className="max-w-3xl mx-auto">
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mb-8 md:mb-10"
          >
            <p className="font-body text-xs md:text-sm tracking-[0.3em] uppercase text-accent mb-3">Cart</p>
            <h1 className="font-display text-5xl md:text-6xl uppercase tracking-tight leading-none">Review order</h1>
          </motion.header>

          {isEmpty ? (
            <EmptyCart />
          ) : (
            <CartContents items={items} subtotal={subtotal} onRemove={removeItem} onQty={updateQty} onClear={clearCart} />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function EmptyCart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
      className="rounded-2xl border border-foreground/15 p-8 md:p-12 text-center"
    >
      <ShoppingBag className="w-10 h-10 mx-auto text-foreground/40 mb-4" strokeWidth={1.5} />
      <h2 className="font-display text-2xl md:text-3xl uppercase tracking-tight mb-2">Your cart is empty</h2>
      <p className="text-foreground/70 mb-6">Pick a treatment to get started.</p>
      <Link to="/store" className="inline-flex items-center gap-2 rounded-full bg-foreground text-background font-body text-sm tracking-[0.2em] uppercase px-6 py-3 hover:opacity-85 transition-opacity">
        Browse the menu <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
      </Link>
    </motion.div>
  );
}

function CartContents({ items, subtotal, onRemove, onQty, onClear }) {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Items */}
      <ul className="space-y-3 md:space-y-4">
        {items.map((it) => (
          <li key={it.cartId} className="rounded-2xl border border-foreground/15 p-4 md:p-5 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight leading-none truncate">{it.displayName || it.name}</h3>
                <span className="font-display text-xl md:text-2xl shrink-0">${it.price * (it.qty || 1)}</span>
              </div>
              {it.categoryName && (
                <p className="font-body text-[11px] tracking-[0.25em] uppercase text-foreground/60 mb-2">{it.categoryName}</p>
              )}
              {it.duration && (
                <p className="text-xs md:text-sm text-foreground/60 mb-3">{it.duration} · ${it.price}/session</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-foreground/60">
                  Qty
                  <select
                    value={it.qty || 1}
                    onChange={(e) => onQty(it.cartId, parseInt(e.target.value, 10))}
                    className="border border-foreground/20 rounded-md px-2 py-1 text-sm bg-background"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => onRemove(it.cartId)}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase text-foreground/60 hover:text-foreground transition-colors"
                  aria-label={`Remove ${it.displayName || it.name}`}
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Add more */}
      <Link
        to="/store"
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-foreground/25 py-5 md:py-6 font-body text-sm md:text-base tracking-[0.2em] uppercase text-foreground/70 hover:border-foreground/60 hover:text-foreground transition-colors"
      >
        <Plus className="w-4 h-4" strokeWidth={2} />
        Add another treatment
      </Link>

      {/* Subtotal */}
      <div className="rounded-2xl bg-foreground/[0.03] border border-foreground/10 p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="font-body text-xs md:text-sm tracking-[0.3em] uppercase text-foreground/60">Visit subtotal</span>
          <span className="font-display text-3xl md:text-4xl">${subtotal}</span>
        </div>
        <p className="text-xs md:text-sm text-foreground/60">Card authorized at booking, charged after your appointment.</p>
      </div>

      {/* CTA row */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Link to="/store" className="inline-flex items-center justify-center gap-2 font-body text-sm tracking-[0.2em] uppercase text-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Continue shopping
        </Link>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center justify-center gap-2 font-body text-xs tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground transition-colors"
        >
          Clear cart
        </button>
        <Link
          to="/checkout"
          className="ml-auto inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background font-body text-sm md:text-base tracking-[0.2em] uppercase px-7 py-3.5 hover:opacity-85 transition-opacity"
        >
          Continue to checkout <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}
