import React from 'react';
import { Shield, UserCheck, Stethoscope, Clock, FlaskConical, Lock } from 'lucide-react';

// Vertical-agnostic trust signals. Keep FDA-safe — no structure/function claims.
// Credentials framed as operational standards, not therapeutic guarantees.
// Styled editorial (foreground/55, no accent) — not a UI element, a spec sheet.
const CREDENTIALS = [
  { icon: UserCheck,    label: 'Licensed Registered Nurses' },
  { icon: Clock,        label: 'Arrives in 60–90 min'       },
  { icon: Lock,         label: 'Secure Intake'              },
  { icon: FlaskConical, label: 'Lab-Grade Formulations'     },
  { icon: Stethoscope,  label: 'Clinical Oversight'         },
  { icon: Shield,       label: 'HIPAA-Secure'               },
];

const Dot = () => (
  <span
    aria-hidden="true"
    className="w-[3px] h-[3px] rounded-full bg-foreground/20 shrink-0 inline-block"
  />
);

const Item = ({ icon: Icon, label }) => (
  <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
    <Icon
      className="w-3 h-3 text-foreground/35 shrink-0"
      strokeWidth={1.5}
      aria-hidden="true"
    />
    <span className="font-body text-[10px] md:text-[11px] tracking-[0.28em] md:tracking-[0.32em] uppercase text-foreground/55">
      {label}
    </span>
  </span>
);

// One row of all credentials separated by dots, plus a trailing dot before
// the row repeats, so the seamless loop feels continuous.
const Row = ({ ariaHidden = false }) => (
  <ul
    aria-hidden={ariaHidden}
    className="flex items-center gap-4 md:gap-7 shrink-0 list-none m-0 p-0"
  >
    {CREDENTIALS.map((item, i) => (
      <React.Fragment key={`${ariaHidden ? 'b' : 'a'}-${item.label}`}>
        {i > 0 && <Dot />}
        <li className="flex items-center"><Item icon={item.icon} label={item.label} /></li>
      </React.Fragment>
    ))}
    <Dot />
  </ul>
);

export default function TrustStrip() {
  return (
    <section
      aria-label="Operational standards"
      className="bg-background overflow-hidden"
    >
      <div className="trust-strip-wrap py-4 md:py-5">
        <div className="trust-strip-track">
          <Row />
          <Row ariaHidden />
        </div>
      </div>
      <style>{`
        .trust-strip-wrap {
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%);
                  mask-image: linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%);
        }
        .trust-strip-track {
          display: flex;
          align-items: center;
          width: max-content;
          flex-wrap: nowrap;
          gap: 1rem;                       /* gap between the two duplicated rows = same as gap inside row, so loop is seamless */
          animation: trust-strip-scroll 18s linear infinite;
          will-change: transform;
        }
        @media (min-width: 768px) {
          .trust-strip-track {
            gap: 1.75rem;                  /* tablet+ gap matches md:gap-7 */
            animation-duration: 24s;
          }
        }
        @keyframes trust-strip-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
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
