import React from 'react';
import { motion } from 'framer-motion';
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

export default function TrustStrip() {
  return (
    <section
      aria-label="Operational standards"
      className="bg-background"
    >
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-6xl mx-auto px-4 py-4 md:py-5"
      >
        {/* Desktop: single row, centered with separator dots */}
        <ul className="hidden md:flex items-center justify-center gap-0 flex-wrap">
          {CREDENTIALS.map((item, i) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex items-center">
                {i > 0 && (
                  <span className="mx-5 w-1 h-1 rounded-full bg-border" aria-hidden="true" />
                )}
                <span className="flex items-center gap-2.5">
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
        </ul>

        {/* Mobile: horizontal scroll, edge-faded, no scrollbar */}
        <div
          className="md:hidden overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <ul className="flex items-center gap-0 w-max px-2">
            {CREDENTIALS.map((item, i) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="flex items-center">
                  {i > 0 && (
                    <span className="mx-4 w-1 h-1 rounded-full bg-border shrink-0" aria-hidden="true" />
                  )}
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <Icon
                      className="w-3.5 h-3.5 text-accent shrink-0"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span className="font-body text-xs tracking-[0.25em] uppercase text-muted-foreground">
                      {item.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </motion.div>
      <style>{`section[aria-label="Operational standards"] div::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}
