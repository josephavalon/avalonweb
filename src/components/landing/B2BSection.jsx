import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Music2, CalendarDays, Building2 } from 'lucide-react';

const channels = [
  { icon: Cpu,          title: 'Companies',   desc: 'On-site and on-call Protocols for engineering teams, founder offsites, and launch weeks.' },
  { icon: CalendarDays, title: 'Live Events', desc: 'Activations, after-parties, and media days. Hydration and recovery as part of the production, not a pop-up.' },
  { icon: Music2,       title: 'Festivals',   desc: 'Multi-day festival partnerships — artist trailers, crew villages, and VIP lounges kept running from load-in to strike.' },
  { icon: Building2,    title: 'Music Venues', desc: 'Residencies with clubs and concert halls. Green-room IV for touring artists and crews, on rider or on call.' },
];

const EASE = [0.16, 1, 0.3, 1];

export default function B2BSection() {
  return (
    <section id="b2b" className="py-14 md:py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-8 md:gap-14 items-start">

          {/* LEFT: title + subhead + CTA */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.8, ease: EASE }}
            className="text-left md:sticky md:top-28"
          >
            <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">Built In, Not Bolted On</p>
            <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] uppercase mb-4 md:mb-6">
              Partnerships
            </h2>
            <p className="font-heading text-xl md:text-3xl lg:text-4xl text-foreground tracking-wide uppercase leading-[1.05] mb-5 md:mb-7">
              We don&rsquo;t plug in.<br />We <span className="text-accent">integrate</span>.
            </p>
            <a
              href="mailto:support@avalonvitality.co"
              className="inline-block px-6 py-3 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold hover:bg-foreground/90 transition-colors rounded-full"
            >
              Talk to Partnerships →
            </a>
          </motion.div>

          {/* RIGHT: 2x2 grid of horizontal cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {channels.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
                className="border border-white/10 bg-white/[0.04] backdrop-blur-md rounded-2xl p-4 md:p-5 flex items-start gap-3 md:gap-4"
              >
                <div className="w-11 h-11 md:w-12 md:h-12 rounded-full border border-accent/55 flex items-center justify-center text-accent shrink-0">
                  <item.icon className="w-5 h-5 md:w-5 md:h-5" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading text-base md:text-lg text-foreground tracking-wide uppercase leading-tight mb-1.5">{item.title}</h3>
                  <p className="font-body text-xs md:text-sm text-foreground/80 leading-snug">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
