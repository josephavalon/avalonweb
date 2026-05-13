/**
 * Custom editorial SVG icons for Avalon Vitality protocol cards.
 * Line-weight: 1.5px stroke, no fill, foreground color via currentColor.
 * Style: precise medical-instrument aesthetic — not Lucide defaults.
 */

const BASE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };

/** IV Drip bag — the core service icon */
export function IVBagIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      {/* Bag body */}
      <path d="M7 8C7 5.79 8.79 4 11 4h2c2.21 0 4 1.79 4 4v7c0 2.21-1.79 4-4 4h-2c-2.21 0-4-1.79-4-4V8z" />
      {/* Drip line */}
      <line x1="12" y1="15" x2="12" y2="20" />
      {/* Needle cap */}
      <line x1="10" y1="20" x2="14" y2="20" />
      {/* Hanger hook */}
      <path d="M12 4V2.5" />
      <path d="M10.5 2.5C10.5 1.67 11.17 1 12 1s1.5.67 1.5 1.5" />
      {/* Fill level indicator */}
      <line x1="9" y1="11" x2="15" y2="11" strokeOpacity="0.4" />
    </svg>
  );
}

/** Hydration / water drop — Hydration & Hangover */
export function HydrationIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      <path d="M12 3C12 3 5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-7-12-7-12z" />
      <path d="M9 15.5a3 3 0 0 0 3 2.5" strokeOpacity="0.5" />
    </svg>
  );
}

/** Lightning bolt — Energy / Myers Cocktail / Athletic */
export function EnergyIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/** Shield with cross — Immune Boost */
export function ImmuneIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      <path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.4C16.5 21.15 20 16.25 20 11V5l-8-3z" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

/** Sparkle / star cluster — Beauty & Glow */
export function GlowIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      {/* Large star */}
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      {/* Center dot */}
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/** Airplane — Jet Lag / Travel */
export function JetLagIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 12 2a1.5 1.5 0 0 0-1.5 1.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

/** Molecule / hexagon — NAD+ */
export function NADIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      {/* Hexagon */}
      <polygon points="12 2 20 7 20 17 12 22 4 17 4 7" />
      {/* Inner cross */}
      <line x1="12" y1="7" x2="12" y2="17" strokeOpacity="0.5" />
      <line x1="7" y1="9.5" x2="17" y2="14.5" strokeOpacity="0.5" />
      <line x1="17" y1="9.5" x2="7" y2="14.5" strokeOpacity="0.5" />
      {/* Center */}
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}

/** Syringe — IM Shot generic */
export function SyringeIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      {/* Barrel */}
      <rect x="7" y="6" width="10" height="12" rx="1" />
      {/* Plunger */}
      <line x1="12" y1="3" x2="12" y2="6" />
      <line x1="10" y1="3" x2="14" y2="3" />
      {/* Needle */}
      <line x1="12" y1="18" x2="12" y2="21" />
      {/* Fill line */}
      <line x1="9" y1="13" x2="15" y2="13" strokeOpacity="0.4" />
      {/* Barrel ticks */}
      <line x1="9" y1="10" x2="11" y2="10" strokeOpacity="0.4" />
      <line x1="9" y1="12" x2="11" y2="12" strokeOpacity="0.4" />
      <line x1="9" y1="14" x2="11" y2="14" strokeOpacity="0.4" />
    </svg>
  );
}

/** Heart rate / pulse — Wellness / Vitality */
export function VitalityIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      <polyline points="2 12 6 12 8 6 11 18 13 8 15 14 17 12 22 12" />
    </svg>
  );
}

/** Moon — Recharge / Recovery */
export function RechargeIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} {...BASE}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
