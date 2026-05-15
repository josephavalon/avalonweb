import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { EASE } from '@/lib/motion';

// Tuesday morning vignette — paints the actual experience.
// Most powerful copy on the site for someone who hasn't bought yet.
const STEPS = [
  { time: '6:45 AM', text: 'Text Avalon. Drip request: NAD+ 500mg + B-complex.' },
  { time: '7:00 AM', text: 'Avalon nurse arrives. Vitals, IV in 8 minutes.' },
  { time: '7:30 AM', text: 'You’re on Zoom. Drip running. Standup goes long, no problem.' },
  { time: '8:15 AM', text: 'Bag empties. Nurse out. You’re on, sharp, no afternoon dip ahead.' },
];

export default function DayInTheLife() {
  return (
    <section className="py-14 md:py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">A Tuesday with Avalon</p>
          <h2 className="font-heading text-[9vw] md:text-7xl text-foreground tracking-wide leading-[0.95] uppercase">
            What it looks like
          </h2>
          <div className="w-12 md:w-16 h-[2px] bg-accent mt-3 md:mt-4" />
        </motion.div>

        <ol className="relative border-l border-foreground/10 ml-3 md:ml-5 space-y-6 md:space-y-8 pl-6 md:pl-10">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.time}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
              className="relative"
            >
              <span className="absolute -left-[33px] md:-left-[49px] top-1 w-3 h-3 md:w-4 md:h-4 rounded-full bg-accent ring-4 ring-background" aria-hidden="true" />
              <p className="font-body text-[10px] md:text-xs tracking-[0.25em] uppercase text-accent mb-2 flex items-center gap-2">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                {s.time}
              </p>
              <p className="font-body text-base md:text-lg text-foreground leading-relaxed">{s.text}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
