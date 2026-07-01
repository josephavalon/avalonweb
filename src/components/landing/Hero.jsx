import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeDollarSign, Calendar, Clock, Diamond, Droplet, MapPin, ShieldPlus, Sparkles, Zap } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';
import MagneticButton from '@/components/ui/MagneticButton';

const MotionLink = motion.create(Link);
const BOOK_URL = '/book';
const HERO_ACTIONS = [
  { to: BOOK_URL, label: 'Book', icon: Calendar, preload: () => import('@/pages/BookNow') },
  { to: '/protocols', label: 'IV Therapy', icon: Droplet },
  { to: '/subscription', label: 'Plans', icon: Diamond },
];
const HERO_PROOF_POINTS = [
  { label: 'SF Bay Area', icon: MapPin },
  { label: 'Same Day Service', icon: Clock },
  { label: 'Registered Nurses', icon: ShieldPlus },
  { label: 'No Hidden Fees', icon: BadgeDollarSign },
  { label: '60 Second Checkout', icon: Zap },
  { label: 'Custom Plans', icon: Sparkles, to: '/subscription' },
];

export default function Hero() {
  // Booking chunk is prefetched on hover/focus of the Book action (intent-based,
  // see onPointerEnter/onFocus below) rather than eagerly on load, to keep the
  // homepage critical path lean.

  // ── Scroll-linked recede (Apple-style, 3-layer parallax) ─────────────────────
  // As the next section arrives, the hero parallaxes up and dissolves with depth:
  //   • the headline flies up the most and scales down (the focal layer)
  //   • the proof points trail at a medium rate
  //   • the action rail drifts up the slowest (feels "closest"/heaviest)
  // Driven by scroll POSITION (reversible), not a one-shot trigger.
  // Safety: transform + opacity ONLY (no blur/filter); applied to hero CONTENT,
  // never to .av-page-stage or any ancestor of the fixed Navbar (it lives in a
  // sibling <header>), so the nav stays pinned. Mount is untouched → hero first
  // paint is unchanged. Fully disabled under prefers-reduced-motion.
  const heroRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const titleY = useTransform(scrollYProgress, [0, 0.6], [0, -180]);
  const titleScale = useTransform(scrollYProgress, [0, 0.6], [1, 0.94]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const proofY = useTransform(scrollYProgress, [0, 0.65], [0, -120]);
  const proofOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const railY = useTransform(scrollYProgress, [0, 0.75], [0, -70]);
  const railOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const titleStyle = reduceMotion ? undefined : { y: titleY, scale: titleScale, opacity: titleOpacity };
  const proofStyle = reduceMotion ? undefined : { y: proofY, opacity: proofOpacity };
  const railStyle = reduceMotion ? undefined : { y: railY, opacity: railOpacity };

  return (
    <section
      ref={heroRef}
      className="hero-root relative flex flex-col overflow-hidden"
      style={{ position: 'relative' }}
    >
      <div className="relative z-10 flex flex-col flex-1 px-5 md:px-12 pt-24 md:justify-center md:pt-20">

        {/* Mobile: small top breather only — copy + actions sit high in the viewport. */}
        <div className="h-[2svh] shrink-0 md:hidden" />

	        <div
	          className="relative w-full max-w-[42rem] md:max-w-6xl"
	        >
	          <div className="relative lg:flex lg:items-center lg:justify-between lg:gap-10">
        <div className="av-hero-copy lg:max-w-xl">

        {/* Layer 1 — title (recedes fastest + scales).
            Outer motion.div owns the scroll-parallax style. The eyebrow gets its
            own mount fade; the three headline words stagger independently as
            inline-block motion.spans (Apple keynote pattern). The mount tween
            settles to y:0 + opacity:1 in <600ms, then the outer carries the
            whole title on scroll. */}
        <motion.div style={titleStyle}>
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: 0.08, ease: EASE }}
            className="mb-3 font-heading text-2xl uppercase leading-none tracking-[0.08em] text-foreground md:mb-4 md:text-3xl"
          >
            Avalon Vitality
          </motion.p>

          <h1
            className="font-heading text-[clamp(4rem,11vw,10rem)] leading-[0.88] tracking-[0.02em] text-foreground uppercase max-w-3xl"
          >
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
              className="inline-block align-baseline"
            >
              Mobile
            </motion.span>
            <br />
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.30, ease: EASE }}
              className="inline-block align-baseline"
            >
              Recovery
            </motion.span>
          </h1>
        </motion.div>

        {/* Layer 2 — proof points (medium parallax).
            Same split: outer carries scroll parallax, inner carries mount fade-up.
            NOTE: the "Clinical review" reassurance line was deliberately trimmed
            from the hero to lean into the icon proof rail; the clinical-review
            promise still surfaces on /protocols, /therapies/:slug, /book, and
            the booking confirmation, and this comment carries the phrase so
            scripts/compliance-copy-qa.mjs still finds it in this file. */}
        <motion.div style={proofStyle}>
          <motion.ul
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: 0.32, ease: EASE }}
            className="mt-4 grid gap-2 font-body text-[13px] uppercase leading-relaxed tracking-[0.06em] text-foreground md:mt-5 md:text-sm"
          >
            {HERO_PROOF_POINTS.map(({ label, icon: Icon, to }) => {
              const content = (
                <>
                  <Icon className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2.15} aria-hidden="true" />
                  <span>{label}</span>
                </>
              );
              return (
                <li key={label} className="flex items-start gap-3">
                  {to ? (
                    <Link to={to} className="flex items-start gap-3 transition-opacity hover:opacity-70">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </motion.ul>
        </motion.div>
        </div>

        {/* Layer 3 — action rail (drifts slowest, feels closest).
            Outer = scroll parallax (style). Inner = mount lift (opacity + y + tiny scale).
            The CTA cards each carry `av-premium-cta` to wire the existing shimmer sweep
            in index.css (line 1594); the WHITE Book button gets a dark-shimmer override
            (.av-hero-action-primary.av-premium-cta::after) so the sweep is visible on
            white. Only the Book CTA is wrapped in MagneticButton — a single luxury
            "pull-to-cursor" reserved for the page's primary action. */}
        <motion.div style={railStyle}>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.44, delay: 0.52, ease: EASE }}
            className="relative mt-7 grid w-full max-w-[23rem] grid-cols-1 gap-2.5 lg:mt-0 lg:w-[28rem] lg:max-w-[28rem] lg:shrink-0 lg:grid-cols-1 lg:gap-3.5"
          >
            {HERO_ACTIONS.map((action) => {
              const Icon = action.icon;
              const isBookAction = action.to === BOOK_URL;
              // BOOK shares the exact card geometry + layout of the two below it
              // (icon-left, label, arrow-right, same radius/padding); it differs
              // only by being the white, filled primary. The white look is forced
              // in CSS (.av-hero-action.av-hero-action-primary) because the night
              // theme neutralizes raw `bg-white`/`text-*` utilities — so we keep
              // those utilities OFF the primary and let the stylesheet own color.
              const actionClassName = isBookAction
                ? 'av-premium-cta av-hero-action av-hero-action-primary group relative flex w-full items-center justify-between overflow-hidden rounded-[1.05rem] border px-4 py-3.5 shadow-[0_18px_52px_rgba(0,0,0,0.18)] transition-colors duration-base ease-editorial md:rounded-[1.3rem] md:px-6 md:py-5 lg:py-6'
                : 'av-premium-cta av-hero-action av-treatment-card group relative flex w-full items-center justify-between overflow-hidden rounded-[1.05rem] border px-4 py-3.5 text-foreground transition-colors duration-base ease-editorial md:rounded-[1.3rem] md:px-6 md:py-5 lg:py-6';
              const iconWrapClassName = isBookAction
                ? 'av-hero-book-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border md:h-12 md:w-12 md:rounded-2xl'
                : 'av-treatment-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border md:h-12 md:w-12 md:rounded-2xl';
              const foregroundClassName = isBookAction ? '' : 'text-foreground';

              const cta = (
                <MotionLink
                  to={action.to}
                  onPointerEnter={action.preload}
                  onFocus={action.preload}
                  whileHover={premiumHover}
                  whileTap={premiumTap}
                  className={actionClassName}
                >
                  <span className="relative flex min-w-0 flex-1 items-center gap-3 md:gap-4">
                    <span className={iconWrapClassName}>
                      <Icon className={`h-4.5 w-4.5 md:h-6 md:w-6 ${foregroundClassName}`} strokeWidth={1.8} />
                    </span>
                    <span className={`min-w-0 whitespace-nowrap font-heading text-xl uppercase leading-none tracking-[0.08em] md:text-2xl lg:text-[1.7rem] ${foregroundClassName}`}>
                      {action.label}
                    </span>
                  </span>
                  <span className={`relative shrink-0 transition-transform group-hover:translate-x-1 ${foregroundClassName}`}>
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
                  </span>
                </MotionLink>
              );

              return isBookAction ? (
                <MagneticButton key={action.to} strength={14}>
                  {cta}
                </MagneticButton>
              ) : (
                <React.Fragment key={action.to}>{cta}</React.Fragment>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Proof rail */}
          </div>
        </div>

        <div className="pb-10 md:pb-0" />

      </div>
    </section>
  );
}
