import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ArrowRight, X } from 'lucide-react';

import { useCart } from '@/context/CartContext';

const EASE = [0.16, 1, 0.3, 1];

export default function BottomNav() {
  const { items, itemsTotal } = useCart();
  const [minimized, setMinimized] = useState(false);
  const count = items.length;
  const total = itemsTotal ?? items.reduce((s, i) => s + (i.price || 0), 0);

  /* Reset minimized state when cart empties */
  if (count === 0) return null;

  return (
    <div className="md:hidden">
      <AnimatePresence mode="wait">
        {minimized ? (
          /* ── Minimized: floating pill in bottom-right corner ── */
          <motion.button
            key="minimized"
            onClick={() => setMinimized(false)}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed bottom-5 right-4 z-40 flex items-center gap-2 px-3 py-2.5 rounded-full bg-foreground text-background shadow-2xl"
            style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
            aria-label="Expand cart"
          >
            <div className="relative">
              <ShoppingBag className="w-4 h-4" strokeWidth={1.8} />
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-accent text-background font-body text-[7px] font-bold flex items-center justify-center leading-none">
                {count > 9 ? '9+' : count}
              </span>
            </div>
            <span className="font-body text-[10px] tracking-[0.15em] uppercase font-semibold pr-0.5">
              ${total.toLocaleString()}
            </span>
          </motion.button>
        ) : (
          /* ── Expanded: full-width bar ── */
          <motion.div
            key="expanded"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="fixed bottom-0 inset-x-0 z-40 px-3"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-2">
              {/* Cart link — takes up remaining width */}
              <Link
                to="/store?checkout=1"
                className="flex items-center justify-between flex-1 px-5 py-4 rounded-2xl bg-foreground text-background shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ShoppingBag className="w-5 h-5" strokeWidth={1.8} />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent text-background font-body text-[8px] font-bold flex items-center justify-center leading-none">
                      {count > 9 ? '9+' : count}
                    </span>
                  </div>
                  <span className="font-body text-[11px] tracking-[0.2em] uppercase font-semibold text-background/70">
                    {count} {count === 1 ? 'Item' : 'Items'} · ${total.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-body text-[11px] tracking-[0.25em] uppercase font-semibold">View Cart</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </div>
              </Link>

              {/* Minimize button */}
              <button
                onClick={() => setMinimized(true)}
                className="flex-shrink-0 w-12 h-12 rounded-2xl bg-foreground/[0.12] border border-foreground/[0.15] flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/20 transition-colors shadow-lg"
                aria-label="Minimize cart"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
