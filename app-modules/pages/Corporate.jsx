import React, { useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight, Building2, CalendarCheck, Check, ShieldCheck, Users } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';
import GlassCard from '@/components/ui/GlassCard';
import PremiumButton from '@/components/ui/PremiumButton';

const EASE = [0.16, 1, 0.3, 1];

const stats = [
  { value: 'Site', label: 'Office / event', icon: Building2 },
  { value: 'Registered Nurse', label: 'California licensed', icon: ShieldCheck },
  { value: 'Bill', label: 'One invoice', icon: CalendarCheck },
];

const plan = [
  { value: '1', label: 'Pick day' },
  { value: '2', label: 'registered nurse team arrives' },
  { value: '3', label: 'Employees rotate in' },
];

const ranges = [
  { size: '5-10', price: '$280' },
  { size: '11-25', price: '$250' },
  { size: '25+', price: 'Custom' },
];

export default function Corporate() {
  useSeo({
    title: 'Corporate Wellness — Avalon Vitality',
    description: 'On-site IV therapy for teams and events in the San Francisco Bay Area.',
    path: '/corporate',
  });

  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen w-full bg-background">
      <Navbar />
      <main className="px-5 pb-16 pt-24 md:px-12 md:pt-28 lg:px-20">
        <section className="mx-auto grid min-h-[calc(100svh-7rem)] max-w-6xl items-center gap-5 md:grid-cols-[0.92fr_1.08fr] md:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.75, ease: EASE, delay: 0.08 }}
          >
            <p className="mb-3 font-body text-[10px] font-black uppercase tracking-[0.28em] text-foreground/45">
              Corporate wellness
            </p>
            <h1 className="font-heading text-[clamp(4rem,18vw,7.8rem)] uppercase leading-[0.82] tracking-normal text-foreground md:text-[8.5rem]">
              Team IV
            </h1>
            <p className="mt-5 max-w-lg font-body text-base font-semibold leading-relaxed text-foreground/64 md:text-lg">
              Licensed Registered Nurse visits for offices, offsites, and executive teams.
            </p>
            <div className="mt-7">
              <PremiumButton
                as="a"
                href="#proposal"
                className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-full bg-foreground px-8 font-body text-xs font-black uppercase tracking-[0.16em] text-background"
              >
                Request <ArrowRight className="h-4 w-4" strokeWidth={2.35} />
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
                {stats.map(({ value, label, icon: Icon }) => (
                  <div key={label} className="rounded-[1.2rem] border border-foreground/10 bg-foreground/[0.045] p-3">
                    <Icon className="h-4 w-4 text-foreground/45" strokeWidth={1.8} />
                    <p className="mt-4 font-heading text-[2rem] uppercase leading-none text-foreground md:text-[2.45rem]">{value}</p>
                    <p className="mt-1 font-body text-[10px] font-black uppercase tracking-[0.12em] text-foreground/45">{label}</p>
                  </div>
                ))}
              </div>
              <div className="relative mt-3 grid gap-2">
                {plan.map((step) => (
                  <div key={step.value} className="flex min-h-[64px] items-center gap-3 rounded-[1.2rem] border border-foreground/10 bg-background/82 px-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.06] font-heading text-2xl text-foreground">
                      {step.value}
                    </span>
                    <span className="font-heading text-[2rem] uppercase leading-none text-foreground md:text-[2.55rem]">{step.label}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </section>

        <Reveal as="section" className="mx-auto mt-6 grid max-w-6xl gap-3 md:grid-cols-1 md:grid-cols-2">
          {ranges.map((row) => (
            <GlassCard key={row.size} tone="soft" radius="1.55rem" className="p-5">
              <div className="relative">
                <p className="font-body text-[10px] font-black uppercase tracking-[0.18em] text-foreground/42">Team size</p>
                <p className="mt-2 font-heading text-[3.4rem] uppercase leading-none text-foreground">{row.size}</p>
                <p className="mt-4 font-heading text-[2.7rem] uppercase leading-none text-foreground">{row.price}</p>
              </div>
            </GlassCard>
          ))}
        </Reveal>

        <Reveal as="section" id="proposal" className="mx-auto mt-6 max-w-6xl scroll-mt-28">
          <GlassCard tone="command" radius="1.75rem" className="p-5 md:p-6">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="relative flex min-h-[260px] flex-col items-center justify-center text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.06]">
                  <Check className="h-5 w-5 text-foreground" strokeWidth={2} />
                </span>
                <p className="mt-5 font-heading text-[3rem] uppercase leading-none text-foreground">Received</p>
                <p className="mt-3 max-w-md font-body text-sm font-semibold leading-relaxed text-foreground/58">
                  Avalon will respond within one business day.
                </p>
              </motion.div>
            ) : (
              <form
                className="relative grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubmitted(true);
                }}
              >
                <label className="sr-only" htmlFor="company">Company</label>
                <input
                  id="company"
                  required
                  placeholder="Company"
                  className="min-h-[58px] rounded-[1.2rem] border border-foreground/12 bg-foreground/[0.045] px-4 font-body text-sm font-semibold text-foreground placeholder:text-foreground/32"
                />
                <label className="sr-only" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="Work email"
                  className="min-h-[58px] rounded-[1.2rem] border border-foreground/12 bg-foreground/[0.045] px-4 font-body text-sm font-semibold text-foreground placeholder:text-foreground/32"
                />
                <label className="sr-only" htmlFor="teamSize">Team size</label>
                <select
                  id="teamSize"
                  required
                  defaultValue=""
                  className="min-h-[58px] rounded-[1.2rem] border border-foreground/12 bg-foreground/[0.045] px-4 font-body text-sm font-semibold text-foreground"
                >
                  <option value="" disabled>Team size</option>
                  <option value="5-10">5-10</option>
                  <option value="11-25">11-25</option>
                  <option value="25+">25+</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-full bg-foreground px-7 font-body text-xs font-black uppercase tracking-[0.14em] text-background"
                >
                  Send <Users className="h-4 w-4" strokeWidth={2.35} />
                </button>
              </form>
            )}
          </GlassCard>
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
