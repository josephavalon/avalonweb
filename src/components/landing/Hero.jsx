import React from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { ArrowRight, Droplets, LayoutGrid, UserRound } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';

const MotionLink = motion.create(Link);
const BOOK_URL = '/book';
const HERO_ACTIONS = [
  { to: BOOK_URL, label: 'Book', icon: Droplets, preload: () => import('@/pages/BookNow') },
  { to: '/protocols', label: 'Protocols', icon: LayoutGrid },
  { to: '/subscription', label: 'Plans', icon: UserRound },
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
          className="mb-3 font-body text-[11px] uppercase tracking-[0.34em] text-foreground/55 md:mb-4 md:text-xs"
        >
          Avalon Vitality
        </p>

        <h1
          className="font-heading text-display-xl text-foreground uppercase max-w-3xl"
        >
          Recovery<br />On Demand
        </h1>

        <p
          className="font-body text-[13px] md:text-sm leading-relaxed mt-5 md:mt-6 uppercase tracking-[0.16em]"
          style={{ color: 'hsl(var(--foreground) / 0.66)' }}
        >
          Bay Area.<br />Licensed RNs.<br />At home.
        </p>
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
                className="group relative flex min-h-[72px] w-full items-center justify-between gap-3 overflow-hidden rounded-[1.05rem] border border-foreground/28 bg-background/[0.16] px-4 text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.14),0_18px_70px_hsl(var(--foreground)/0.14)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-base ease-editorial hover:border-foreground/42 hover:bg-foreground/[0.12] md:min-h-[96px] md:rounded-[1.45rem] md:px-4"
              >
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,hsl(var(--foreground)/0.13),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.07),transparent_55%,hsl(var(--foreground)/0.028))]" />
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-1/2 hidden w-1/2 bg-gradient-to-r from-transparent via-foreground/12 to-transparent md:block"
                  animate={{ x: ['0%', '320%'] }}
                  transition={{ duration: 0.72, delay: 0.28, ease: EASE }}
                />
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
