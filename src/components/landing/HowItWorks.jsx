import React from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, MapPin, Zap } from 'lucide-react';

const BOOK_URL = 'https://avalonvitality.as.me/schedule/a9d85b1e';

const steps = [
  {
    icon: CalendarCheck,
    title: 'Book online or by phone',
    desc: 'Reserve your treatment in minutes — online or via text.',
  },
  {
    icon: MapPin,
    title: 'We Come to You',
    desc: 'Our nurse arrives at your home, hotel, office, or event — fully equipped.',
  },
  {
    icon: Zap,
    title: 'Recover Fast',
    desc: 'Feel refreshed within 30–60 minutes of your infusion.',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 md:py-28 px-4 bg-secondary/40">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide">HOW IT WORKS</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center p-8 border border-border rounded bg-card"
            >
              <step.icon className="w-8 h-8 text-accent mx-auto mb-5" strokeWidth={1.5} />
              <h3 className="font-heading text-2xl md:text-3xl text-foreground mb-3 tracking-wide">{step.title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a
            href={BOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-4 bg-foreground text-background font-body text-sm tracking-widest uppercase font-semibold hover:bg-foreground/90 transition-colors rounded"
          >
            Start Your Recovery
          </a>
        </div>
      </div>
    </section>
  );
}