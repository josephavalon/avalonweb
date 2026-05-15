import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

const TOP_FAQS = [
  { q: 'What is Avalon Vitality?', a: 'Mobile concierge IV therapy and longevity service for the SF Bay Area. RN-administered, MD-supervised, delivered to your home or office.' },
  { q: 'How quickly can a nurse arrive?', a: 'Same-day in most Bay Area zip codes. Bookings made before noon typically delivered same afternoon.' },
  { q: 'Is Avalon safe for everyone?', a: 'Avalon is safe for most people, but not suitable for those with certain medical conditions. Disclose your full medical history at consultation.' },
  { q: 'Do you accept insurance?', a: 'No. Avalon is private-pay. We don\'t bill insurance, but we deliver outcomes traditional medicine can\'t.' },
  { q: 'What\'s the membership commitment?', a: '3-month minimum. Credits roll over month-to-month while your membership stays active. Cancel any time after the 3-month window.' },
];

const VISIBLE = 3;

export default function HomeFAQ() {
  const [openIdx, setOpenIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? TOP_FAQS : TOP_FAQS.slice(0, VISIBLE);

  return (
    <section className="pt-16 pb-6 md:pt-20 md:pb-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 md:mb-10">
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">FAQ</p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            Common Questions
          </h2>
          <div className="w-10 h-[2px] bg-accent mt-3" />
        </div>

        <div className="space-y-3">
          {visible.map((item, i) => {
            const isOpen = i === openIdx;
            return (
              <motion.button
                key={item.q}
                type="button"
                onClick={() => setOpenIdx(isOpen ? -1 : i)}
                className="w-full text-left border border-white/20 bg-white/[0.03] backdrop-blur-md rounded-2xl p-5 md:p-6 transition-colors hover:bg-white/[0.05]"
                aria-expanded={isOpen}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.07 }}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-heading text-base md:text-lg text-foreground tracking-wide">{item.q}</span>
                  {isOpen
                    ? <Minus className="w-4 h-4 text-accent shrink-0" strokeWidth={2} />
                    : <Plus className="w-4 h-4 text-accent shrink-0" strokeWidth={2} />}
                </div>
                <div className={`overflow-hidden transition-[max-height,margin,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'max-h-40 opacity-100 mt-3 md:mt-4' : 'max-h-0 opacity-0'}`}>
                  <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed">{item.a}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Show more / less */}
        {TOP_FAQS.length > VISIBLE && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 mt-4 font-body text-xs tracking-[0.25em] uppercase text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            {expanded ? 'Show less' : `+${TOP_FAQS.length - VISIBLE} more`}
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform duration-300"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              strokeWidth={2}
            />
          </button>
        )}

        <Link
          to="/faq"
          className="inline-block mt-5 md:mt-6 font-body text-xs tracking-[0.25em] uppercase text-accent hover:text-foreground transition-colors"
        >
          See all FAQs &rarr;
        </Link>
      </div>
    </section>
  );
}
