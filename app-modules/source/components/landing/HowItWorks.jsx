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
      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: 0.82, delay: index * 0.18, ease: EASE }}
      whileHover={premiumHover}
      className={`relative overflow-hidden rounded-[1.05rem] border border-foreground/12 bg-black/24 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.09),0_14px_54px_rgba(0,0,0,0.18)] backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-base ease-editorial ${
        open ? 'border-foreground/22 bg-black/30' : 'hover:border-foreground/18 hover:bg-black/28'
      }`}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="flex w-full items-center justify-between px-4 py-3.5 transition-colors duration-base ease-editorial md:px-5"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/14 bg-foreground/[0.055] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
            <span className="font-body text-[10px] tracking-[0.2em] text-foreground/58">{step.n}</span>
          </div>
          <div className="min-w-0 text-left">
            <p className="font-heading text-lg tracking-[0.08em] text-foreground uppercase leading-none md:text-xl">{step.title}</p>
            <p className="mt-1 truncate font-body text-[9px] uppercase tracking-[0.16em] text-foreground/58">{step.preview}</p>
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
        <div className="border-t border-foreground/[0.08] px-4 pb-4 pt-3 md:px-5">
          <p className="font-body text-xs text-foreground/62 leading-relaxed">{step.desc}</p>
        </div>
      </SmoothDisclosure>
    </motion.div>
  );
}

export default function HowItWorks() {
  const [openStep, setOpenStep] = useState(null);

  return (
    <section id="how-it-works" className="pt-12 pb-10 md:pt-20 md:pb-16 px-5 md:px-12 scroll-mt-20">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: EASE }}
          className="mb-6 md:mb-10"
        >
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            HOW IT WORKS
          </h2>
        </motion.div>

        <div className="relative space-y-2">
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
