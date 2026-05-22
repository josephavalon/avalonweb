import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';
import { EASE } from '@/lib/motion';

const ROWS = [
  { feature: 'Licensed RN on every visit',         avalon: true,  drip: true,  reviv: true  },
  { feature: 'Physician medical direction',         avalon: true,  drip: true,  reviv: true  },
  { feature: 'Comes to you (mobile)',               avalon: true,  drip: true,  reviv: false },
  { feature: 'Same-day booking',                    avalon: true,  drip: true,  reviv: false },
  { feature: 'NAD+ IV (250–1000mg)',                avalon: true,  drip: null,  reviv: null  },
  { feature: 'Exosome IV therapy',                  avalon: true,  drip: false, reviv: false },
  { feature: 'Subscription / credits model',        avalon: true,  drip: false, reviv: false },
  { feature: 'Personalized protocol builder',       avalon: true,  drip: false, reviv: false },
  { feature: 'Home, hotel, office & event delivery',avalon: true,  drip: true,  reviv: false },
  { feature: 'SF Bay Area coverage',                avalon: true,  drip: true,  reviv: null  },
  { feature: 'Luxury concierge experience',         avalon: true,  drip: false, reviv: false },
];

// true = ✓, false = ✗, null = varies / not confirmed
function Cell({ value }) {
  if (value === true)  return <Check  className="w-4 h-4 text-accent mx-auto" strokeWidth={2.5} />;
  if (value === false) return <X      className="w-3.5 h-3.5 text-foreground/20 mx-auto" strokeWidth={2} />;
  return <Minus className="w-3.5 h-3.5 text-foreground/25 mx-auto" strokeWidth={2} />;
}

export default function ComparisonTable() {
  return (
    <section className="pt-10 pb-10 md:pt-16 md:pb-16 px-4">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: EASE }}
          className="mb-8 md:mb-10"
        >
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">Why Avalon</p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            How We Stack Up
          </h2>
          <p className="font-body text-sm text-foreground/55 leading-relaxed mt-3 max-w-md">
            Mobile IV therapy, compared.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-24px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="rounded-2xl border border-foreground/10 overflow-hidden"
        >
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px] md:grid-cols-[1fr_120px_120px_120px] border-b border-foreground/10 bg-white/[0.04]">
            <div className="px-4 md:px-5 py-3" />
            {['Avalon', 'Drip', 'REVIV'].map((name, i) => (
              <div key={name} className={`py-3 text-center ${i === 0 ? 'bg-accent/[0.06]' : ''}`}>
                <p className={`font-body text-[10px] tracking-[0.2em] uppercase font-semibold ${i === 0 ? 'text-accent' : 'text-foreground/40'}`}>
                  {name}
                </p>
              </div>
            ))}
          </div>

          {/* Rows */}
          {ROWS.map(({ feature, avalon, drip, reviv }, i) => (
            <div
              key={feature}
              className={`grid grid-cols-[1fr_80px_80px_80px] md:grid-cols-[1fr_120px_120px_120px] border-b border-foreground/[0.06] last:border-0 ${
                i % 2 === 0 ? 'bg-white/[0.015]' : ''
              }`}
            >
              <div className="px-4 md:px-5 py-3.5 flex items-center">
                <p className="font-body text-xs text-foreground/70 leading-snug">{feature}</p>
              </div>
              <div className="py-3.5 flex items-center justify-center bg-accent/[0.03]">
                <Cell value={avalon} />
              </div>
              <div className="py-3.5 flex items-center justify-center">
                <Cell value={drip} />
              </div>
              <div className="py-3.5 flex items-center justify-center">
                <Cell value={reviv} />
              </div>
            </div>
          ))}
        </motion.div>

        <p className="font-body text-[10px] text-foreground/25 tracking-[0.1em] mt-3">
          Competitor info based on publicly available data. Subject to change.
        </p>

      </div>
    </section>
  );
}
