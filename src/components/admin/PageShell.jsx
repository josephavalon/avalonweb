// ── Avalon Vitality — AdminPageShell ────────────────────────────────────────
// Consistent page header for all admin/provider pages.
// Eliminates per-page header duplication across Dashboard, Appointments,
// Invoicing, Nurses, and future admin pages.
//
// Props:
//   eyebrow   {string}         — small label above title (e.g. "Provider Portal")
//   title     {string}         — main page heading (Bebas Neue)
//   subtitle  {string?}        — optional descriptor below title
//   action    {React.ReactNode} — optional slot for top-right button/chip
//   children  {React.ReactNode} — page body content

import React, { useEffect } from 'react';

export default function PageShell({ eyebrow, title, subtitle, action, children, embedded = false }) {
  useEffect(() => {
    if (!title || typeof document === 'undefined') return;
    document.title = `${title} - Avalon OS`;
  }, [title]);

  // Embedded: the page already sits inside AdminShell, which owns the big title
  // + corner logo. Drop the duplicate heading; keep just a slim subtitle and the
  // action toolbar above the body.
  if (embedded) {
    return (
      <div className="text-foreground">
        {(subtitle || action) && (
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {subtitle
              ? <p className="font-body text-[12px] text-foreground/45">{subtitle}</p>
              : <span className="hidden md:block" />}
            {action ? <div className="w-full flex-shrink-0 md:w-auto">{action}</div> : null}
          </div>
        )}
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-reveal">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="av-page-surface min-h-screen text-foreground">

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="av-motion-rail mb-5 flex flex-col gap-4 rounded-[1.75rem] border border-foreground/[0.10] bg-background/68 px-5 py-5 shadow-[0_24px_90px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-reveal md:flex-row md:items-start md:justify-between md:px-6 md:py-6">
        <div>
          {eyebrow && (
            <p
              className="font-body text-[10px] tracking-[0.3em] uppercase mb-1"
              style={{ color: 'hsl(var(--foreground) / 0.35)' }}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className="font-heading text-4xl uppercase tracking-tight leading-[0.88] md:text-6xl md:whitespace-nowrap"
            style={{ color: 'hsl(var(--foreground))' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="font-body text-[11px] mt-1"
              style={{ color: 'hsl(var(--foreground) / 0.45)' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {action && (
          <div className="w-full flex-shrink-0 md:mt-1 md:w-auto">
            {action}
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-reveal">
        {children}
      </div>

    </div>
  );
}
