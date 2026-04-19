import React from 'react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    quote: "I was completely wiped after a red-eye flight. The nurse arrived at my hotel in 45 minutes. Within an hour of the IV, I felt like a completely different person — hydrated, energized, and ready for my meetings.",
    name: "A.R.",
    drip: "Revival Drip"
  },
  {
    quote: "I used to lose entire weekends recovering from Friday nights. Now I book a Saturday morning session and I'm back to 100% by lunch. It's genuinely life-changing.",
    name: "M.T.",
    drip: "Revival Drip"
  },
  {
    quote: "My skin has never looked better. After four Radiance sessions, my esthetician asked me what I changed. The glow is real — and it comes from within.",
    name: "J.L.",
    drip: "Radiance Drip"
  },
  {
    quote: "As a competitive CrossFit athlete, recovery is everything. The Vitality drip has cut my recovery time in half. I'm hitting PRs I haven't seen in years.",
    name: "K.D.",
    drip: "Vitality Drip"
  },
  {
    quote: "I was getting sick every other month. Since starting monthly Immunity drips, I haven't been down once in six months. My whole family is on it now.",
    name: "S.P.",
    drip: "Immunity Drip"
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 md:py-32 px-6 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl text-foreground">
            Not reviews. True reactions.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="border border-border rounded-2xl p-6 md:p-8 bg-card"
            >
              <p className="font-body text-sm text-foreground/80 leading-relaxed mb-6 italic">
                "{t.quote}"
              </p>
              <div className="flex items-center justify-between">
                <span className="font-heading text-sm text-foreground">{t.name}</span>
                <span className="text-[10px] tracking-[0.15em] text-primary font-body uppercase">{t.drip}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}