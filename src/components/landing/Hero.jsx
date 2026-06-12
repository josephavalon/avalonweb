import React from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeDollarSign, Calendar, Clock, Diamond, Droplet, MapPin, ShieldPlus, Zap } from 'lucide-react';
import { premiumHover, premiumTap } from '@/lib/motion';

const MotionLink = motion.create(Link);
const BOOK_URL = '/book';
const HERO_ACTIONS = [
  { to: BOOK_URL, label: 'Book', icon: Calendar, preload: () => import('@/pages/BookNow') },
  { to: '/protocols', label: 'IV Therapy', icon: Droplet },
  { to: '/subscription', label: 'Plans', icon: Diamond },
];
const HERO_PROOF_POINTS = [
  { label: 'SF Bay Area', icon: MapPin },
  { label: 'Registered Nurses', icon: ShieldPlus },
  { label: 'Clinical Review', icon: ShieldPlus },
  { label: 'Same Day Service', icon: Clock },
  { label: '60 Second Checkout', icon: Zap },
  { label: 'No Hidden Fees', icon: BadgeDollarSign },
];

export default function Hero() {
  // Booking chunk is prefetched on hover/focus of the Book action (intent-based,
  // see onPointerEnter/onFocus below) rather than eagerly on load, to keep the
  // homepage critical path lean.
  return (
    <section
      className="hero-root relative flex flex-col overflow-hidden"
      style={{ position: 'relative' }}
    >
      <div className="relative z-10 flex flex-col flex-1 px-5 md:px-12 pt-24 md:justify-center md:pt-20">

        {/* Mobile: keep the revenue action inside the first viewport. */}
        <div className="h-[11svh] shrink-0 md:hidden" />

	        <div
	          className="relative w-full max-w-[42rem] md:max-w-6xl"
	        >
	          <div className="relative md:flex md:items-center md:justify-between md:gap-10">
        <div className="av-hero-copy md:max-w-xl">

        <p
          className="mb-3 font-heading text-2xl uppercase leading-none tracking-[0.08em] text-foreground md:mb-4 md:text-3xl"
        >
          Avalon Vitality
        </p>

        <h1
          className="font-heading text-[clamp(4rem,11vw,10rem)] leading-[0.88] tracking-[0.02em] text-foreground uppercase max-w-3xl"
        >
          Recovery<br />On Demand
        </h1>

        <ul
          className="mt-5 grid gap-2 font-body text-[13px] uppercase leading-relaxed tracking-[0.06em] text-foreground md:mt-6 md:text-sm"
        >
          {HERO_PROOF_POINTS.map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-start gap-3">
              <Icon className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2.15} aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        </div>

        <div
          className="relative mt-7 grid w-full max-w-[23rem] grid-cols-1 gap-2.5 md:mt-0 md:w-[25rem] md:max-w-[25rem] md:shrink-0 md:grid-cols-1 md:gap-3.5 lg:w-[28rem] lg:max-w-[28rem]"
        >
          {HERO_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <MotionLink
                key={action.to}
                to={action.to}
                onPointerEnter={action.preload}
                onFocus={action.preload}
                whileHover={premiumHover}
                whileTap={premiumTap}
                className="av-hero-action av-treatment-card group relative flex w-full items-center justify-between overflow-hidden rounded-[1.05rem] border px-4 py-3.5 text-foreground transition-colors duration-base ease-editorial md:rounded-[1.3rem] md:px-6 md:py-5 lg:py-6"
              >
                <span className="relative flex min-w-0 flex-1 items-center gap-3 md:gap-4">
                  <span className="av-treatment-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border md:h-12 md:w-12 md:rounded-2xl">
                    <Icon className="h-4.5 w-4.5 text-foreground md:h-6 md:w-6" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 whitespace-nowrap font-heading text-xl uppercase leading-none tracking-[0.08em] text-foreground md:text-2xl lg:text-[1.7rem]">
                    {action.label}
                  </span>
                </span>
                <span className="relative shrink-0 text-foreground transition-transform group-hover:translate-x-1">
                  <ArrowRight className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
                </span>
              </MotionLink>
            );
          })}
        </div>

        {/* Proof rail */}
          </div>
        </div>

        <div className="pb-10 md:pb-0" />

      </div>
    </section>
  );
}
