import React from 'react';
import { useSeo } from '@/lib/seo';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Stethoscope } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Reveal } from '@/components/ui/Reveal';

// Editorial easing per non-negotiable #5.
const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 1, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.42, ease: EASE },
};

export default function OurStory() {
  useSeo({
    title: 'Our Story — Avalon Vitality',
    description: 'Clinician-led mobile recovery in the SF Bay Area — the thesis and the team behind Avalon Vitality.',
    path: '/our-story',
  });
  return (
    <div className="av-page-surface min-h-screen">
      <Navbar />

      {/* Thesis */}
      <Reveal as="section" className="px-6 md:px-16 pt-28 md:pt-36 py-section-sm md:py-section">
        <div className="max-w-content mx-auto grid md:grid-cols-12 gap-rhythm-6">
          <motion.div {...REVEAL} className="md:col-span-5">
            <p className="text-eyebrow text-muted-foreground font-body uppercase mb-6">
              The Thesis
            </p>
            <h2 className="font-heading text-h1 text-foreground tracking-wide">
              California runs on ambition.
            </h2>
          </motion.div>
          <motion.div
            {...REVEAL}
            transition={{ ...REVEAL.transition, delay: 0.15 }}
            className="md:col-span-7 space-y-5 max-w-measure"
          >
            <p className="font-body text-body text-foreground leading-relaxed">
              High performers engineer recovery.
            </p>
            <p className="font-body text-body text-muted-foreground leading-relaxed">
              Avalon brings clinician-led care to the place you already are.
            </p>
          </motion.div>
        </div>
      </Reveal>

      {/* Clinical Leadership */}
      <section
        id="leadership"
        className="px-6 md:px-16 py-section-sm md:py-section border-t border-border"
      >
        <div className="max-w-content mx-auto">
          <motion.div {...REVEAL} className="mb-10 max-w-measure-lg">
            <p className="text-eyebrow text-accent font-body uppercase mb-4 inline-flex items-center gap-2">
              <Stethoscope className="w-3 h-3" strokeWidth={2} />
              Clinical Leadership
            </p>
            <h2 className="font-heading text-h1 text-foreground tracking-wide mb-4">
              Care that travels with credentials.
            </h2>
            <p className="font-body text-body text-muted-foreground leading-relaxed">
              Physician-supervised protocols. California-licensed clinicians.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-rhythm-4">
            <motion.div
              {...REVEAL}
              className="border border-white/20 bg-white/[0.04] backdrop-blur-md rounded-2xl p-8 md:p-10"
            >
              <div className="w-14 h-14 rounded-full border border-white/20 bg-white/[0.05] backdrop-blur-md flex items-center justify-center mb-6">
                <span className="font-heading text-xl text-accent tracking-wider">JW</span>
              </div>
              <h3 className="font-heading text-h4 text-foreground tracking-wide mb-1">
                Dr. Jayson Weir, MD
              </h3>
              <p className="text-micro tracking-[0.2em] text-accent font-body uppercase mb-5">
                Founder &amp; Medical Director
              </p>
              <p className="font-body text-body-sm text-muted-foreground leading-relaxed">
                Medical director for Avalon protocols and clinical standards.
              </p>
            </motion.div>

            <motion.div
              {...REVEAL}
              transition={{ ...REVEAL.transition, delay: 0.15 }}
              className="border border-white/20 bg-white/[0.04] backdrop-blur-md rounded-2xl p-8 md:p-10"
            >
              <div className="w-14 h-14 rounded-full border border-white/20 bg-white/[0.05] backdrop-blur-md flex items-center justify-center mb-6">
                <span className="font-heading text-xl text-accent tracking-wider">SW</span>
              </div>
              <h3 className="font-heading text-h4 text-foreground tracking-wide mb-1">
                Stephanie Weeks, Registered Nurse
              </h3>
              <p className="text-micro tracking-[0.2em] text-accent font-body uppercase mb-5">
                Lead Registered Nurse
              </p>
              <p className="font-body text-body-sm text-muted-foreground leading-relaxed">
                Lead Registered Nurse for field standards, sterility, and bedside care.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
