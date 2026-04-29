import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

// Sticky top urgency bar — Founding 100 cohort counter.
// Shows "47 of 100 Founding spots claimed" + Apply link. Dismissible per session.
const CLAIMED = 47; // bump this manually as members join until member portal ships

export default function FoundingBar() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('founding-bar-dismissed') === '1') setOpen(false);
  }, []);
  if (!open) return null;
  const dismiss = () => {
    setOpen(false);
    try { sessionStorage.setItem('founding-bar-dismissed', '1'); } catch (_) {}
  };
  return (
    <div className="founding-bar-shell fixed top-0 inset-x-0 z-[55] bg-foreground text-background pointer-events-none">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3 pointer-events-auto">
        <Link
          to="/apply"
          className="flex-1 flex items-center gap-3 md:gap-4 font-body text-[11px] md:text-xs tracking-[0.25em] uppercase font-semibold hover:opacity-80 transition-opacity"
        >
          <span className="shrink-0">
            <span className="text-accent">{CLAIMED}</span> / 100 Founding
          </span>
          <span className="flex-1 h-[3px] bg-background/20 rounded-full overflow-hidden max-w-[200px] md:max-w-[300px]">
            <span
              className="block h-full bg-accent rounded-full origin-left"
              style={{
                transform: `scaleX(${CLAIMED / 100})`,
                transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </span>
          <span className="shrink-0 hidden sm:inline underline underline-offset-4 decoration-accent">Claim yours</span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
