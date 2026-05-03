import React from 'react';
import { Shield, UserCheck, Stethoscope, MapPin, Clock } from 'lucide-react';

// Vertical-agnostic trust signals. Keep FDA-safe — no structure/function claims.
// Credentials framed as operational standards, not therapeutic guarantees.
const CREDENTIALS = [
  { icon: UserCheck,   label: 'RN-administered' },
  { icon: Stethoscope, label: 'MD-supervised' },
  { icon: Shield,      label: 'HIPAA-secure' },
  { icon: MapPin,      label: 'SF Bay coverage' },
  { icon: Clock,       label: 'Rapid response' },
];

// Render the row twice so the translate-(-50%) loop wraps seamlessly.
const Row = ({ ariaHidden = false }) => (
  <ul
    aria-hidden={ariaHidden}
    className="flex items-center shrink-0 gap-0"
  >
    {CREDENTIALS.map((item, i) => {
      const Icon = item.icon;
      return (
        <li key={`${ariaHidden ? 'b' : 'a'}-${item.label}`} className="flex items-center">
          {i > 0 && (
            <span className="mx-5 md:mx-7 w-1 h-1 rounded-full bg-border shrink-0" aria-hidden="true" />
          )}
          <span className="flex items-center gap-2.5 whitespace-nowrap">
            <Icon
              className="w-3.5 h-3.5 text-accent shrink-0"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span className="font-body text-xs tracking-[0.3em] uppercase text-muted-foreground">
              {item.label}
            </span>
          </span>
        </li>
      );
    })}
    {/* trailing separator dot before the row repeats, so the loop feels continuous */}
    <span className="mx-5 md:mx-7 w-1 h-1 rounded-full bg-border shrink-0" aria-hidden="true" />
  </ul>
);

export default function TrustStrip() {
  return (
    <section
      aria-label="Operational standards"
      className="bg-background overflow-hidden"
    >
      <div className="trust-strip-wrap py-4 md:py-5">
        <div className="trust-strip-track flex items-center w-max">
          <Row />
          <Row ariaHidden />
        </div>
      </div>
      <style>{`
        .trust-strip-wrap {
          /* Mask edges so items fade in/out at the boundaries — luxe touch */
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 5%, #000 95%, transparent 100%);
                  mask-image: linear-gradient(to right, transparent 0, #000 5%, #000 95%, transparent 100%);
        }
        .trust-strip-track {
          animation: trust-strip-scroll 38s linear infinite;
          will-change: transform;
        }
        @keyframes trust-strip-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        /* Pause on hover (desktop) and on focus-within (keyboard) for accessibility */
        @media (hover: hover) {
          .trust-strip-wrap:hover .trust-strip-track { animation-play-state: paused; }
        }
        .trust-strip-wrap:focus-within .trust-strip-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .trust-strip-track { animation: none; transform: none; }
        }
      `}</style>
    </section>
  );
}
