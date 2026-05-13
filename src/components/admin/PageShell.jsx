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

import React from 'react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

export default function PageShell({ eyebrow, title, subtitle, action, children }) {
  return (
    <div className="min-h-screen bg-[#0a0a08]">

      {/* ── Page header ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="px-4 md:px-6 pt-5 pb-4 border-b border-white/[0.06] flex items-start justify-between gap-4"
      >
        <div>
          {eyebrow && (
            <p
              className="font-body text-[10px] tracking-[0.3em] uppercase mb-1"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className="font-heading text-3xl md:text-4xl uppercase tracking-wide leading-none"
            style={{ color: '#F0EDE4' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="font-body text-[11px] mt-1"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {action && (
          <div className="flex-shrink-0 mt-1">
            {action}
          </div>
        )}
      </motion.div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 py-5">
        {children}
      </div>

    </div>
  );
}
