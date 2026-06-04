import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Mail, Megaphone, Package, Sparkles, Stethoscope, Ticket } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PremiumButton from '@/components/ui/PremiumButton';
import { useSeo } from '@/lib/seo';
import { EASE } from '@/lib/motion';

const launchCards = [
  {
    label: 'Events',
    icon: CalendarDays,
    tag: 'Private activations',
    detail: 'Recovery lounges for venues, launches, after-parties, retreats, and race weekends.',
    action: 'Plan activation',
  },
  {
    label: 'Products',
    icon: Package,
    tag: 'Presale drops',
    detail: 'Limited IV bundles, membership credits, and launch-only packages before public release.',
    action: 'View presales',
  },
  {
    label: 'Services',
    icon: Stethoscope,
    tag: 'Clinical roadmap',
    detail: 'Peptides, hormone optimization, diagnostics, aesthetics, and clinician-led programs as they open.',
    action: 'Get notified',
  },
  {
    label: 'Announcements',
    icon: Megaphone,
    tag: 'Avalon updates',
    detail: 'New cities, partner venues, launch dates, membership windows, and private beta invitations.',
    action: 'Follow launch',
  },
];

const presales = [
  { label: 'Founding IV Credits', value: 'Private beta', icon: Ticket },
  { label: 'NAD+ Launch Window', value: 'Dose menu live', icon: Sparkles },
  { label: 'Group Recovery', value: 'Events + hotels', icon: CalendarDays },
];

export default function Events() {
  useSeo({
    title: 'Launches — Avalon Vitality',
    description: 'Avalon launches, presales, services, products, and private recovery activations.',
    path: '/launches',
  });

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 pb-20 pt-28 md:px-8 md:pt-32">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="relative overflow-hidden rounded-[1.7rem] border border-foreground/12 bg-background/36 p-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_34px_120px_hsl(var(--foreground)/0.11)] backdrop-blur-2xl md:rounded-[2rem] md:p-8"
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,hsl(var(--foreground)/0.12),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.025))]" />

          <div className="relative grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-end">
            <div>
              <p className="mb-3 font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/58">Private beta launch board</p>
              <h1 className="font-heading text-[4.7rem] uppercase leading-[0.84] tracking-normal text-foreground md:whitespace-nowrap md:text-[6.8rem] lg:text-[7.6rem]">
                Launches
              </h1>
              <p className="mt-5 max-w-xl font-body text-2xl font-semibold leading-tight text-foreground/82 md:text-3xl">
                Events, presales, products, and services opening next.
              </p>
            </div>

            <div id="inquiry" className="grid gap-2">
              {presales.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex min-h-[66px] items-center justify-between gap-3 rounded-[1.15rem] border border-foreground/12 bg-background/42 px-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] backdrop-blur-xl md:min-h-[74px]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-foreground/12 bg-foreground/[0.055]">
                        <Icon className="h-5 w-5" strokeWidth={2.3} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-heading text-[1.65rem] uppercase leading-none tracking-normal text-foreground md:text-[2rem]">{item.label}</span>
                        <span className="mt-1 block truncate font-body text-xs font-black uppercase tracking-[0.12em] text-foreground/54">{item.value}</span>
                      </span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-foreground/60" strokeWidth={2.3} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative mt-8 grid gap-3 md:grid-cols-2">
            {launchCards.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.label}
                  className="group relative overflow-hidden rounded-[1.25rem] border border-foreground/12 bg-background/40 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] backdrop-blur-xl transition-colors hover:border-foreground/24 hover:bg-background/52"
                >
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.10),transparent_36%),linear-gradient(135deg,hsl(var(--foreground)/0.045),transparent_58%)]" />
                  <span className="relative flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-foreground/12 bg-foreground/[0.055] text-foreground">
                      <Icon className="h-5 w-5" strokeWidth={2.3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-body text-[10px] font-black uppercase tracking-[0.18em] text-foreground/54">{item.tag}</span>
                      <span className="mt-2 block font-heading text-[2.2rem] uppercase leading-none tracking-normal text-foreground md:text-[2.8rem]">{item.label}</span>
                      <span className="mt-2 block font-body text-sm font-semibold leading-snug text-foreground/64">{item.detail}</span>
                      <span className="mt-4 inline-flex min-h-[38px] items-center gap-2 rounded-full border border-foreground/12 bg-background/38 px-3 font-body text-[10px] font-black uppercase tracking-[0.12em] text-foreground/72">
                        {item.action} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.3} />
                      </span>
                    </span>
                  </span>
                </article>
              );
            })}
          </div>

          <div className="relative mt-8 grid gap-2 md:grid-cols-2">
            <PremiumButton
              as={Link}
              to="/book"
              className="inline-flex min-h-[62px] items-center justify-center gap-2 rounded-full bg-foreground px-6 font-body text-xs font-black uppercase tracking-[0.16em] text-background"
            >
              Book A Visit <ArrowRight className="h-4 w-4" strokeWidth={2.3} />
            </PremiumButton>
            <a
              href="mailto:support@avalonvitality.co?subject=Launch%20Recovery%20Inquiry"
              className="inline-flex min-h-[62px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/42 px-6 font-body text-xs font-black uppercase tracking-[0.16em] text-foreground backdrop-blur-xl transition-colors hover:border-foreground/28 hover:bg-background/54"
            >
              Contact Avalon <Mail className="h-4 w-4" strokeWidth={2.3} />
            </a>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}
