import React, { useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ChevronDown } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const STEPS = [
  {
    n: '01',
    title: 'Choose',
    preview: 'Protocol · place · time',
    desc: 'Pick the protocol and location.',
  },
  {
    n: '02',
    title: 'Confirm',
    preview: 'RN · arrival window',
    desc: 'We confirm the visit and RN details.',
  },
  {
    n: '03',
    title: 'Recover',
    preview: '30-60 min',
    desc: 'Your RN handles setup and care.',
  },
];

function StepCard({ step, index, open, onToggle }) {

  return (
    <motion.div
      whileHover={premiumHover}
      className={`relative rounded-2xl border shadow-[0_18px_70px_hsl(var(--foreground)/0.055)] backdrop-blur-xl transition-colors duration-base ease-editorial ${
        open
          ? 'border-accent/40 bg-card'
          : 'border-border/90 bg-card/95 hover:border-foreground/28 hover:bg-muted/55'
      }`}
    >
      <motion.span
        initial={false}
        animate={{ scale: open ? 1.08 : 1, opacity: open ? 1 : 0.55 }}
        transition={{ duration: 0.45, ease: EASE }}
        className={`absolute -left-[1.85rem] top-7 hidden h-3 w-3 rounded-full border md:block ${
          open ? 'border-accent bg-accent shadow-[0_0_24px_hsl(var(--accent)/0.35)]' : 'border-border/90 bg-background'
        }`}
      />
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="w-full flex items-center justify-between px-5 py-4 [@media(hover:hover)]:hover:bg-muted/45 transition-colors duration-base ease-editorial"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-background/70 border border-border/90 flex items-center justify-center shrink-0">
            <span className="font-body text-[10px] tracking-[0.2em] text-accent/80">{step.n}</span>
          </div>
          <div className="text-left">
            <p className="font-heading text-xl tracking-[0.06em] text-foreground uppercase leading-none">{step.title}</p>
            <p className="font-body text-[9px] text-foreground/58 tracking-[0.15em] uppercase mt-1">{step.preview}</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="text-foreground/45 shrink-0"
        >
        <ChevronDown
          className="w-4 h-4 text-foreground/45 shrink-0 transition-transform duration-300"
          strokeWidth={2}
        />
        </motion.div>
      </motion.button>

      <SmoothDisclosure open={open}>
        <div className="border-t border-border/70 px-5 pb-5 pt-4">
          <p className="font-body text-xs text-foreground/62 leading-relaxed">{step.desc}</p>
        </div>
      </SmoothDisclosure>
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
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">Process</p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            HOW IT WORKS
          </h2>
        </motion.div>

        <div className="relative space-y-2">
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            whileInView={{ scaleY: 1, opacity: 1 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 1.05, ease: EASE }}
            className="absolute -left-[1.48rem] bottom-7 top-7 hidden w-px origin-top bg-gradient-to-b from-accent/60 via-foreground/[0.12] to-transparent md:block"
          />
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
