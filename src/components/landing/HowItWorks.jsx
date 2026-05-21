import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { EASE, premiumCard, premiumHover, premiumTap } from '@/lib/motion';

const STEPS = [
  {
    n: '01',
    title: 'Build your visit',
    preview: 'Menu · location · time',
    desc: 'Choose your drip, drop your location, pick a time. Our menu covers everything from hydration and energy to NAD+ and specialty infusions.',
  },
  {
    n: '02',
    title: 'Get confirmed',
    preview: 'RN details · arrival window',
    desc: 'We lock your arrival window and send your RN\'s details. Expect a 90-minute window — most arrive well within it.',
  },
  {
    n: '03',
    title: 'RN comes to you',
    preview: '30-60 min session',
    desc: 'A licensed RN arrives to your home, hotel, or office. Setup takes minutes. Your session runs 30–60 minutes depending on your protocol.',
  },
];

function StepCard({ step, index, open, onToggle }) {

  return (
    <motion.div
      {...premiumCard(index * 0.11)}
      whileHover={premiumHover}
      className={`rounded-2xl border backdrop-blur-xl shadow-[0_18px_70px_hsl(var(--foreground)/0.035)] transition-colors duration-base ease-editorial ${
        open
          ? 'border-accent/35 bg-white/[0.12]'
          : 'border-foreground/10 bg-white/[0.08] hover:border-foreground/20 hover:bg-white/[0.105]'
      }`}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="w-full flex items-center justify-between px-5 py-4 [@media(hover:hover)]:hover:bg-white/[0.08] transition-colors duration-base ease-editorial"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-foreground/10 flex items-center justify-center shrink-0">
            <span className="font-body text-[10px] tracking-[0.2em] text-accent/70">{step.n}</span>
          </div>
          <div className="text-left">
            <p className="font-heading text-xl tracking-[0.06em] text-foreground uppercase leading-none">{step.title}</p>
            <p className="font-body text-[9px] text-foreground/40 tracking-[0.15em] uppercase mt-1">{step.preview}</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="text-foreground/30 shrink-0"
        >
        <ChevronDown
          className="w-4 h-4 text-foreground/30 shrink-0 transition-transform duration-300"
          strokeWidth={2}
        />
        </motion.div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.42, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
              <p className="font-body text-xs text-foreground/50 leading-relaxed">{step.desc}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HowItWorks() {
  const [openStep, setOpenStep] = useState(null);

  return (
    <section id="how-it-works" className="pt-12 pb-10 md:pt-20 md:pb-16 px-4 scroll-mt-20">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: EASE }}
          className="mb-6 md:mb-10"
        >
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">The Process</p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            HOW AVALON WORKS
          </h2>
        </motion.div>

        <div className="space-y-2">
          {STEPS.map((step, i) => (
            <StepCard
              key={step.n}
              step={step}
              index={i}
              open={openStep === step.n}
              onToggle={() => setOpenStep(current => current === step.n ? null : step.n)}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
