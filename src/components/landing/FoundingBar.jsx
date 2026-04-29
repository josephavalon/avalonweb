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
    <div className="fixed top-0 inset-x-0 z-[55] bg-foreground text-background pointer-events-none">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3 pointer-events-auto">
        <Link
          to="/apply"
          className="font-body text-[11px] md:text-xs tracking-[0.25em] uppercase font-semibold hover:opacity-80 transition-opacity"
        >
          <span className="text-accent">{CLAIMED}</span> / 100 Founding spots claimed · <span className="underline underline-offset-4 decoration-accent">Claim yours</span>
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
