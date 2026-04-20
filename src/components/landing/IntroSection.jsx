import React from 'react';
import { motion } from 'framer-motion';

export default function IntroSection() {
  return (
    <section className="py-20 md:py-28 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4">The Foundation</p>
          <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide mb-8">IV THERAPY IS THE BASE</h2>
          <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed mb-6">
            We started with IV therapy because it's the most direct, science-backed way to deliver nutrients at 100% absorption. It's the bedrock every other modality builds on.
          </p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            From that foundation, we're building Avalon into a full-stack recovery platform — adding verticals like NAD+, Exosomes, Peptides, HRT, Recovery Devices, and beyond. Each new modality layers on top of our mobile IV infrastructure, delivered to you by licensed clinicians wherever you are.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {['IV Vitamins', 'NAD+', 'Exosomes', 'CBD', 'Peptides →', 'HRT →', 'Genetic Testing →'].map((v, i) => (
              <span
                key={v}
                className={`px-4 py-1.5 rounded border font-body text-[10px] tracking-widest uppercase ${i < 4 ? 'border-foreground/30 text-foreground' : 'border-border text-muted-foreground/40'}`}
              >
                {v}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}