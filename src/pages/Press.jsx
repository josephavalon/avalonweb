import React from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, Mail, Image, FileText, User, Camera } from 'lucide-react';
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

// Press coverage will be added here as it publishes.

const BRAND_ASSETS = [
  {
    icon: Image,
    label: 'Avalon Logo',
    desc: 'Primary lockup, dark and light variants. SVG + PNG.',
    action: 'Coming Soon',
  },
  {
    icon: FileText,
    label: 'Brand Guidelines',
    desc: 'Color system, typography, usage rules.',
    action: 'Coming Soon',
  },
  {
    icon: User,
    label: 'Founder Photo',
    desc: 'High-resolution headshot for editorial use.',
    action: 'Coming Soon',
  },
  {
    icon: Camera,
    label: 'Product Photography',
    desc: 'Session photography, lifestyle images, product shots.',
    action: 'Coming Soon',
  },
];

const FAST_FACTS = [
  { label: 'Founded', value: '2025' },
  { label: 'Location', value: 'San Francisco, CA' },
  { label: 'Clinicians', value: 'Licensed RNs' },
  { label: 'Delivery', value: 'Mobile — at your location' },
  { label: 'Model', value: 'Membership + à la carte' },
  { label: 'Launch', value: 'SF Bay Area, 2026' },
];

export default function Press() {
  useSeo({ title: 'Press — Avalon Vitality', description: 'Media coverage and press resources for Avalon Vitality mobile IV therapy.', path: '/press' });
  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Media
            </motion.p>
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
            >
              Press
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl mb-6"
            >
              Media inquiries, assets, and coverage.
            </motion.p>
            <motion.a
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.22 }}
              href="mailto:press@avalonvitality.co"
              className="inline-flex items-center gap-2 font-body text-sm text-accent hover:text-accent/80 transition-colors duration-200"
            >
              <Mail className="w-4 h-4" />
              press@avalonvitality.co
            </motion.a>
          </div>
        </section>

        {/* Coverage */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Coverage
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              In the Press
            </motion.h2>
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-10 md:p-14 flex flex-col items-center text-center"
            >
              <p className="font-heading text-2xl md:text-3xl text-foreground/30 uppercase mb-4">Launching 2026</p>
              <p className="font-body text-sm text-foreground/40 leading-relaxed max-w-md">
                Avalon Vitality is preparing for public launch in the San Francisco Bay Area. Press coverage will appear here as it publishes. For early access or editorial inquiries, reach us below.
              </p>
              <a
                href="mailto:press@avalonvitality.co"
                className="mt-6 inline-flex items-center gap-2 font-body text-xs tracking-[0.2em] uppercase text-accent border border-accent/30 px-5 py-2.5 rounded-full hover:bg-accent/10 transition-colors duration-200"
              >
                <Mail className="w-3.5 h-3.5" />
                Request Early Coverage
              </a>
            </motion.div>
          </div>
        </Reveal>

        {/* Brand Assets */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Assets
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Brand Assets
            </motion.h2>

            <div className="grid md:grid-cols-2 gap-4">
              {BRAND_ASSETS.map((asset, i) => {
                const Icon = asset.icon;
                return (
                  <motion.div
                    key={asset.label}
                    {...REVEAL}
                    transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
                    className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8 flex items-start gap-5"
                  >
                    <div className="w-10 h-10 rounded-full bg-foreground/[0.06] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-foreground/40" />
                    </div>
                    <div className="flex-1">
                      <p className="font-heading text-lg text-foreground uppercase mb-1">{asset.label}</p>
                      <p className="font-body text-sm text-foreground/55 leading-relaxed mb-4">{asset.desc}</p>
                      <a
                        href="mailto:press@avalonvitality.co"
                        className="inline-flex items-center gap-1.5 font-body text-xs tracking-[0.15em] uppercase text-foreground/35 border border-foreground/[0.1] px-3 py-1.5 rounded-full hover:border-foreground/25 hover:text-foreground/55 transition-colors duration-200"
                      >
                        <Download className="w-3 h-3" />
                        {asset.action}
                      </a>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Press Contact */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...REVEAL}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 flex flex-col md:flex-row gap-8 items-start"
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-2">Press Contact</p>
                <h2 className="font-heading text-2xl md:text-3xl text-foreground uppercase leading-[0.95] mb-4">
                  Media Inquiries
                </h2>
                <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed mb-4">
                  For editorial requests, interview inquiries, or asset access — reach us directly.
                </p>
                <a
                  href="mailto:press@avalonvitality.co"
                  className="font-body text-sm text-accent hover:text-accent/80 transition-colors duration-200"
                >
                  press@avalonvitality.co
                </a>
                <p className="font-body text-xs text-foreground/35 mt-1.5">Response within 24 hours.</p>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* Fast Facts */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Company
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Fast Facts
            </motion.h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {FAST_FACTS.map((fact, i) => (
                <motion.div
                  key={fact.label}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5"
                >
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/35 mb-1.5">{fact.label}</p>
                  <p className="font-body text-sm text-foreground/80 leading-snug">{fact.value}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Founder Quote */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...REVEAL}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-8 md:p-12"
            >
              <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/35 mb-6">Founder</p>
              <div className="border-l-2 border-accent/40 pl-6 md:pl-8">
                <p className="font-heading text-2xl md:text-3xl text-foreground/70 uppercase leading-[1.1] mb-6 italic">
                  "Most wellness brands sell you supplements and wish you luck. We show up at your door with a licensed RN. That's not a service — that's a relationship with your health."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-foreground/[0.06] border border-foreground/[0.08] flex items-center justify-center">
                    <User className="w-4 h-4 text-foreground/40" />
                  </div>
                  <div>
                    <p className="font-body text-sm text-foreground/60">Joseph · Founder, Avalon Vitality</p>
                    <p className="font-body text-xs text-foreground/30">San Francisco, CA</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
