import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, BarChart3, Droplet, Truck, Orbit, ChevronRight, ChevronLeft, Smartphone } from 'lucide-react';

const LAYERS = [
  { n: 1, name: 'Delivery', icon: Truck, line1: 'We come to you.', line2: 'At home, at events, or in-studio.' },
  { n: 2, name: 'Modalities', icon: Droplet, line1: 'IVs and everything on top.', line2: 'NAD+, CBD, peptides, TRT, and more.' },
  { n: 3, name: 'Data', icon: BarChart3, line1: 'Everything is tracked.', line2: 'Your history, your biomarkers, your trends.' },
  { n: 4, name: 'Intelligence', icon: Brain, line1: 'We learn what works.', line2: 'Your protocol gets better over time.' },
  { n: 5, name: 'Autonomy', icon: Orbit, line1: 'Your protocol runs itself.', line2: 'Avalon delivers it.', line2Accent: true },
];

const EASE = [0.16, 1, 0.3, 1];

export default function PlatformStack() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setDirection(1);
      setActive((a) => (a + 1) % LAYERS.length);
    }, 4500);
    return () => clearInterval(t);
  }, [paused]);

  const goTo = (i) => {
    if (i === active) return;
    setDirection(i > active ? 1 : -1);
    setActive(i);
    setPaused(true);
  };

  const layer = LAYERS[active];
  const Icon = layer.icon;

  return (
    <section id="operating-system" className="py-10 md:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-5 md:mb-8"
        >
          <p className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-3">Operating System</p>
          <h2 className="font-heading text-[9vw] md:text-6xl lg:text-7xl text-foreground tracking-wide leading-[0.95]">
            FROM DELIVERY<br className="md:hidden" /> TO INTELLIGENCE
          </h2>
          <div className="w-10 h-[2px] bg-accent mt-3 mb-4" />
          <p className="font-body text-sm md:text-base text-foreground/85 leading-snug max-w-xl">
            Every session makes you smarter. Five layers. One record.
          </p>
        </motion.div>

        {/* Coming Soon mobile strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
          className="flex items-center gap-3 mb-5 px-3 py-2.5 border border-white/10 bg-white/[0.03] backdrop-blur-md rounded-lg"
        >
          <Smartphone className="w-4 h-4 text-accent shrink-0" strokeWidth={1.7} />
          <p className="text-[10px] md:text-[11px] tracking-[0.3em] text-accent font-body uppercase">
            Avalon OS · Mobile · Coming Soon · iOS &amp; Android
          </p>
        </motion.div>

        {/* Compact card with switcher */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="border border-white/10 bg-white/[0.03] backdrop-blur-md rounded-2xl p-5 md:p-7"
        >
          {/* Layer chips */}
          <div className="grid grid-cols-5 gap-1.5 md:gap-3 mb-5 md:mb-6">
            {LAYERS.map((l, i) => (
              <button
                key={l.n}
                type="button"
                onClick={() => goTo(i)}
                className="group flex flex-col items-center gap-1.5 outline-none"
                aria-label={`Layer ${l.n} — ${l.name}`}
              >
                <span
                  className={`text-[9px] md:text-[10px] tracking-[0.25em] font-body uppercase transition-colors ${
                    i === active ? 'text-accent' : 'text-muted-foreground/60 group-hover:text-foreground/80'
                  }`}
                >
                  L{l.n}
                </span>
                <span
                  className={`block w-full h-[2px] transition-all duration-500 ${
                    i === active ? 'bg-accent' : 'bg-border/60 group-hover:bg-foreground/30'
                  }`}
                  style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
              </button>
            ))}
          </div>

          {/* Active layer slide */}
          <div className="relative overflow-hidden min-h-[150px] md:min-h-[180px]">
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24 }}
                transition={{ duration: 0.55, ease: EASE }}
                className="grid grid-cols-[auto_1fr] items-center gap-4 md:gap-6"
              >
                <div className="flex items-center justify-center w-14 h-14 md:w-20 md:h-20 rounded-full border border-accent/60 text-accent shrink-0">
                  <Icon className="w-6 h-6 md:w-9 md:h-9" strokeWidth={1.6} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent font-body uppercase mb-1">Layer {layer.n}</p>
                  <h3 className="font-heading text-2xl md:text-4xl text-foreground tracking-wide uppercase leading-tight mb-2">{layer.name}</h3>
                  <p className="font-body text-sm md:text-base text-foreground/90 leading-snug">{layer.line1}</p>
                  <p className={`font-body text-sm md:text-base leading-snug ${layer.line2Accent ? 'text-accent' : 'text-muted-foreground'}`}>{layer.line2}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-5 md:mt-6 pt-4 md:pt-5/60">
            <button
              type="button"
              onClick={() => goTo((active - 1 + LAYERS.length) % LAYERS.length)}
              className="p-1.5 text-muted-foreground hover:text-accent transition-colors"
              aria-label="Previous layer"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.8} />
            </button>
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground font-body uppercase">
              {String(active + 1).padStart(2, '0')} / {String(LAYERS.length).padStart(2, '0')}
            </p>
            <button
              type="button"
              onClick={() => goTo((active + 1) % LAYERS.length)}
              className="p-1.5 text-muted-foreground hover:text-accent transition-colors"
              aria-label="Next layer"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.8} />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
