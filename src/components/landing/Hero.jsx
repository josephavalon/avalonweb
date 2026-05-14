import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, ChevronDown, ArrowRight } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

export default function Hero() {
  const ref = useRef(null);
  // Mobile check: evaluated once at mount — never changes within a session.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Always call hooks (Rules of Hooks), but only attach ref on desktop so
  // useScroll tracks nothing on mobile — no scroll listener, no rAF overhead.
  const { scrollYProgress } = useScroll({ target: isMobile ? { current: null } : ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.6], [0, 0.3]);

  return (
    <section
      ref={isMobile ? null : ref}
      className="hero-root relative min-h-[100svh] flex flex-col overflow-hidden"
    >
      {/* Background photo — parallax on desktop only; static div on mobile for performance */}
      <motion.div
        style={isMobile ? undefined : { y }}
        className={`absolute inset-0 pointer-events-none${isMobile ? '' : ' will-change-transform'}`}
      >
        <img
          src="https://media.base44.com/images/public/69e5682f98e509792c71ef21/3a0a1cbc3_winner.png"
          alt="Avalon Vitality IV therapy"
          className="w-full h-full object-cover"
          style={{ objectPosition: '30% 55%', transform: 'scale(1.22)', transformOrigin: '38% 62%' }}
          loading="eager"
          fetchpriority="high"
        />
        {/* Base wash — unified across all themes */}
        <div className="absolute inset-0 bg-background/65" />
        {/* Stronger left fade so text always pops — especially in dubs/golden */}
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/45 to-transparent" />
        {/* Bottom fade to page — single gradient only */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0a]" />
      </motion.div>

      {/* Scroll-driven darkening — desktop only */}
      {!isMobile && (
        <motion.div
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 bg-background pointer-events-none"
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 px-5 md:px-12 lg:px-20 pt-28 md:pt-32 pb-0">

        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
          className="mb-4 md:mb-5 flex flex-col gap-2.5"
        >
          {/* Region chip — expandable to future markets */}
          <button
            type="button"
            title="More regions coming soon"
            className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full border border-foreground/[0.15] bg-transparent hover:bg-background/30 transition-colors"
          >
            <MapPin className="w-3 h-3 shrink-0 text-accent" strokeWidth={2} />
            <span className="font-body text-[10px] tracking-[0.25em] text-foreground uppercase">
              SF Bay Area
            </span>
            <ChevronDown className="w-3 h-3 text-foreground/40" strokeWidth={2} />
          </button>
          {/* Social proof chip */}
          <div className="inline-flex items-center gap-1.5 self-start">
            <span className="text-accent text-[11px]">★★★★★</span>
            <span className="font-body text-[10px] tracking-[0.2em] text-foreground/55 uppercase">
              4.9 · 200+ sessions delivered
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
          className="font-heading text-[15vw] sm:text-[12vw] md:text-[9vw] lg:text-[8rem] leading-[0.88] tracking-tight text-foreground uppercase max-w-3xl"
        >
          Recovery<br />On Demand
        </motion.h1>

        {/* Accent divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
          style={{ transformOrigin: 'left' }}
          className="w-10 h-[2px] bg-accent mt-4"
        />

        {/* Sub-headline — trust credential, not marketing copy */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
          className="font-body text-[11px] md:text-xs tracking-[0.3em] text-foreground/70 uppercase mt-4 md:mt-5"
        >
          Licensed RN · Delivered to you
        </motion.p>

        {/* Price anchor — removes friction for first-timers */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.52, ease: EASE }}
          className="font-body text-[10px] tracking-[0.25em] text-foreground/40 uppercase mt-2"
        >
          From $150 · No membership required
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.58, ease: EASE }}
          className="flex flex-col gap-3 mt-7 md:mt-8 w-full max-w-xs"
        >
          <Link
            to="/store"
            className="w-full flex items-center justify-between px-6 py-4 font-body text-xs tracking-[0.2em] uppercase font-semibold rounded-full bg-foreground text-background hover:bg-foreground/85 transition-colors"
          >
            <span>BUY NOW</span>
            <ArrowRight className="w-4 h-4 ml-2 inline" />
          </Link>
          <Link
            to="/membership"
            className="w-full flex items-center justify-between px-6 py-4 font-body text-xs tracking-[0.2em] uppercase font-semibold rounded-full border border-foreground/30 text-foreground hover:bg-foreground/[0.06] hover:border-foreground/60 transition-colors"
          >
            <span>SUBSCRIBE & SAVE</span>
            <ArrowRight className="w-4 h-4 ml-2 inline" />
          </Link>
        </motion.div>

        <div className="flex-1 min-h-[3rem]" />

      </div>


    </section>
  );
}
