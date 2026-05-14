import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, MapPin, Zap, ChevronDown } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const steps = [
  {
    icon: CalendarCheck,
    title: 'Build Your Visit',
    desc: 'Choose your drip, drop location, pick a time.',
  },
  {
    icon: MapPin,
    title: 'Avalon Confirms',
    desc: 'We confirm and send your RN details. No surprises.',
  },
  {
    icon: Zap,
    title: 'We Come to You',
    desc: 'Licensed RN arrives to your home, hotel, or office.',
  },
];

export default function HowItWorks() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="how-it-works" className="pt-16 pb-10 md:py-20 px-4 scroll-mt-20">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-6 md:mb-10"
        >
          <p className="text-[11px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3">The Process</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95]">
            HOW AVALON WORKS
          </h2>
        </motion.div>

        {/* Accordion cards */}
        <div className="space-y-2">
          {steps.map((step, i) => {
            const isOpen = openIndex === i;
            const StepIcon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5, ease: EASE }}
                className="border border-white/10 rounded-2xl overflow-hidden"
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <span className="text-[#c9a84c] text-xs font-bold tracking-widest mr-4 shrink-0">
                      0{i + 1}
                    </span>
                    <span className="text-white font-bold text-base flex-1 text-left">{step.title}</span>
                  </div>
                  <ChevronDown
                    className="w-4 h-4 text-white/40 shrink-0 transition-transform duration-300"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    strokeWidth={2}
                  />
                </button>

                {/* Body */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="px-6 pb-6 flex items-start gap-4 border-t border-white/[0.06] pt-4">
                        <div className="w-8 h-8 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center shrink-0">
                          <StepIcon className="w-4 h-4 text-[#c9a84c]" strokeWidth={1.5} />
                        </div>
                        <p className="text-white/60 text-sm leading-relaxed">{step.desc}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
