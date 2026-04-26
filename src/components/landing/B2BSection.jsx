import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Music2, CalendarDays, Building2 } from 'lucide-react';

// Four partnership channels, reoriented around the culture Avalon actually
// shows up in: tech, live events, festivals, music venues. Copy frames
// Avalon as a co-producer, not a vendor. Order reflects pipeline priority.
const channels = [
  { icon: Cpu,          title: 'Companies',   desc: 'On-site and on-call Protocols for engineering teams, founder offsites, and launch weeks.' },
  { icon: CalendarDays, title: 'Live Events',      desc: 'Activations, after-parties, and media days. Hydration and recovery as part of the production, not a pop-up.' },
  { icon: Music2,       title: 'Festivals',        desc: 'Multi-day festival partnerships — artist trailers, crew villages, and VIP lounges kept running from load-in to strike.' },
  { icon: Building2,    title: 'Music Venues',     desc: 'Residencies with clubs and concert halls. Green-room IV for touring artists and crews, on rider or on call.' },
];

export default function B2BSection() {
  return (
    <section id="b2b" className="py-6 md:py-12 px-4 border-t border-border bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-left mb-3 md:mb-6"
        >
          <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">Built In, Not Bolted On</p>
          <h2 className="font-heading text-foreground tracking-wide leading-[0.95] text-[10vw] md:text-7xl lg:text-8xl">PARTNERSHIPS</h2>
        </motion.div>

        <div className="grid md:grid-cols-[1fr_1.1fr] gap-6 md:gap-12 items-stretch">

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-center"
          >
            <p className="font-heading text-2xl md:text-5xl lg:text-6xl text-foreground tracking-wide uppercase leading-[0.95] mb-4 md:mb-8">
              We don&rsquo;t plug in.<br />We <span className="text-accent">integrate</span>.
            </p>
            <div className="flex justify-center mt-4">
              <a
                href="mailto:support@avalonvitality.co"
                className="px-6 py-3 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold hover:bg-foreground/90 transition-colors rounded-full"
              >
                Talk to Partnerships →
              </a>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {channels.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="border border-border rounded-2xl bg-card p-4 md:p-6 h-full flex flex-col"
              >
                <item.icon className="w-6 h-6 md:w-7 md:h-7 text-accent mb-2 md:mb-3" strokeWidth={1.5} />
                <h3 className="font-heading text-xl md:text-2xl lg:text-3xl text-foreground tracking-wide mb-1.5 md:mb-2">{item.title}</h3>
                <p className="font-body text-xs md:text-sm text-foreground/85 leading-snug flex-1">{item.desc}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}