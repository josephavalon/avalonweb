import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Music2, CalendarDays, Building2 } from 'lucide-react';

// Four partnership channels, reoriented around the culture Avalon actually
// shows up in: tech, live events, festivals, music venues. Copy frames
// Avalon as a co-producer, not a vendor. Order reflects pipeline priority.
const channels = [
  { icon: Cpu,          title: 'Tech Companies',   desc: 'On-site and on-call Protocols for engineering teams, founder offsites, and launch weeks. Book the same nurse every visit.' },
  { icon: CalendarDays, title: 'Live Events',      desc: 'Activations, after-parties, and media days. Hydration and recovery as part of the production, not a pop-up.' },
  { icon: Music2,       title: 'Festivals',        desc: 'Multi-day festival partnerships — artist trailers, crew villages, and VIP lounges kept running from load-in to strike.' },
  { icon: Building2,    title: 'Music Venues',     desc: 'Residencies with clubs and concert halls. Green-room IV for touring artists and crews, on rider or on call.' },
];

export default function B2BSection() {
  return (
    <section id="b2b" className="py-8 md:py-10 px-4 border-t border-border bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-left mb-4 md:mb-8"
        >
          <p className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4">Partnerships</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95]">PARTNERSHIPS</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-16 items-center">

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="flex flex-col justify-center"
          >
            <p className="font-body text-sm text-foreground leading-relaxed mb-4">
              Avalon operates at the point of execution — tech orgs, touring productions, festivals, venues. Protocols delivered where performance happens, not after.
            </p>
            <p className="font-body text-sm text-foreground leading-relaxed mb-4">
              We don&rsquo;t plug in. We integrate.
            </p>
            <p className="font-body text-sm text-foreground leading-relaxed mb-4">
              On rider, on call, or on site — Avalon embeds directly into the production, adapting to whatever the environment demands.
            </p>
            <div className="flex justify-start mt-4">
              <a
                href="mailto:support@avalonvitality.co"
                className="px-8 py-4 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold hover:bg-foreground/90 transition-colors rounded-full"
              >
                Talk to Partnerships →
              </a>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            {channels.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="border border-border rounded-3xl bg-card p-5"
              >
                <item.icon className="w-5 h-5 text-accent mb-3" strokeWidth={1.5} />
                <h3 className="font-heading text-lg text-foreground tracking-wide mb-1">{item.title}</h3>
                <p className="font-body text-xs text-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}