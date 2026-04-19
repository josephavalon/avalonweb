import React from 'react';
import { motion } from 'framer-motion';

export default function WhatAreIVs() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="aspect-[3/4] rounded-2xl overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&q=80"
              alt="IV drip close-up"
              className="w-full h-full object-cover"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="font-heading text-3xl md:text-4xl text-foreground mb-8">
            What is IV Therapy?
          </h2>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-6">
            Intravenous (IV) therapy delivers essential vitamins, minerals, and hydration directly into your bloodstream — bypassing the digestive system for up to 100% absorption.
          </p>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-8">
            Unlike oral supplements that lose potency through digestion, IV drips provide immediate, full-strength delivery of nutrients your body needs to perform, recover, and thrive.
          </p>

          <div className="flex flex-wrap gap-3">
            {['100% Absorption', 'Immediate Results', 'Nurse-Administered'].map((tag) => (
              <span key={tag} className="px-4 py-2 border border-border rounded-full text-xs tracking-[0.1em] text-primary font-body">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}