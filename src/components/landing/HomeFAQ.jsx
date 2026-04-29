import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus } from 'lucide-react';

const TOP_FAQS = [
  { q: 'What is Avalon Vitality?', a: 'Mobile concierge IV therapy and longevity service for the SF Bay Area. RN-administered, MD-supervised, delivered to your home or office.' },
  { q: 'How quickly can a nurse arrive?', a: 'Same-day in most Bay Area zip codes. Bookings made before noon typically delivered same afternoon.' },
  { q: 'Is Avalon safe for everyone?', a: 'Avalon is safe for most people, but not suitable for those with certain medical conditions. Disclose your full medical history at consultation.' },
  { q: 'Do you accept insurance?', a: 'No. Avalon is private-pay. We don\'t bill insurance, but we deliver outcomes traditional medicine can\'t.' },
  { q: 'What\'s the membership commitment?', a: '3-month minimum. Credits roll over month-to-month while your membership stays active. Cancel any time after the 3-month window.' },
];

export default function HomeFAQ() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <section className="py-12 md:py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-left mb-6 md:mb-10">
          <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">FAQ</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] uppercase">
            Common questions
          </h2>
          <div className="w-12 md:w-16 h-[2px] bg-accent mt-3 md:mt-4" />
        </div>

        <div className="space-y-3">
          {TOP_FAQS.map((item, i) => {
            const isOpen = i === openIdx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpenIdx(isOpen ? -1 : i)}
                className="w-full text-left border border-white/20 bg-white/[0.03] backdrop-blur-md rounded-2xl p-5 md:p-6 transition-colors hover:bg-white/[0.05]"
                aria-expanded={isOpen}
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
              </button>
            );
          })}
        </div>

        <Link
          to="/faq"
          className="inline-block mt-6 md:mt-8 font-body text-xs tracking-[0.25em] uppercase text-accent hover:text-foreground transition-colors"
        >
          See all FAQs &rarr;
        </Link>
      </div>
    </section>
  );
}
