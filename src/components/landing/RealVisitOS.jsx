import React, { useMemo } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import ConsumerTruthLayer from '@/components/consumer/ConsumerTruthLayer';
import { buildConsumerTruthLayer } from '@/lib/consumerTruth';
import { EASE } from '@/lib/motion';

export default function RealVisitOS() {
  const truth = useMemo(() => buildConsumerTruthLayer(), []);

  return (
    <section id="real-visit-os" className="px-4 py-10 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mx-auto max-w-6xl"
      >
        <ConsumerTruthLayer
          truth={truth}
          eyebrow="Live Status"
          title="Know What Is Next"
          intro="Your hold, clearance, nurse assignment, ETA, and follow-up stay visible. No guessing."
          compact
          limit={4}
          showGroups={false}
        />
      </motion.div>
    </section>
  );
}
