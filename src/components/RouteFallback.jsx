import React from 'react';

/**
 * Suspense fallback shown while a lazy route chunk is fetching.
 * Never use a fixed full-screen black overlay here; route HTML may have
 * already painted, and covering it reads like the page unloaded.
 */
export default function RouteFallback() {
  return (
    <div
      className="min-h-[100svh] bg-background px-4 py-6"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="mx-auto flex min-h-[70svh] w-full max-w-6xl flex-col justify-between animate-in fade-in slide-in-from-bottom-2 duration-base">
        <div>
          <p className="font-heading text-2xl tracking-[0.18em] text-foreground">AVALON</p>
          <p className="-mt-1 font-body text-[10px] uppercase tracking-[0.36em] text-foreground/60">Vitality</p>
        </div>

        <div className="max-w-xl">
          <div className="av-premium-shimmer mb-5 h-3 w-24 rounded-full bg-foreground/20" />
          <div className="space-y-3">
            <div className="av-premium-shimmer h-12 w-full rounded-xl border border-foreground/10 bg-foreground/[0.08]" />
            <div className="av-premium-shimmer h-12 w-[78%] rounded-xl border border-foreground/10 bg-foreground/[0.06]" />
            <div className="av-premium-shimmer h-12 w-[52%] rounded-xl border border-foreground/10 bg-foreground/[0.045]" />
          </div>
        </div>

        <div className="h-px w-full bg-foreground/10" />
      </div>
    </div>
  );
}
