import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { EASE } from '@/lib/motion';

const POINTS = [
  {
    label: 'CBD + NAD+',
    body: 'Specialty protocols are available only when clinically appropriate and approved by the care team.',
  },
  {
    label: 'Transparent Pricing',
    body: 'No hidden fees. No surprise service charges. Clear pricing before care begins.',
  },
  {
    label: 'Custom Subscriptions',
    body: 'Build a cadence around your actual recovery rhythm, not a rigid package.',
  },
  {
    label: 'White-Glove Service',
    body: 'Home, hotel, office, event, or private venue. Licensed care brought wherever you are.',
  },
];

export default function ComparisonTable() {
  return (
    <section className="px-4 py-10 md:py-16">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: EASE }}
          className="mb-8 md:mb-10"
        >
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">Why Avalon</p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            What Others Miss
          </h2>
          <p className="font-body text-sm text-foreground/55 leading-relaxed mt-3 max-w-xl">
            Specialty protocols, clean pricing, flexible subscriptions, and service
            that meets you where you are. Final care is subject to clinical approval.
          </p>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((point, index) => (
            <motion.div
              key={point.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-24px' }}
              transition={{ duration: 0.65, delay: index * 0.04, ease: EASE }}
              className="flex min-h-[13rem] flex-col rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5 md:p-6"
            >
              <div className="mb-8 flex items-start justify-between gap-4">
                <p className="max-w-[11rem] font-heading text-3xl leading-none text-foreground md:text-[2.35rem]">
                  {point.label}
                </p>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-background">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </div>
              </div>
              <p className="mt-auto font-body text-sm leading-relaxed text-foreground/58">
                {point.body}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
