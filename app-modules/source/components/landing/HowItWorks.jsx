import React, { useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ChevronDown } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import ScrollParallax from '@/components/ui/ScrollParallax';

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
    preview: 'Registered Nurse · arrival window',
    desc: 'We confirm your nurse and time.',
  },
  {
    n: '03',
    title: 'Recover',
    preview: '30-60 min',
    desc: 'Your nurse handles the rest.',
  },
];

function StepCard({ step, index, open, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: 0.82, delay: index * 0.18, ease: EASE }}
      whileHover={premiumHover}
      className={`av-treatment-card relative overflow-hidden rounded-[1.05rem] border transition-colors duration-base ease-editorial ${open ? 'is-open' : ''}`}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="flex w-full items-center justify-between px-4 py-3.5 transition-colors duration-base ease-editorial md:px-5"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center">
          <div className="min-w-0 text-left">
            <p className="font-heading text-2xl tracking-normal text-foreground leading-none">{step.title}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {/* Tablet+ inline preview — fills the otherwise-empty wide card row
              with the same eyebrow we show inside the disclosure body. Hidden
              on mobile to keep the row compact. */}
          <p className="hidden md:block font-body text-[11px] font-semibold tracking-[0.04em] uppercase text-foreground/72 text-right max-w-[24rem]">
            {step.preview}
          </p>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.38, ease: EASE }}
            className="shrink-0 text-foreground"
          >
            <ChevronDown
              className="h-4 w-4 shrink-0 text-foreground transition-transform duration-300"
              strokeWidth={2}
            />
          </motion.div>
        </div>
      </motion.button>

      <SmoothDisclosure open={open}>
        <div className="border-t border-foreground/[0.08] px-4 pb-4 pt-3 md:px-5">
          {/* Mobile keeps the eyebrow inside the disclosure (since it isn't
              visible in the collapsed row); tablet+ already shows it inline. */}
          <p className="md:hidden font-body text-[11px] font-semibold tracking-[0.04em] text-foreground/76">{step.preview}</p>
          <p className="mt-1.5 md:mt-0 font-body text-xs leading-relaxed text-foreground">{step.desc}</p>
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

        <ScrollParallax className="mb-6 md:mb-10">
          <h2 className="whitespace-nowrap font-heading text-display text-foreground tracking-tight leading-[0.92]">
            How it works
          </h2>
        </ScrollParallax>

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
