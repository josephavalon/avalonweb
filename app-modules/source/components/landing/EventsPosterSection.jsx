import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, LayoutGroup } from '@/components/ui/PageTransitionMotion';
import { ArrowRight, Building2, Wine, Music, Crown, Check, ChevronDown } from 'lucide-react';
import { EASE, premiumExpandTransition, premiumHover, premiumTap } from '@/lib/motion';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import ScrollParallax from '@/components/ui/ScrollParallax';

const MotionLink = motion.create(Link);

// Home-page EVENTS module. Poster DNA — mirrors MembershipSection / TreatmentsTeaser
// row rhythm. Not a live feed — that's EventsSection. Each row deep-links into
// the /events planner with the type preselected.
const EVENT_TIERS = [
  {
    key: 'corporate',
    name: 'Corporate wellness',
    note: 'Employee Wellness • Meetings • Conferences',
    icon: Building2,
    href: '/events?type=Corporate',
    details: [
      'On-site IV drips & recovery',
      'Licensed nurses, HIPAA-compliant',
      'Executive offsites · conferences',
      'Invoice or PO billing',
    ],
  },
  {
    key: 'private',
    name: 'Private events',
    note: 'Birthdays • Weddings • Celebrations',
    icon: Wine,
    href: '/events?type=Private%20Party',
    details: [
      'Weddings · birthdays · milestones',
      'Recovery lounge setup',
      'Party bus & yacht coverage',
      'Discreet nurse staffing',
    ],
  },
  {
    key: 'festivals',
    name: 'Music festivals',
    note: 'Artists • Backstage • Crew Wellness',
    icon: Music,
    href: '/events?type=Festival',
    details: [
      'Artist & crew recovery',
      'On-site medical staffing',
      'Multi-day event coverage',
      'Backstage & green room service',
    ],
  },
  {
    key: 'vip',
    name: 'VIP & hospitality',
    note: 'Green Rooms • Talent • Backstage • Premium Service',
    icon: Crown,
    href: '/events?type=Concert',
    details: [
      'Green room & backstage coverage',
      'Talent & touring rider support',
      'Discreet, on-call nurse standby',
      'NDA-friendly, white-glove service',
    ],
  },
];

function EventTierRow({ tier, index, open, onToggle }) {
  const Icon = tier.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.84, ease: EASE, delay: index * 0.18, layout: premiumExpandTransition }}
      whileHover={premiumHover}
      className={`av-treatment-card relative overflow-hidden rounded-[1.55rem] border transition-colors duration-base ease-editorial ${open ? 'is-open' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="relative flex min-h-[92px] w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.04] text-foreground/70">
            <Icon className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-2xl uppercase leading-none tracking-[0.06em] text-foreground/82 md:text-3xl">{tier.name}</p>
            <p className="mt-1 font-body text-[11px] uppercase tracking-[0.14em] text-foreground/42">{tier.note}</p>
          </div>
        </div>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.06] text-foreground/52"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2} />
        </motion.span>
      </button>

      <SmoothDisclosure open={open}>
        <div className="border-t border-foreground/[0.08] px-5 pb-4 pt-3">
          <div className="grid gap-2 md:grid-cols-2">
            {tier.details.map((detail) => (
              <div key={detail} className="flex min-h-[38px] items-center gap-2 rounded-xl border border-foreground/[0.07] bg-background/80 px-3">
                <Check className="h-3.5 w-3.5 shrink-0 text-foreground/54" strokeWidth={1.9} />
                <span className="font-body text-[11px] leading-snug text-foreground/58">{detail}</span>
              </div>
            ))}
          </div>

          <MotionLink
            to={tier.href}
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 font-body text-sm uppercase tracking-[0.2em] text-background transition-colors duration-base ease-editorial"
          >
            Request quote
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </MotionLink>
        </div>
      </SmoothDisclosure>
    </motion.div>
  );
}

export default function EventsPosterSection() {
  const [openKey, setOpenKey] = useState(null);

  return (
    <section id="events" className="pt-10 pb-10 md:pt-16 md:pb-16 px-4 scroll-mt-20">
      <div className="max-w-6xl mx-auto">

        {/* Interstitial card — matches SectionInterstitial treatment */}
        <ScrollParallax className="mb-8 md:mb-10">
          <div className="av-treatment-card mx-auto max-w-3xl rounded-[1.3rem] border px-6 py-10 text-center md:px-10 md:py-14">
            <h3 className="font-heading text-h1 text-foreground tracking-tight leading-[0.92] uppercase [text-wrap:balance]">
              Does your event need a wellness lounge?
            </h3>
            <p className="mx-auto mt-4 max-w-xl font-body text-[11px] uppercase leading-relaxed tracking-[0.22em] text-foreground/55 md:text-xs">
              Nurse-run recovery lounges for conferences, music festivals, and backstage.
            </p>
          </div>
        </ScrollParallax>

        {/* Header — matches TreatmentsTeaser / Plans section-title pattern */}
        <ScrollParallax className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6 md:mb-10">
          <div>
            <h2 className="font-heading text-display text-foreground uppercase tracking-tight leading-[0.92]">Events</h2>
          </div>
        </ScrollParallax>

        {/* Rows */}
        <LayoutGroup id="events-tiers">
          <div className="space-y-2 mb-4">
            {EVENT_TIERS.map((tier, i) => (
              <EventTierRow
                key={tier.key}
                tier={tier}
                index={i}
                open={openKey === tier.key}
                onToggle={() => setOpenKey((c) => (c === tier.key ? null : tier.key))}
              />
            ))}
          </div>
        </LayoutGroup>

        <div className="mt-6">
          <MotionLink
            to="/events"
            whileHover={premiumHover}
            whileTap={premiumTap}
            style={{ background: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
            className="group w-full flex items-center justify-center gap-3 py-4 md:py-5 rounded-full font-heading text-xl uppercase leading-none tracking-[0.08em] md:text-2xl lg:text-[1.7rem] transition-transform duration-base ease-editorial active:scale-[0.99]"
          >
            Build my event
            <ArrowRight className="h-4 w-4 md:h-5 md:w-5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </MotionLink>
        </div>

      </div>
    </section>
  );
}
