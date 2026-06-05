import React from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { ArrowRight, Droplets, Home, LayoutGrid, MapPin, ShieldPlus, UserRound, Zap } from 'lucide-react';
import { premiumHover, premiumTap } from '@/lib/motion';

const MotionLink = motion.create(Link);
const BOOK_URL = '/book';
const HERO_ACTIONS = [
  { to: BOOK_URL, label: 'Book', icon: Droplets, preload: () => import('@/pages/BookNow') },
  { to: '/protocols', label: 'IV Protocols', icon: LayoutGrid },
  { to: '/subscription', label: 'Plans', icon: UserRound },
];
const HERO_PROOF_POINTS = [
  { label: 'SF Bay Area.', icon: MapPin },
  { label: 'Licensed Registered Nurses.', icon: ShieldPlus },
  { label: 'At home.', icon: Home },
  { label: '60 Seconds Checkout.', icon: Zap },
];

export default function Hero() {
  React.useEffect(() => {
    const preload = () => import('@/pages/BookNow');
    const timer = window.setTimeout(preload, 450);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section
      className="hero-root relative flex flex-col overflow-hidden"
      style={{ position: 'relative' }}
    >
      <div className="relative z-10 flex flex-col flex-1 px-5 md:px-12 pt-24 md:pt-32">

        {/* Mobile: keep the revenue action inside the first viewport. */}
        <div className="h-[11svh] shrink-0 md:hidden" />

	        <div
	          className="relative w-full max-w-[42rem] md:max-w-6xl"
	        >
	          <div className="relative">
        <div className="md:max-w-xl">

        <p
          className="mb-3 font-body text-[11px] uppercase tracking-[0.34em] text-foreground md:mb-4 md:text-xs"
        >
          Avalon Vitality
        </p>

        <h1
          className="font-heading text-display-xl text-foreground uppercase max-w-3xl"
        >
          Recovery<br />On Demand
        </h1>

        <ul
          className="mt-5 grid gap-1.5 font-body text-[13px] uppercase leading-relaxed tracking-[0.16em] text-foreground md:mt-6 md:text-sm"
        >
          {HERO_PROOF_POINTS.map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2.15} aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        </div>

        <div
          className="relative mt-7 grid w-full max-w-[23rem] grid-cols-1 gap-2.5 md:mt-10 md:w-[74vw] md:max-w-[86rem] md:grid-cols-3 md:gap-3 xl:w-[56vw]"
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
                className="av-glass-card group relative flex min-h-[72px] w-full items-center justify-between gap-3 overflow-hidden rounded-[1.05rem] border px-4 text-foreground transition-all duration-base ease-editorial md:min-h-[96px] md:rounded-[1.45rem] md:px-4"
              >
                <span className="relative flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.075] text-foreground/86 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10)] backdrop-blur-xl md:h-12 md:w-12">
                    <Icon className="h-6 w-6" strokeWidth={2.15} />
                  </span>
                  <span className="min-w-0 whitespace-nowrap font-body text-[13px] font-black uppercase leading-none tracking-[0.12em] text-foreground md:text-[14px] md:tracking-[0.18em]">
                    {action.label}
                  </span>
                </span>
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.055] text-foreground transition-transform group-hover:translate-x-1">
                  <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                </span>
              </MotionLink>
            );
          })}
        </div>

        {/* Proof rail */}
          </div>
        </div>

        <div className="pb-10 md:pb-0 md:flex-1" />

      </div>
    </section>
  );
}
