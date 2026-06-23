import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { ChevronDown } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import ScrollParallax from '@/components/ui/ScrollParallax';

// Linear pricing-tick pattern: when the card enters the viewport, the badge
// counts 00 → step.n with a short ease over ~440 ms. IntersectionObserver fires
// once at 40% visibility so the tick only runs when the user actually sees it.
function useCountUpOnView(target, ref, enabled) {
  // Initialize to the final value so SSR + first paint render the real step
  // number (01/02/03), not a `00` placeholder. When motion is enabled the
  // IntersectionObserver below rewinds to 0 and ticks back up only once the
  // card actually crosses the threshold.
  const [value, setValue] = useState(Number(target));
  useEffect(() => {
    if (!enabled || !ref.current) return undefined;
    const node = ref.current;
    const obs = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      const targetNum = Number(target);
      const steps = 22;
      let i = 0;
      setValue(0);
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

function StepCard({ step, index, open, onToggle }) {
  const cardRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const display = useCountUpOnView(step.n, cardRef, !reduceMotion);

  return (
    <motion.div
      ref={cardRef}
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
        <div className="flex min-w-0 items-center gap-3">
          <div className="av-treatment-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <span className="font-body text-[10px] tracking-[0.2em] text-foreground tabular-nums">{display}</span>
          </div>
          <div className="min-w-0 text-left">
            <p className="font-heading text-2xl tracking-normal text-foreground leading-none">{step.title}</p>
          </div>
        </div>
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
      </motion.button>

      <SmoothDisclosure open={open}>
        <div className="border-t border-foreground/[0.08] px-4 pb-4 pt-3 md:px-5">
          <p className="font-body text-[11px] font-semibold tracking-[0.04em] text-foreground/76">{step.preview}</p>
          <p className="mt-1.5 font-body text-xs leading-relaxed text-foreground">{step.desc}</p>
        </div>
      </SmoothDisclosure>
    </motion.div>
  );
}

export default function HowItWorks() {
  const [openStep, setOpenStep] = useState(null);
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
              open={openStep === step.n}
              onToggle={() => setOpenStep(current => current === step.n ? null : step.n)}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
