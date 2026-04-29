import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Droplet, BarChart3, Brain, Orbit,
  ChevronRight, ZoomIn, X, ClipboardCheck, Sparkles
} from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const LAYERS = [
  { n: 0, name: 'Input',        desc: 'Share your goals and data.',      icon: ClipboardCheck },
  { n: 1, name: 'Modalities',   desc: 'IVs, IMs, SCs, NAD+, CBD, Peptides, HRT, Supplements, Diet.', icon: Droplet },
  { n: 2, name: 'Protocol',     desc: 'We design what\'s right for you.', icon: Sparkles },
  { n: 3, name: 'Delivery',     desc: 'We ship or come to you.',         icon: Truck },
  { n: 4, name: 'Data',         desc: 'Everything tracked, end-to-end.', icon: BarChart3 },
  { n: 5, name: 'Intelligence', desc: 'We learn what works and what doesn\'t.', icon: Brain },
  { n: 6, name: 'Autonomy',     desc: 'Your protocol runs itself.',     accentTail: 'Avalon delivers it.', icon: Orbit },
];

export default function AvalonOSPreview() {
  const [zoomed, setZoomed] = useState(false);
  const closeRef = useRef(null);

  // Focus trap + Escape key for modal
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    document.addEventListener('keydown', onKey);
    // Focus close button when modal opens
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [zoomed]);
  return (
    <section id="avalon-os" className="py-12 md:py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Title block — Coming Soon eyebrow → AVALON OS title → divider → Intelligent Delivery sub-subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">Coming Soon</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] uppercase">
            Avalon OS
          </h2>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mt-3 md:mt-5">
            Intelligent delivery. Real-time data. Peak every day.
          </p>
        </motion.div>

        <div className="grid grid-cols-[1.05fr_1fr] gap-3 md:gap-6 items-stretch">
          {/* LEFT — 5 layer cards (canonical site style) */}
          <div className="min-w-0 h-full">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
              className="h-full flex flex-col justify-between gap-2 md:gap-2"
            >
              {LAYERS.map((l) => {
                const Icon = l.icon;
                return (
                  <div key={l.n} className="flex items-center gap-2 md:gap-4 px-2 md:px-4 py-1.5 md:py-2 border border-white/20 bg-white/[0.03] backdrop-blur-md rounded-xl">
                    <span className="text-xs md:text-lg tracking-[0.15em] text-accent font-body uppercase w-4 md:w-7 shrink-0 text-center">{l.n}</span>
                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-accent/55 flex items-center justify-center text-accent shrink-0">
                      <Icon className="w-4 h-4 md:w-4 md:h-4" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading text-[11px] md:text-sm text-foreground tracking-wide uppercase leading-none mb-0.5 md:mb-1">{l.name}</p>
                      <p className="font-body text-[10px] leading-tight md:text-xs md:leading-relaxed text-muted-foreground">
                        {l.desc}{l.accentTail && <> <span className="text-accent font-normal">{l.accentTail}</span></>}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-accent/60 shrink-0" strokeWidth={1.6} />
                  </div>
                );
              })}
            </motion.div>
          </div>

          {/* RIGHT — exact phone screenshot, tightly cropped */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.9, ease: EASE }}
            className="flex flex-col items-center justify-start gap-1 min-w-0 h-full self-stretch"
          >
            <button
              type="button"
              onClick={() => setZoomed(true)}
              aria-label="Zoom Avalon OS phone preview"
              className="avalon-os-phone-wrap block w-full focus:outline-none cursor-zoom-in active:scale-[0.98] transition-transform"
              style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <img
                src="/avalon-os-phone.webp"
                alt="Avalon OS — mobile preview of today's morning protocol"
                width={360}
                height={1035}
                loading="lazy"
                decoding="async"
                className="block w-auto h-auto mx-auto max-h-[320px] sm:max-h-[440px] md:max-h-[560px] lg:max-h-[640px] max-w-[130px] sm:max-w-[180px] md:max-w-[220px] lg:max-w-[240px] rounded-[1.25rem] md:rounded-[2.5rem] shadow-2xl border border-foreground/10"
                style={{
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 75%, transparent 100%)',
                  maskImage: 'linear-gradient(to bottom, black 0%, black 75%, transparent 100%)',
                }}
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
            role="dialog"
            aria-modal="true"
            aria-label="Avalon OS phone preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setZoomed(false)}
          >
            <button
              ref={closeRef}
              onClick={() => setZoomed(false)}
              aria-label="Close zoom"
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
              className="max-h-[92vh] w-auto rounded-[2rem]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
