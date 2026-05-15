import React from 'react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

const STEPS = [
  { n: '01', title: 'Build your visit',   desc: 'Choose your drip, drop your location, pick a time.' },
  { n: '02', title: 'Get confirmed',      desc: 'We lock your arrival window and send RN details.' },
  { n: '03', title: 'RN comes to you',    desc: 'A licensed RN arrives to your home, hotel, or office.' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="pt-10 pb-6 md:pt-14 md:pb-10 px-4 scroll-mt-20">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-6 md:mb-10"
        >
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">The Process</p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            HOW AVALON WORKS
          </h2>
          <div className="w-10 h-[2px] bg-accent mt-3" />
        </motion.div>

        <div className="space-y-0 rounded-3xl border border-foreground/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
              className={`flex items-start gap-4 px-6 py-5 ${i < STEPS.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
            >
              <span className="font-body text-[10px] tracking-[0.25em] text-accent/50 w-6 shrink-0 pt-0.5">{step.n}</span>
              <div>
                <p className="font-heading text-xl uppercase text-foreground leading-tight">{step.title}</p>
                <p className="font-body text-xs text-foreground/50 leading-relaxed mt-1">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
