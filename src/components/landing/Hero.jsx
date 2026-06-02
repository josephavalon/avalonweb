import React from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Droplets } from 'lucide-react';
import { EASE, premiumFadeUp, premiumHover, premiumTap } from '@/lib/motion';

const MotionLink = motion.create(Link);

export default function Hero() {
  const navigate = useNavigate();
  const bookTouchStart = React.useRef(null);
  const subscriptionTouchStart = React.useRef(null);

  React.useEffect(() => {
    const preload = () => import('@/pages/BookNow');
    const timer = window.setTimeout(preload, 450);
    return () => window.clearTimeout(timer);
  }, []);

  const handleBookPointerDown = (event) => {
    if (event.pointerType === 'touch') {
      bookTouchStart.current = { x: event.clientX, y: event.clientY };
    }
  };

  const handleBookPointerUp = (event) => {
    handleTouchNavigation(event, bookTouchStart, '/book');
  };

  const handleSubscriptionPointerDown = (event) => {
    if (event.pointerType === 'touch') {
      subscriptionTouchStart.current = { x: event.clientX, y: event.clientY };
    }
  };

  const handleSubscriptionPointerUp = (event) => {
    handleTouchNavigation(event, subscriptionTouchStart, '/subscription');
  };

  const handleTouchNavigation = (event, startRef, path) => {
    if (event.pointerType !== 'touch' || !startRef.current) return;
    const deltaX = Math.abs(event.clientX - startRef.current.x);
    const deltaY = Math.abs(event.clientY - startRef.current.y);
    startRef.current = null;
    if (deltaX > 12 || deltaY > 12) return;
    event.preventDefault();
    navigate(path);
  };

  return (
    <section
      className="hero-root relative flex flex-col overflow-hidden"
      style={{ position: 'relative' }}
    >
      <div className="relative z-10 flex flex-col flex-1 px-5 md:px-12 pt-24 md:pt-32">

        {/* Mobile: fixed spacer keeps the CTA inside the first viewport. */}
        <div className="h-[28svh] shrink-0 md:hidden" />

	        <motion.div
	          {...premiumFadeUp(0.1)}
	          initial={{ opacity: 0, y: 18, scale: 0.985 }}
	          transition={{ duration: 1.05, delay: 0.1, ease: EASE }}
	          className="relative w-full max-w-[42rem] md:max-w-6xl"
	        >
	          <div className="relative md:grid md:grid-cols-[1fr_auto] md:items-center md:gap-12 lg:gap-16">
        <div className="md:max-w-xl">

        <motion.p
          {...premiumFadeUp(0.28)}
          className="mb-3 font-body text-[11px] uppercase tracking-[0.34em] text-foreground/55 md:mb-4 md:text-xs"
        >
          Avalon Vitality
        </motion.p>

        <motion.h1
          {...premiumFadeUp(0.38)}
          initial={{ opacity: 0, y: 38 }}
          transition={{ duration: 1.6, delay: 0.38, ease: EASE }}
          className="font-heading text-display-xl text-foreground uppercase max-w-3xl"
          style={{ willChange: 'opacity, transform' }}
        >
          Recovery<br />On Demand
        </motion.h1>

        <motion.p
          {...premiumFadeUp(0.72)}
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 1.15, delay: 0.72, ease: EASE }}
          className="font-body text-[13px] md:text-sm leading-relaxed mt-5 md:mt-6 uppercase tracking-[0.16em]"
          style={{ color: 'hsl(var(--foreground) / 0.66)' }}
        >
          Your protocol.<br />Delivered by an RN.<br />SF Bay Area.
        </motion.p>
        </div>

        <motion.div
          {...premiumFadeUp(0.98)}
          initial={{ opacity: 0, y: 22 }}
          transition={{ duration: 1.05, delay: 0.98, ease: EASE }}
          className="relative mt-5 flex w-full max-w-[19rem] flex-col gap-2.5 md:mt-0 md:max-w-[38rem] md:gap-3 md:overflow-hidden md:rounded-[1.9rem] md:border md:border-foreground/16 md:bg-background/18 md:p-3 md:shadow-[inset_0_1px_0_hsl(var(--foreground)/0.18),0_28px_120px_hsl(var(--foreground)/0.13)] md:backdrop-blur-2xl md:backdrop-saturate-150"
        >
          <span className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_15%_0%,hsl(var(--foreground)/0.17),transparent_38%),radial-gradient(circle_at_88%_88%,hsl(var(--foreground)/0.08),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.08),transparent_50%,hsl(var(--foreground)/0.034))] md:block" />
          <span className="pointer-events-none absolute inset-x-5 top-0 hidden h-px bg-gradient-to-r from-transparent via-foreground/34 to-transparent md:block" />
          <span className="pointer-events-none absolute inset-x-8 bottom-0 hidden h-px bg-gradient-to-r from-transparent via-background/50 to-transparent md:block" />
          <MotionLink
            to="/book"
            onPointerEnter={() => import('@/pages/BookNow')}
            onFocus={() => import('@/pages/BookNow')}
            initial={{ opacity: 0, y: 22, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.95, delay: 1.18, ease: EASE }}
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group relative flex min-h-[54px] w-full items-center justify-between gap-4 overflow-hidden rounded-xl border border-foreground bg-foreground px-5 text-background shadow-[0_18px_60px_hsl(var(--foreground)/0.14)] transition-all duration-base ease-editorial hover:bg-foreground/90 md:min-h-[118px] md:rounded-[1.55rem] md:border-foreground/38 md:bg-foreground/[0.13] md:p-5 md:text-foreground md:shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_28px_105px_hsl(var(--foreground)/0.17)] md:backdrop-blur-2xl md:backdrop-saturate-150 md:hover:border-foreground/48 md:hover:bg-foreground/[0.16]"
          >
            <span className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_18%_12%,hsl(var(--foreground)/0.18),transparent_34%),radial-gradient(circle_at_90%_80%,hsl(var(--foreground)/0.07),transparent_32%),linear-gradient(145deg,hsl(var(--foreground)/0.08),transparent_52%,hsl(var(--foreground)/0.032))] opacity-95 md:block" />
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/2 hidden w-1/2 bg-gradient-to-r from-transparent via-foreground/16 to-transparent md:block"
              animate={{ x: ['0%', '320%'] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: EASE, repeatDelay: 1.1 }}
            />
            <span className="relative flex min-w-0 items-center gap-4">
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-foreground/30 bg-foreground/[0.11] text-foreground shadow-[0_16px_42px_hsl(var(--foreground)/0.12),inset_0_1px_0_hsl(var(--foreground)/0.10)] backdrop-blur-xl md:flex md:h-16 md:w-16">
                <Droplets className="h-7 w-7" strokeWidth={2.45} />
              </span>
              <span className="min-w-0">
                <span className="block font-body text-[11px] font-semibold uppercase leading-none tracking-[0.24em] md:font-heading md:text-[2.35rem] md:font-black md:tracking-normal">Book Now</span>
                <span className="mt-1 hidden font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground/58 md:block">Choose protocol</span>
              </span>
            </span>
            <span className="relative flex shrink-0 items-center justify-center text-background transition-transform group-hover:translate-x-1 md:h-12 md:w-12 md:rounded-full md:border md:border-foreground/24 md:bg-foreground/[0.10] md:text-foreground md:shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
              <ArrowRight className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.4} />
            </span>
          </MotionLink>
        </motion.div>

        <p className="mt-4 font-body text-[10px] uppercase tracking-[0.22em] text-foreground/40 md:mt-5">
          Every visit begins with clinical review.
        </p>

        {/* Proof rail */}
          </div>
        </motion.div>

        <div className="pb-10 md:pb-0 md:flex-1" />

      </div>
    </section>
  );
}
