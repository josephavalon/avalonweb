import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

export default function StickyCartBar() {
  const { items, totalItems, subtotal } = useCart();
  const location = useLocation();
  // Hide on /cart and /checkout (cart is already the focus there)
  const onCartPage = /^\/(cart|checkout)/.test(location.pathname);
  if (items.length === 0 || onCartPage) return null;

  // Quick label: if 1 item, show its name; if multiple, show "X items"
  const label = items.length === 1
    ? items[0].displayName || items[0].name
    : `${totalItems} items`;

  return (
    <div className="fixed bottom-3 md:bottom-5 left-1/2 -translate-x-1/2 z-40 px-3 w-full max-w-[680px]">
      <Link
        to="/cart"
        className="group flex items-center justify-between gap-3 rounded-full bg-foreground text-background px-4 py-3 md:px-5 md:py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] hover:opacity-95 transition-opacity"
      >
        <span className="inline-flex items-center gap-3 min-w-0">
          <span className="relative shrink-0">
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-foreground text-[10px] font-bold flex items-center justify-center">
              {totalItems}
            </span>
          </span>
          <span className="font-body text-xs md:text-sm tracking-[0.18em] uppercase truncate">{label}</span>
        </span>
        <span className="inline-flex items-center gap-2 shrink-0">
          <span className="font-display text-lg md:text-xl">${subtotal}</span>
          <span className="font-body text-xs md:text-sm tracking-[0.2em] uppercase">Checkout</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
        </span>
      </Link>
    </div>
  );
}
