import React from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, ClipboardCheck, UserCheck } from 'lucide-react';

// Clinical gravitas section. Surfaces a named Medical Director + Avalon's
// Protocol-as-clinical-instrument claim. FDA-safe: no structure/function
// claims. Frames methodology and oversight, not outcomes.
//
// Now rendered as a standalone page at /medical-direction (linked from Footer).
// Kept as an exportable component so it can be embedded elsewhere if needed.
const MEDICAL_DIRECTOR = {
  name: 'Dr. Jayson Weir',
  credentials: 'MD — Internal Medicine',
  title: 'Medical Director',
  bio: 'An internist with more than a decade of hospital and concierge practice, Dr. Weir oversees clinical standards across every Avalon Protocol. He reviews every formulation, signs off on every new modality before it reaches a member, and owns every clinical escalation from the field.',
};

const PILLARS = [
  {
    icon: ClipboardCheck,
    title: 'Protocols, not menus',
    desc: 'Every Avalon Protocol — from NAD+ titration to peptide sequencing — is designed in-house and reviewed monthly. Protocols are clinical instruments, not bags on a list.',
  },
  {
    icon: UserCheck,
    title: 'One care team, every modality',
    desc: 'Your nurse, your clinician, and your record stay the same as new modalities come online. No re-onboarding. No fragmented history.',
  },
  {
    icon: Stethoscope,
    title: 'Reviewed continuously',
    desc: 'Protocols are audited each quarter against current clinical literature. Members are notified when their Protocol changes and why.',
  },
];

const EASE = [0.16, 1, 0.3, 1];

export default function ClinicalOversight() {
  return (
    <section
      id="clinical-oversight"
      aria-label="Medical oversight and clinical methodology"
      className="scroll-mt-24 py-8 md:py-12 px-4 border-t border-border"
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE }}
          className="text-left mb-8 md:mb-12"
        >
          <p className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4">
            Clinical Oversight
          </p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide md:whitespace-nowrap">
            MEDICAL DIRECTION
          </h2>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mt-4">
            Every Protocol at Avalon is designed, reviewed, and renewed under our Medical Director, Dr. Jayson Weir.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6 items-start">
          {/* Medical Director card — full-height on md+, anchors the section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            className="border border-foreground/25 rounded-3xl bg-card p-6 md:p-8 flex flex-col"
          >
            <p className="font-body text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
              {MEDICAL_DIRECTOR.title}
            </p>
            <h3 className="font-heading text-2xl md:text-3xl text-foreground tracking-wide mb-1 leading-tight">
              {MEDICAL_DIRECTOR.name}
            </h3>
            <p className="font-body text-[11px] tracking-[0.25em] uppercase text-accent mb-5">
              {MEDICAL_DIRECTOR.credentials}
            </p>
            <p className="font-body text-sm text-foreground/85 leading-relaxed">
              {MEDICAL_DIRECTOR.bio}
            </p>
          </motion.div>

          {/* Clinical pillars — stacked cards spanning two columns on md+ */}
          <div className="md:col-span-2 grid gap-3 md:gap-4">
            {PILLARS.map((pillar, i) => {
              const PillarIcon = pillar.icon;
              return (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.15 + i * 0.1, ease: EASE }}
                  className="border border-border rounded-3xl bg-card/40 p-5 md:p-6 flex gap-4 items-start"
                >
                  <PillarIcon
                    className="w-5 h-5 text-accent shrink-0 mt-1"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <div>
                    <h4 className="font-heading text-lg md:text-xl text-foreground tracking-wide mb-1">
                      {pillar.title}
                    </h4>
                    <p className="font-body text-sm text-muted-foreground leading-relaxed">
                      {pillar.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
