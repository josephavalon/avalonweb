import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, Zap, CalendarCheck } from 'lucide-react';

const useCases = [
  { icon: Building2, title: 'Corporate Wellness', desc: 'On-site IV therapy for your team. Boost productivity, reduce burnout, and show up for your people.' },
  { icon: Users, title: 'Group Events', desc: 'Conferences, retreats, team offsites. We bring the drips — your team leaves recharged.' },
  { icon: Zap, title: 'Executive Programs', desc: 'Recurring protocols for high-performing leaders. NAD+, recovery, and optimization on your schedule.' },
  { icon: CalendarCheck, title: 'Concierge Booking', desc: 'Dedicated coordinator for ongoing B2B accounts. Simple invoicing, flexible scheduling, full discretion.' },
];

export default function B2BSection() {
  return (
    <section id="b2b" className="py-8 md:py-10 px-4 border-t border-border bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-start">

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4">Corporate & B2B</p>
            <h2 className="font-heading text-5xl md:text-6xl text-foreground tracking-wide mb-6">BRING AVALON TO YOUR TEAM</h2>
            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-6">
              We partner with companies, agencies, and high-performance teams across San Francisco to deliver on-site wellness — no clinic required. From executive recovery programs to team events, we handle the logistics.
            </p>
            <div className="flex justify-center">
              <a
                href="mailto:hello@avalonvitality.com"
                className="px-8 py-4 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold hover:bg-foreground/90 transition-colors rounded-full"
              >
                Inquire →
              </a>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            {useCases.map((item, i) => (
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
                <p className="font-body text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}