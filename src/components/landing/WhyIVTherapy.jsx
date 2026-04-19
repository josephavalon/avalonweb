import React from 'react';
import { motion } from 'framer-motion';

export default function WhyIVTherapy() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="order-2 md:order-1"
        >
          <h2 className="font-heading text-3xl md:text-4xl text-foreground mb-8">
            Why is IV therapy important for me?
          </h2>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-6">
            Modern life depletes you faster than you realize. Stress, travel, intense workouts, late nights, and even daily exposure to toxins drain essential nutrients your body depends on.
          </p>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-8">
            IV therapy works with your body's natural systems, replenishing what's lost and optimizing your biology from the inside out — faster and more effectively than any pill or drink.
          </p>

          <div className="flex flex-wrap gap-3">
            {['Hydrate', 'Recover', 'Perform'].map((tag) => (
              <span key={tag} className="px-4 py-2 border border-border rounded-full text-xs tracking-[0.1em] text-primary font-body">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="order-1 md:order-2"
        >
          <div className="aspect-[3/4] rounded-2xl overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80"
              alt="Wellness and recovery"
              className="w-full h-full object-cover"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}