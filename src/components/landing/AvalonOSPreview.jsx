import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Droplet, BarChart3, Brain, Orbit,
  ChevronRight, ShieldCheck, Award, ZoomIn, X
} from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const LAYERS = [
  { n: 1, name: 'Delivery',     desc: 'We ship or come to you.',         icon: Truck },
  { n: 2, name: 'Modalities',   desc: 'IVs, NAD+, peptides, TRT.',       icon: Droplet },
  { n: 3, name: 'Data',         desc: 'Everything tracked, end-to-end.', icon: BarChart3 },
  { n: 4, name: 'Intelligence', desc: 'We learn what works.',            icon: Brain },
  { n: 5, name: 'Autonomy',     desc: 'Your protocol runs itself.',      accentTail: 'Avalon delivers it.', icon: Orbit },
];

const CERTS = [
  { label: 'HIPAA', sub: 'COMPLIANT', icon: ShieldCheck },
  { label: 'ISO',   sub: '27001',     icon: Award },
  { label: 'SOC 2', sub: 'TYPE II',   icon: ShieldCheck },
];

export default function AvalonOSPreview() {
  const [zoomed, setZoomed] = useState(false);
  return (
    <section id="avalon-os" className="py-10 md:py-20 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        {/* Section title block — matches site canonical pattern */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">Coming Soon — Avalon OS</p>
          <h2 className="font-heading text-[10vw] md:text-7xl lg:text-8xl text-foreground tracking-wide leading-[0.92] uppercase">
            Intelligent Delivery
          </h2>
          <div className="w-12 md:w-14 h-[2px] md:h-[3px] bg-accent mt-4 md:mt-5 mb-4 md:mb-5" />
          <p className="font-body text-sm md:text-base text-foreground/85 leading-snug max-w-xl">
            Real-time data. Intelligent protocol. Peak every day.
          </p>
        </motion.div>

        <div className="grid grid-cols-[1.05fr_1fr] gap-3 md:gap-10 items-center">
          {/* LEFT — layers + trust card (canonical site style) */}
          <div className="min-w-0 space-y-2.5 md:space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
              className="space-y-2 md:space-y-2.5"
            >
              {LAYERS.map((l) => {
                const Icon = l.icon;
                return (
                  <div key={l.n} className="flex items-start gap-2.5 md:gap-3 px-3 md:px-4 py-3 md:py-3.5 border border-foreground/15 rounded-xl">
                    <span className="text-[13px] md:text-[14px] tracking-[0.2em] text-accent font-body uppercase w-5 md:w-6 shrink-0 pt-0.5">{l.n}</span>
                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-full border border-accent/55 flex items-center justify-center text-accent shrink-0">
                      <Icon className="w-4 h-4 md:w-5 md:h-5" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading text-[14px] md:text-base text-foreground tracking-wide uppercase leading-none mb-1">{l.name}</p>
                      <p className="font-body text-[11px] md:text-[13px] text-muted-foreground leading-snug">
                        {l.desc}{l.accentTail && <> <span className="text-accent font-normal">{l.accentTail}</span></>}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent/60 shrink-0 mt-1" strokeWidth={1.6} />
                  </div>
                );
              })}
            </motion.div>

            {/* Trust card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.55, delay: 0.3, ease: EASE }}
              className="border border-foreground/15 rounded-md md:rounded-xl px-3 md:px-4 py-3"
            >
              <div className="flex items-start gap-2.5 md:gap-3 mb-2.5 md:mb-3">
                <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-accent shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[11px] md:text-sm text-foreground leading-snug">Your health. Your data. Our priority.</p>
                  <p className="font-body text-[9px] md:text-[11px] text-muted-foreground leading-snug mt-0.5">HIPAA-compliant. Bank-level security.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                {CERTS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} className="flex items-center gap-1.5 px-1.5 md:px-2 py-1.5 border border-foreground/10 rounded">
                      <Icon className="w-3 h-3 md:w-3.5 md:h-3.5 text-accent/70 shrink-0" strokeWidth={1.5} />
                      <div className="min-w-0 leading-none">
                        <p className="font-body text-[8px] md:text-[10px] text-foreground/85 font-semibold tracking-wide uppercase truncate">{c.label}</p>
                        <p className="font-body text-[6px] md:text-[8px] text-muted-foreground tracking-widest uppercase truncate">{c.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* RIGHT — exact phone screenshot, no React rebuild */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.9, ease: EASE }}
            className="flex flex-col items-center gap-2 min-w-0"
          >
            <button
              type="button"
              onClick={() => setZoomed(true)}
              aria-label="Zoom Avalon OS phone preview"
              className="block w-full focus:outline-none cursor-zoom-in active:scale-[0.98] transition-transform"
              style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <img
                src="/avalon-os-phone.webp"
                alt="Avalon OS — mobile preview of today's morning protocol"
                width={360}
                height={910}
                loading="lazy"
                decoding="async"
                className="block w-full h-auto mx-auto max-w-[180px] sm:max-w-[230px] md:max-w-[320px]"
              />
            </button>
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="text-[10px] md:text-[11px] tracking-[0.25em] text-accent/80 hover:text-accent uppercase font-body inline-flex items-center gap-1.5"
            >
              <ZoomIn className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={1.6} />
              Tap to Zoom
            </button>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setZoomed(false)}
          >
            <button
              onClick={() => setZoomed(false)}
              aria-label="Close"
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white border border-white/20 z-[201]"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
            <motion.img
              src="/avalon-os-phone.webp"
              alt="Avalon OS — full phone preview"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-auto"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
