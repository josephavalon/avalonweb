import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight, BedDouble, Clock, ConciergeBell, MapPin, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';
import GlassCard from '@/components/ui/GlassCard';
import PremiumButton from '@/components/ui/PremiumButton';

const EASE = [0.16, 1, 0.3, 1];

const status = [
  { icon: ShieldCheck, value: 'Registered Nurse', label: 'Licensed' },
  { icon: Clock, value: '45m', label: 'Visit' },
  { icon: MapPin, value: 'SF', label: 'Bay hotels' },
];

const steps = [
  { value: '1', label: 'Book' },
  { value: '2', label: 'registered nurse to room' },
  { value: '3', label: 'Recover' },
];

const fit = ['Jet lag', 'Late nights', 'Events', 'Work travel'];

export default function Hotel() {
  useSeo({
    title: 'Hotel IV Delivery — Avalon Vitality',
    description: 'Licensed Registered Nurse hotel IV therapy in the San Francisco Bay Area.',
    path: '/hotel',
  });

  return (
    <div className="min-h-screen w-full bg-background">
      <Navbar />
      <main className="px-5 pb-16 pt-24 md:px-12 md:pt-28 lg:px-20">
        <section className="mx-auto grid min-h-[calc(100svh-7rem)] max-w-6xl items-center gap-5 md:grid-cols-[0.95fr_1.05fr] md:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.75, ease: EASE, delay: 0.08 }}
          >
            <p className="mb-3 font-body text-[10px] font-black uppercase tracking-[0.28em] text-foreground/62">
              Hotel concierge IV
            </p>
            <h1 className="font-heading text-[clamp(4rem,18vw,7.8rem)] uppercase leading-[0.82] tracking-normal text-foreground md:text-[8.5rem]">
              In-Room IV
            </h1>
            <p className="mt-5 max-w-lg font-body text-base font-semibold leading-relaxed text-foreground/64 md:text-lg">
              Licensed Registered Nurse to your hotel room. No lobby. No clinic.
            </p>
            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <PremiumButton
                as={Link}
                to="/book"
                className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-full bg-foreground px-8 font-body text-xs font-black uppercase tracking-[0.16em] text-background"
              >
                Book <ArrowRight className="h-4 w-4" strokeWidth={2.35} />
              </PremiumButton>
              <PremiumButton
                as="a"
                href="mailto:concierge@avalonvitality.co"
                className="inline-flex min-h-[58px] items-center justify-center rounded-full border border-foreground/18 bg-background/82 px-8 font-body text-xs font-black uppercase tracking-[0.14em] text-foreground backdrop-blur-xl"
              >
                Concierge
              </PremiumButton>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.75, ease: EASE, delay: 0.18 }}
          >
            <GlassCard tone="command" radius="1.75rem" className="p-4 md:p-5">
              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-2">
                {status.map(({ icon: Icon, value, label }) => (
                  <div key={label} className="rounded-[1.2rem] border border-foreground/10 bg-foreground/[0.045] p-3">
                    <Icon className="h-4 w-4 text-foreground/62" strokeWidth={1.8} />
                    <p className="mt-4 font-heading text-[2.15rem] uppercase leading-none text-foreground md:text-[2.65rem]">{value}</p>
                    <p className="mt-1 font-body text-[10px] font-black uppercase tracking-[0.14em] text-foreground/62">{label}</p>
                  </div>
                ))}
              </div>
              <div className="relative mt-3 grid gap-2">
                {steps.map((step) => (
                  <div key={step.value} className="flex min-h-[64px] items-center gap-3 rounded-[1.2rem] border border-foreground/10 bg-background/82 px-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.06] font-heading text-2xl text-foreground">
                      {step.value}
                    </span>
                    <span className="font-heading text-[2.2rem] uppercase leading-none text-foreground md:text-[2.7rem]">{step.label}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </section>

        <Reveal as="section" className="mx-auto mt-6 grid max-w-6xl gap-3 md:grid-cols-[0.9fr_1.1fr]">
          <GlassCard tone="soft" radius="1.55rem" className="p-5">
            <div className="relative flex items-center gap-3">
              <BedDouble className="h-5 w-5 text-foreground/62" strokeWidth={1.8} />
              <h2 className="font-heading text-[2.8rem] uppercase leading-none text-foreground">Best For</h2>
            </div>
            <div className="relative mt-4 flex flex-wrap gap-2">
              {fit.map((item) => (
                <span key={item} className="rounded-full border border-foreground/10 bg-foreground/[0.045] px-3 py-2 font-body text-xs font-bold text-foreground/70">
                  {item}
                </span>
              ))}
            </div>
          </GlassCard>

          <GlassCard tone="soft" radius="1.55rem" className="p-5">
            <div className="relative flex items-center gap-3">
              <ConciergeBell className="h-5 w-5 text-foreground/62" strokeWidth={1.8} />
              <h2 className="font-heading text-[2.8rem] uppercase leading-none text-foreground">Coverage</h2>
            </div>
            <p className="relative mt-3 font-body text-sm font-semibold leading-relaxed text-foreground/60">
              SF, Marin, Peninsula, South Bay, and East Bay hotels. Room number collected at booking.
            </p>
          </GlassCard>
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
