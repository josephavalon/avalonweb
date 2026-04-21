import React from 'react';
import { motion } from 'framer-motion';

export default function PremiumFeatureCards({ features, actionButton }) {
  return (
    <section className="py-16 px-4 md:px-16">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm p-8 md:p-12 border border-white/20">
          {/* Cards grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="rounded-2xl border border-white/30 backdrop-blur-sm p-8 bg-white/5 hover:border-white/50 transition-colors"
              >
                <div className="inline-block border border-white/40 rounded-full px-4 py-1.5 mb-6">
                  <p className="font-body text-xs tracking-widest uppercase text-foreground/80">
                    {feature.badge}
                  </p>
                </div>
                <h3 className="font-heading text-2xl md:text-3xl text-foreground mb-4 tracking-wide">
                  {feature.title}
                </h3>
                <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Action button */}
          {actionButton && (
            <motion.a
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              href={actionButton.href}
              className="inline-block bg-foreground text-background font-body text-sm tracking-widest uppercase font-semibold rounded-full px-8 py-3 hover:bg-foreground/90 transition-colors"
            >
              {actionButton.label}
            </motion.a>
          )}
        </div>
      </div>
    </section>
  );
}