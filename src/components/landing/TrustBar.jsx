import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, UserCheck, Lock, MapPin } from 'lucide-react';
import { EASE } from '@/lib/motion';

const SIGNALS = [
  { icon: UserCheck,  label: 'Licensed RNs',      sub: 'California-registered nurses' },
  { icon: ShieldCheck,label: 'MD Supervised',      sub: 'Every visit physician-reviewed' },
  { icon: Lock,       label: 'HIPAA Compliant',    sub: 'Your data stays private' },
  { icon: MapPin,     label: 'Same-Day SF Bay Area', sub: 'Home · Hotel · Office · Event' },
];

export default function TrustBar() {
  return (
    <section aria-label="Trust signals" className="px-4 py-4 md:py-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-16px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="grid grid-cols-2 md:grid-cols-4 gap-2"
        >
          {SIGNALS.map(({ icon: Icon, label, sub }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-foreground/[0.07] bg-white/[0.04]"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-foreground/[0.08] flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="font-body text-[11px] font-semibold text-foreground/90 leading-none truncate">{label}</p>
                <p className="font-body text-[9px] text-foreground/40 mt-0.5 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
