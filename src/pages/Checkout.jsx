import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Calendar } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/contexts/CartContext';
import { ACUITY_OWNER_ID, ACUITY_BOOKING_BASE } from '@/data/acuityCatalog';

const EASE = [0.16, 1, 0.3, 1];

// Phase 1 checkout: hand off to Acuity scheduler with cart contents passed as a
// structured note. Phase 2 will replace this with a multi-step flow that posts
// directly to the Acuity API and charges via Square/Stripe.
export default function Checkout() {
  const { items, subtotal } = useCart();
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Checkout — Avalon Vitality'; }, []);

  // Auto-redirect empty cart back to /book
  useEffect(() => { if (items.length === 0) navigate('/store', { replace: true }); }, [items, navigate]);

  const acuityUrl = useMemo(() => {
    if (!ACUITY_OWNER_ID) return ACUITY_BOOKING_BASE;
    const params = new URLSearchParams({ owner: ACUITY_OWNER_ID });
    // If single item, deep-link to that appointment type
    if (items.length === 1 && items[0].appointmentTypeId) {
      params.set('appointmentType', String(items[0].appointmentTypeId));
    }
    // Pass cart contents as a note Acuity will display on the booking
    const note = items.map(i => `${i.qty || 1}× ${i.displayName || i.name} ($${i.price})`).join(' · ');
    if (note) params.set('field:cart', note);
    return `${ACUITY_BOOKING_BASE}?${params.toString()}`;
  }, [items]);

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
            <Link to="/cart" className="inline-flex items-center gap-2 font-body text-xs tracking-[0.2em] uppercase text-foreground/60 hover:text-foreground mb-5">
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              Back to cart
            </Link>
            <p className="font-body text-xs md:text-sm tracking-[0.3em] uppercase text-accent mb-3">Checkout</p>
            <h1 className="font-display text-5xl md:text-6xl uppercase tracking-tight leading-none mb-3">Schedule your visit</h1>
            <p className="text-base md:text-lg text-foreground/70 max-w-2xl">
              Pick a date and time. Add your address and contact info. Card authorized at booking, charged after your appointment.
            </p>
          </motion.header>

          {/* Order summary */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="rounded-2xl border border-foreground/15 p-5 md:p-6 mb-6"
          >
            <p className="font-body text-xs tracking-[0.3em] uppercase text-foreground/60 mb-3">Your visit</p>
            <ul className="space-y-2 mb-4">
              {items.map((it) => (
                <li key={it.cartId} className="flex items-baseline justify-between gap-3 text-sm md:text-base">
                  <span className="truncate">
                    <span className="font-display text-base md:text-lg uppercase tracking-tight">{it.displayName || it.name}</span>
                    {(it.qty || 1) > 1 && <span className="text-foreground/60"> × {it.qty}</span>}
                  </span>
                  <span className="font-display shrink-0">${it.price * (it.qty || 1)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between pt-3 border-t border-foreground/10">
              <span className="font-body text-xs tracking-[0.3em] uppercase">Subtotal</span>
              <span className="font-display text-2xl md:text-3xl">${subtotal}</span>
            </div>
          </motion.div>

          {/* Acuity hand-off */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            className="rounded-2xl bg-foreground/[0.03] border border-foreground/10 p-6 md:p-8"
          >
            <div className="flex items-start gap-3 mb-5">
              <Calendar className="w-5 h-5 text-accent shrink-0 mt-0.5" strokeWidth={1.5} />
              <div>
                <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight mb-1">Pick a date and time</h3>
                <p className="text-sm md:text-base text-foreground/70">
                  We'll open Acuity to confirm your slot, address, and payment. Your cart is sent over so the nurse arrives prepared.
                </p>
              </div>
            </div>
            <a
              href={acuityUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center rounded-full bg-foreground text-background font-body text-sm md:text-base tracking-[0.2em] uppercase px-7 py-4 hover:opacity-85 transition-opacity"
            >
              Continue to scheduling <ArrowRight className="inline-block w-4 h-4 ml-1.5 -mt-0.5" strokeWidth={1.5} />
            </a>
            {!ACUITY_OWNER_ID && (
              <p className="mt-4 text-[11px] md:text-xs text-accent">
                Setup pending: ACUITY_OWNER_ID is empty in src/data/acuityCatalog.js — currently routes to the generic Acuity scheduler.
              </p>
            )}
          </motion.div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
