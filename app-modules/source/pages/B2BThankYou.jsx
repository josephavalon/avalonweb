import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import PremiumButton from '@/components/ui/PremiumButton';

const EASE = [0.16, 1, 0.3, 1];

export default function B2BThankYou() {
  useSeo({
    title: 'Group Recovery Request — Avalon Vitality',
    description: 'Your Avalon Vitality group recovery request has been received.',
    path: '/b2b/thank-you',
  });

  return (
    <div className="av-page-surface min-h-screen text-foreground">
      <Navbar />
      <main className="px-5 pb-20 pt-28 md:px-10 md:pb-28 md:pt-36">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE }}
          className="mx-auto max-w-5xl"
        >
          <p className="font-body text-[10px] uppercase tracking-[0.34em] text-foreground/42">Group Recovery</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <h1 className="font-heading text-[4.2rem] uppercase leading-[0.84] tracking-tight text-foreground md:text-[7.8rem]">
                Request<br />Received
              </h1>
              <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-foreground/58 md:text-lg">
                Your Avalon group request is in. We will confirm timing, staffing, protocol, and payment by text.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.18, ease: EASE }}
              className="av-motion-rail rounded-[1.5rem] border border-accent/22 bg-accent/[0.055] p-4 shadow-[0_24px_90px_hsl(var(--accent)/0.10)] backdrop-blur-2xl"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/24 bg-accent/[0.10] text-accent">
                  <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-[0.22em] text-accent/80">Ops Queue</p>
                  <p className="mt-1 font-body text-sm font-semibold text-foreground">Acuity, staffing, and GFE routing next.</p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              ['01', 'Review size + timing'],
              ['02', 'Confirm protocol + staff'],
              ['03', 'Recover on site'],
            ].map(([step, label]) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.54, delay: 0.24 + Number(step) * 0.06, ease: EASE }}
                className="av-glass-sweep relative overflow-hidden rounded-[1.25rem] border border-foreground/[0.10] bg-background/62 p-4 shadow-[0_18px_70px_hsl(var(--foreground)/0.055)] backdrop-blur-xl"
              >
                <p className="font-body text-[10px] uppercase tracking-[0.24em] text-foreground/35">{step}</p>
                <p className="mt-2 font-body text-sm font-semibold text-foreground">{label}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PremiumButton
              as="a"
              href="mailto:support@avalonvitality.co"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-foreground/[0.14] px-6 font-body text-xs font-semibold uppercase tracking-[0.2em] text-foreground transition-colors hover:border-foreground/35"
            >
              <Mail className="h-4 w-4" strokeWidth={1.8} /> Email Us
            </PremiumButton>
            <PremiumButton
              as={Link}
              to="/launches"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-foreground px-6 font-body text-xs font-semibold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-85"
            >
              Launches <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </PremiumButton>
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  );
}
