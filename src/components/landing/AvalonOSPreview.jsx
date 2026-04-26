import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, X } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

export default function AvalonOSPreview() {
  const [zoomed, setZoomed] = useState(false);
  return (
    <section id="avalon-os" className="py-10 md:py-20 px-4 border-t border-border">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-3 md:gap-4">
        <motion.button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label="Zoom Avalon OS preview"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="block w-full focus:outline-none cursor-zoom-in active:scale-[0.99] transition-transform"
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <img
            src="/avalon-os-card.webp"
            alt="Avalon OS — coming soon. Five layers: Delivery, Modalities, Data, Intelligence, Autonomy. Mobile preview of today's protocol."
            width={700}
            height={996}
            loading="lazy"
            decoding="async"
            className="block w-full h-auto mx-auto rounded-lg shadow-2xl max-w-[700px]"
          />
        </motion.button>
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="text-[11px] md:text-xs tracking-[0.25em] text-accent/80 hover:text-accent uppercase font-body inline-flex items-center gap-1.5"
        >
          <ZoomIn className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={1.6} />
          Tap to Zoom
        </button>
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
              src="/avalon-os-card.webp"
              alt="Avalon OS — full preview"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-auto rounded-lg"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
