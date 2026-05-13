import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Circle, CircleDot, Sparkles, Wrench, ArrowRight } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const TIERS = [
  { icon: Circle,    name: 'Starter',  price: 'From $200', unit: '/mo', note: '1 IV per month' },
  { icon: CircleDot, name: 'Premium',  price: 'From $400', unit: '/mo', note: '2 IVs per month' },
  { icon: Sparkles,  name: 'VIP',      price: 'From $800', unit: '/mo', note: '4 IVs per month' },
  { icon: Wrench,    name: 'Custom',   price: 'Yours',     unit: '',    note: 'Concierge-designed' },
];

const CARD = "flex flex-col gap-3 p-4 md:p-5 rounded-2xl border border-foreground/[0.1] hover:border-foreground/25 hover:bg-foreground/[0.02] transition-all duration-200 group h-full min-h-[160px]";

export default function MembershipSection() {
  return (
    <section id="membership" className="py-14 md:py-20 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10"
        >
          <div>
            <p className="font-body text-[11px] tracking-[0.3em] text-accent uppercase mb-2">Membership Tiers</p>
            <h2 className="font-heading text-[10vw] md:text-6xl lg:text-7xl text-foreground tracking-wide leading-[0.92] uppercase">
              Membership
            </h2>
            <div className="w-10 h-[2px] bg-accent mt-3" />
          </div>
          <Link
            to="/membership"
            className="self-start md:self-end inline-flex items-center gap-2 font-body text-[11px] tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground transition-colors"
          >
            View Full Details <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>

        {/* Mobile — horizontal snap scroll */}
        <div className="md:hidden -mx-4 px-4 mb-6">
          <div
            className="flex gap-2 overflow-x-auto pb-2 no-scrollbar"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
              overscrollBehavior: 'contain',
              touchAction: 'pan-x',
              transform: 'translateZ(0)',
            }}
          >
            {TIERS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, ease: EASE, delay: i * 0.04 }}
                className="shrink-0"
                style={{ scrollSnapAlign: 'start' }}
              >
                <Link
                  to="/membership"
                  className="flex flex-col gap-2.5 p-4 rounded-2xl border border-foreground/[0.1] active:border-foreground/25 active:bg-foreground/[0.02] transition-all duration-200 group"
                  style={{ width: '160px' }}
                >
                  <t.icon className="w-5 h-5 text-foreground/40" strokeWidth={1.5} />
                  <p className="font-body text-sm font-semibold text-foreground tracking-[0.02em] leading-tight">{t.name}</p>
                  <p className="font-body text-xs text-foreground/50">
                    {t.price}{t.unit && <span className="text-foreground/30">{t.unit}</span>}
                  </p>
                  <p className="font-body text-[10px] text-foreground/30 leading-tight">{t.note}</p>
                </Link>
              </motion.div>
            ))}
            <div aria-hidden="true" className="shrink-0 w-2" />
          </div>
        </div>

        {/* Desktop — 4-col grid, no pagination needed (4 items = 1 page) */}
        <div className="hidden md:grid md:grid-cols-4 gap-2 md:gap-3">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
            >
              <Link to="/membership" className={CARD}>
                <t.icon className="w-5 h-5 text-foreground/40 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
                <div className="flex-1">
                  <p className="font-body text-sm font-semibold text-foreground tracking-[0.04em] leading-snug">{t.name}</p>
                  <p className="font-body text-[10px] text-foreground/40 tracking-[0.15em] uppercase mt-0.5">{t.note}</p>
                </div>
                <p className="font-body text-xs text-foreground/50">
                  {t.price}{t.unit && <span className="text-foreground/30">{t.unit}</span>}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <p className="font-body text-[10px] text-foreground/30 text-center mt-5 tracking-[0.15em]">
          3-month minimum · credits roll over · subject to clinical approval
        </p>

      </div>
    </section>
  );
}
