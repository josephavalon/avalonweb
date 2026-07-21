import React from 'react';
import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from '@/components/ui/PageTransitionMotion';
import { useAuthStore } from '@/lib/useAuthStore';

const EASE = [0.16, 1, 0.3, 1];

// Non-blocking inactivity banner. The auth store exposes `idleWarning` ~60s
// before the HIPAA idle auto-logoff (15 min); clicking "Stay signed in" resets
// the idle clock via dismissIdleWarning(). Only renders while signed in AND
// inside the warning window — it's a no-op otherwise. Mounted once in App.jsx.
export default function IdleWarning() {
  const { user, idleWarning, dismissIdleWarning } = useAuthStore();
  const show = Boolean(user && idleWarning);
  const secondsLeft = idleWarning?.secondsLeft ?? 0;

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="idle-warning"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: EASE }}
          role="alertdialog"
          aria-live="assertive"
          aria-label="Inactivity sign-out warning"
          className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] mx-auto flex max-w-md flex-col gap-3 rounded-2xl border border-foreground/[0.14] bg-background/92 p-4 text-foreground shadow-[0_22px_90px_hsl(var(--foreground)/0.16)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/[0.14] bg-foreground/[0.05] text-foreground/72">
              <Clock className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div>
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">
                Still there?
              </p>
              <p className="mt-1 font-body text-sm font-medium leading-relaxed text-foreground/80">
                You&rsquo;ll be signed out for inactivity in {secondsLeft}s.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissIdleWarning}
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-full bg-foreground px-5 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-background transition-colors hover:bg-foreground/88"
          >
            Stay signed in
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
