import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';

const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const ROLES = [
  {
    title: 'Field RN — San Francisco Bay Area',
    type: 'Contract (1099)',
    location: 'San Francisco, CA',
    description: 'Administer IV therapy and injections in client homes and partner venues. Flexible scheduling, competitive per-visit pay.',
  },
  {
    title: 'Operations Coordinator',
    type: 'Full-time',
    location: 'San Francisco, CA',
    description: 'Own logistics, scheduling, and supply chain for our field team. High-ownership role in a fast-moving clinical operation.',
  },
  {
    title: 'Growth & Partnerships',
    type: 'Full-time',
    location: 'San Francisco, CA (Hybrid)',
    description: 'Build and manage relationships with hotels, gyms, wellness brands, and corporate clients. Bring Avalon to new channels.',
  },
  {
    title: 'Client Experience Lead',
    type: 'Part-time',
    location: 'San Francisco, CA',
    description: 'First point of contact for inbound inquiries, bookings, and follow-ups. You represent the Avalon standard.',
  },
];

export default function Careers() {
  useSeo({
    title: 'Careers — Avalon Vitality',
    description: 'Join the team building the infrastructure for in-home longevity care. Open roles in nursing, operations, growth, and more.',
    path: '/careers',
  });

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Careers
            </motion.p>
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
            >
              Join Avalon
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl"
            >
              We're building the infrastructure for in-home longevity care. If you want to do the best work of your career alongside people who care about getting it right, read on.
            </motion.p>
          </div>
        </section>

        {/* Open Roles */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Open Positions
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Open Roles
            </motion.h2>

            <div className="space-y-4">
              {ROLES.map((role, i) => (
                <motion.div
                  key={role.title}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-6 md:p-8 flex flex-col md:flex-row md:items-start md:justify-between gap-5"
                >
                  <div className="flex-1">
                    <p className="font-heading text-xl md:text-2xl text-foreground uppercase leading-tight mb-2">
                      {role.title}
                    </p>
                    <div className="flex flex-wrap gap-3 mb-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-foreground/[0.12] font-body text-[10px] tracking-[0.12em] uppercase text-foreground/50">
                        {role.type}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-foreground/[0.12] font-body text-[10px] tracking-[0.12em] uppercase text-foreground/50">
                        {role.location}
                      </span>
                    </div>
                    <p className="font-body text-sm text-foreground/60 leading-relaxed">
                      {role.description}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <a
                      href="mailto:careers@avalonvitality.co"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-foreground/20 font-body text-xs tracking-[0.15em] uppercase text-foreground/70 hover:border-accent/50 hover:text-accent transition-all duration-200"
                    >
                      Learn More <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Nurse Application */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Nurse Network
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-6"
            >
              Are You an RN?
            </motion.h2>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.14 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl mb-4"
            >
              We partner with licensed RNs as independent 1099 field nurses. You set your own schedule. We handle the clients, protocols, and supplies. You show up and deliver exceptional care.
            </motion.p>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
              className="font-body text-sm text-foreground/50 leading-relaxed max-w-2xl mb-10"
            >
              IV experience preferred. Active California RN license required. Competitive per-visit compensation with flexible scheduling across the Bay Area.
            </motion.p>
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.26 }}
            >
              <a
                href="mailto:nurses@avalonvitality.co"
                className="inline-flex items-center gap-2 bg-accent text-background font-body text-sm tracking-[0.15em] uppercase px-7 py-3.5 rounded-xl hover:bg-accent/90 transition-colors duration-200"
              >
                Apply to Join <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </a>
            </motion.div>
          </div>
        </Reveal>

        {/* Closing note */}
        <Reveal as="section" className="py-12 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <p className="font-body text-xs text-foreground/35 leading-relaxed max-w-2xl">
              Don't see a role that fits? We're always open to exceptional people. Send us a note at{' '}
              <a href="mailto:careers@avalonvitality.co" className="text-foreground/50 hover:text-accent transition-colors">
                careers@avalonvitality.co
              </a>{' '}
              and tell us what you'd bring to Avalon.
            </p>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
