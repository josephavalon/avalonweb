import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { EASE } from '@/lib/motion';
import ScrollParallax from '@/components/ui/ScrollParallax';

// Linear pricing-tick pattern: when the card enters the viewport, the badge
// counts 00 → step.n with a short ease over ~440 ms. IntersectionObserver fires
// once at 40% visibility so the tick only runs when the user actually sees it.
function useCountUpOnView(target, ref, enabled) {
  const [value, setValue] = useState(enabled ? 0 : Number(target));
  useEffect(() => {
    if (!enabled || !ref.current) return undefined;
    const node = ref.current;
    const obs = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      const targetNum = Number(target);
      const steps = 22;
      let i = 0;
      const id = setInterval(() => {
        i += 1;
        setValue(Math.round((i / steps) * targetNum));
        if (i >= steps) clearInterval(id);
      }, 20);
    }, { threshold: 0.4 });
    obs.observe(node);
    return () => obs.disconnect();
  }, [target, ref, enabled]);
  return String(value).padStart(2, '0');
}

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
    desc: 'We confirm the visit and registered nurse details.',
  },
  {
    n: '03',
    title: 'Recover',
    preview: '30-60 min',
    desc: 'Your registered nurse handles setup and care.',
  },
];

function StepCard({ step, index }) {
  const cardRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const display = useCountUpOnView(step.n, cardRef, !reduceMotion);

  // Static numbered step (no disclosure). Three one-line steps have nothing
  // worth collapsing, so showing the detail outright differentiates this
  // section from the catalog/footer accordions and reads at a glance.
  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: 0.82, delay: index * 0.18, ease: EASE }}
      className="av-treatment-card relative overflow-hidden rounded-[1.05rem] border"
    >
      <div className="flex items-start gap-3 px-4 py-4 md:px-5">
        <div className="av-treatment-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
          <span className="font-body text-[11px] tracking-[0.2em] text-white tabular-nums">{display}</span>
        </div>
        <div className="min-w-0 text-left">
          <p className="font-heading text-2xl tracking-normal text-white leading-none">{step.title}</p>
          <p className="mt-1 font-body text-[11px] font-semibold tracking-[0.04em] text-white/76">{step.preview}</p>
          <p className="mt-2 font-body text-xs leading-relaxed text-white/72">{step.desc}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="pt-12 pb-10 md:pt-20 md:pb-16 px-5 md:px-12 scroll-mt-20">
      <div className="max-w-6xl mx-auto">

        <ScrollParallax className="mb-6 md:mb-10">
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground tracking-tight leading-[0.92]">
            How it works
          </h2>
        </ScrollParallax>

        <div className="relative space-y-2">
          {/* Connecting line: hairline that draws downward from the centerline of
              step 1's badge to step 3's badge as the section enters viewport.
              `left-9` (36px) aligns with the badge center (px-4 + half of w-10).
              Stays behind the cards (z-0); the cards' `av-treatment-card` is on
              top of it. Skipped under prefers-reduced-motion via the CSS rule on
              `.av-howitworks-connector`. */}
          <motion.div
            className="av-howitworks-connector absolute left-9 top-[34px] bottom-[34px] w-px bg-foreground/15 pointer-events-none z-0"
            style={{ transformOrigin: 'top' }}
            initial={reduceMotion ? { scaleY: 1 } : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
            aria-hidden="true"
          />

          {STEPS.map((step, i) => (
            <StepCard
              key={step.n}
              step={step}
              index={i}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
