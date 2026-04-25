import React from 'react';
import { motion } from 'framer-motion';
import { Brain, BarChart3, Droplet, Truck, Orbit, ChevronRight } from 'lucide-react';

const LAYERS = [
  {
    n: 5,
    name: 'Autonomy',
    icon: Orbit,
    line1: 'Your protocol runs itself.',
    line2: 'Avalon delivers it.',
    line2Accent: true,
  },
  {
    n: 4,
    name: 'Intelligence',
    icon: Brain,
    line1: 'We learn what works.',
    line2: 'Your protocol gets better over time.',
  },
  {
    n: 3,
    name: 'Data',
    icon: BarChart3,
    line1: 'Everything is tracked.',
    line2: 'Your history, your biomarkers, your trends.',
  },
  {
    n: 2,
    name: 'Modalities',
    icon: Droplet,
    line1: 'IVs and everything on top.',
    line2: 'NAD+, CBD, peptides, TRT, and more.',
  },
  {
    n: 1,
    name: 'Delivery',
    icon: Truck,
    line1: 'We come to you.',
    line2: 'At home, at events, or in-studio.',
  },
];

export default function PlatformStack() {
  return (
    <section id="operating-system" className="py-10 md:py-16 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-left mb-8 md:mb-12"
        >
          <p className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-3">Operating System</p>
          <h2 className="font-heading text-[10vw] md:text-7xl lg:text-8xl text-foreground tracking-wide leading-[0.95]">
            FROM DELIVERY<br className="md:hidden" /> TO INTELLIGENCE
          </h2>
          <div className="w-10 h-[2px] bg-accent mt-4 mb-5" />
          <p className="font-body text-base md:text-lg text-foreground/85 leading-snug max-w-xl">
            Every session makes you smarter.<br />Five layers. One record.
          </p>
        </motion.div>

        <div className="flex flex-col">
          {LAYERS.map((layer, i) => {
            const Icon = layer.icon;
            return (
              <motion.div
                key={layer.n}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.55, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 md:gap-6 py-5 md:py-7 ${i === 0 ? '' : 'border-t'} border-border/60`}
              >
                {/* Icon in gold-ringed circle */}
                <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full border border-accent/60 text-accent shrink-0">
                  <Icon className="w-6 h-6 md:w-7 md:h-7" strokeWidth={1.6} />
                </div>

                {/* Vertical accent bar */}
                <div className="h-14 md:h-16 w-px bg-border/70" />

                {/* Text block */}
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent font-body uppercase mb-1">Layer {layer.n}</p>
                  <h3 className="font-heading text-2xl md:text-4xl text-foreground tracking-wide uppercase leading-tight mb-1.5">{layer.name}</h3>
                  <p className="font-body text-sm md:text-base text-foreground/90 leading-snug">{layer.line1}</p>
                  <p className={`font-body text-sm md:text-base leading-snug ${layer.line2Accent ? 'text-accent' : 'text-muted-foreground'}`}>{layer.line2}</p>
                </div>

                {/* Chevron */}
                <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-accent shrink-0" strokeWidth={1.8} />
              </motion.div>
            );
          })}
        </div>

        {/* Avalon OS mobile app badge */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 md:mt-14 mx-auto max-w-3xl border border-foreground/20 rounded-xl px-6 md:px-10 py-6 md:py-8 flex items-center gap-5 md:gap-7"
        >
          <div className="shrink-0 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full border border-accent/40 text-accent">
            <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="2" width="12" height="20" rx="2.5" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent font-body uppercase mb-1">Avalon OS · Mobile</p>
            <h3 className="font-heading text-xl md:text-3xl text-foreground tracking-wide uppercase leading-tight">Coming Soon to iOS & Android</h3>
            <p className="font-body text-xs md:text-sm text-muted-foreground mt-1.5">Your protocol, your data, your record — in your pocket.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
