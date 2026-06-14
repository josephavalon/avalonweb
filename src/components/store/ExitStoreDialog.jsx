import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { EASE } from '@/lib/motion';

/**
 * Top-anchored "Exit the store?" confirm. Avalon dark-glass + Bebas, slides
 * down from the top of the screen (not a centered dialog). Driven by
 * useBackExitConfirm — fires when the user presses the browser Back button.
 *
 * Props: open, onKeepShopping, onExit.
 */
export default function ExitStoreDialog({ open, onKeepShopping, onExit }) {
  const reduceMotion = useReducedMotion();
  const keepRef = useRef(null);

  // Esc = keep shopping (safe path). Focus the safe button on open. Lock scroll.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onKeepShopping();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = window.setTimeout(() => keepRef.current?.focus(), 20);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(id);
    };
  }, [open, onKeepShopping]);

  if (typeof document === 'undefined') return null;

  const cardMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: -24 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -16 },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="av-modal-scrim fixed inset-0 z-[120] flex justify-center px-4 pt-[max(1.25rem,env(safe-area-inset-top))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          onClick={onKeepShopping}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="av-exit-store-title"
            aria-describedby="av-exit-store-desc"
            className="relative w-full max-w-[560px] self-start rounded-[1.35rem] border p-5 sm:p-6"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
              WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.4)',
              backdropFilter: 'blur(var(--glass-blur)) saturate(1.4)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.12), 0 24px 90px rgba(0,0,0,0.55)',
            }}
            {...cardMotion}
            transition={{ duration: 0.22, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Keep shopping"
              onClick={onKeepShopping}
              /* 44px hit area for touch; inner span keeps the 28px visual circle */
              className="group absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-white/20 text-white/90 transition-colors group-hover:bg-white/10">
                <X className="h-3.5 w-3.5" />
              </span>
            </button>

            <h2
              id="av-exit-store-title"
              className="pr-8 font-heading text-[1.75rem] uppercase leading-none tracking-[0.02em] text-foreground"
            >
              Exit the store?
            </h2>
            <p id="av-exit-store-desc" className="mt-2 text-sm leading-snug text-foreground/70">
              Your selections won&rsquo;t be saved.
            </p>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
              <motion.button
                ref={keepRef}
                type="button"
                onClick={onKeepShopping}
                whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                whileTap={reduceMotion ? undefined : { scale: 0.975 }}
                transition={{ duration: 0.18, ease: EASE }}
                /* solid white pill via inline style — the app globally neutralizes raw `bg-white`,
                   and this card is always dark glass, so we want true white in every theme */
                style={{ background: '#ffffff', color: '#16110d' }}
                className="flex-1 rounded-full px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Keep shopping
              </motion.button>
              <motion.button
                type="button"
                onClick={onExit}
                whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                whileTap={reduceMotion ? undefined : { scale: 0.975 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="flex-1 rounded-full border border-white/28 bg-transparent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Exit
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
