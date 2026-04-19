import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Shield, Activity } from 'lucide-react';

const drips = [
  {
    name: 'Radiance',
    subtitle: 'Beauty + Anti-Aging',
    description: 'For glowing skin, collagen support, hair & nail health, and a youthful complexion.',
    tags: ['Glow', 'Restore', 'Rejuvenate'],
    icon: Sparkles,
    image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&q=80',
  },
  {
    name: 'Vitality',
    subtitle: 'Energy + Performance',
    description: 'For sustained energy, mental clarity, pre/post-workout optimization, and peak performance.',
    tags: ['Energize', 'Focus', 'Excel'],
    icon: Zap,
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
  },
  {
    name: 'Immunity',
    subtitle: 'Defense + Recovery',
    description: 'For immune support, cold & flu recovery, travel prep, and detoxification.',
    tags: ['Protect', 'Defend', 'Recover'],
    icon: Shield,
    image: 'https://images.unsplash.com/photo-1505576399279-0d754c0d8e7e?w=800&q=80',
  },
  {
    name: 'Revival',
    subtitle: 'Hydration + Hangover',
    description: 'For rapid rehydration, hangover relief, jet lag recovery, and migraine support.',
    tags: ['Hydrate', 'Rebuild', 'Refresh'],
    icon: Activity,
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
  },
];

export default function OurDrips() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-6"
        >
          <h2 className="font-heading text-3xl md:text-4xl text-foreground mb-4">
            Our Drips
          </h2>
          <p className="font-body text-sm text-muted-foreground max-w-lg mx-auto">
            Clinician-curated IV protocols designed by physicians, reviewed for safety, and optimized to support your goals.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mt-16">
          {drips.map((drip, i) => (
            <motion.div
              key={drip.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="group relative rounded-2xl overflow-hidden border border-border bg-card hover:border-primary/30 transition-all duration-500"
            >
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src={drip.image}
                  alt={drip.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <drip.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                  <h3 className="font-heading text-xl text-foreground">{drip.name}</h3>
                </div>
                <p className="text-xs tracking-[0.1em] text-primary font-body uppercase mb-2">{drip.subtitle}</p>
                <p className="font-body text-xs text-muted-foreground leading-relaxed mb-4">{drip.description}</p>
                <div className="flex flex-wrap gap-2">
                  {drip.tags.map((tag) => (
                    <span key={tag} className="text-[10px] tracking-[0.1em] text-primary/80 font-body">{tag}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-12"
        >
          <a
            href="#membership"
            className="inline-block px-8 py-3 bg-foreground text-background rounded-full text-xs tracking-[0.15em] font-body uppercase hover:bg-foreground/90 transition-colors"
          >
            Book Your Drip
          </a>
        </motion.div>
      </div>
    </section>
  );
}