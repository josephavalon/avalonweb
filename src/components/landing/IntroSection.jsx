import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Stethoscope, HeartHandshake } from 'lucide-react';

const features = [
  {
    icon: ShieldCheck,
    title: 'Medical-grade formulas',
    description: 'Hospital-grade IV drips compounded by licensed pharmacies, administered by registered nurses, and formulated for maximum bioavailability.'
  },
  {
    icon: Stethoscope,
    title: 'Clinical guidance',
    description: 'Access physician-designed IV protocols, continuously refined to support your evolving health and wellness goals.'
  },
  {
    icon: HeartHandshake,
    title: 'Concierge care',
    description: 'White-glove service from booking to infusion. Personalized support and direct access to your care team whenever you need it.'
  }
];

export default function IntroSection() {
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
          <p className="text-xs tracking-[0.3em] text-primary font-body uppercase mb-4">A Protocol. Not a Trend.</p>
          <h2 className="font-heading text-3xl md:text-5xl text-foreground mb-6">
            What is The Infusion?
          </h2>
          <p className="font-body text-muted-foreground max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            The Infusion is a premium mobile IV therapy service delivering clinical-grade hydration, vitamins, and nutrients directly to your home, office, or hotel — administered by licensed registered nurses.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="text-center px-4"
            >
              <feature.icon className="w-8 h-8 text-primary mx-auto mb-5" strokeWidth={1.5} />
              <h3 className="font-heading text-lg text-foreground mb-3">{feature.title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="text-xs tracking-[0.2em] text-muted-foreground font-body uppercase">
            Start today without any commitment.
          </p>
          <p className="text-xs tracking-[0.2em] text-primary font-body uppercase mt-2">
            Continue your access for just $49/month.
          </p>
          <a href="#membership" className="inline-block mt-6 text-xs tracking-[0.2em] text-foreground underline underline-offset-4 decoration-primary font-body hover:text-primary transition-colors">
            See Membership Plan
          </a>
        </div>
      </div>
    </section>
  );
}