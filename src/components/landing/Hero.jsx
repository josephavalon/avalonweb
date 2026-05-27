import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { EASE, premiumFadeUp, premiumHover, premiumTap } from '@/lib/motion';

const MotionLink = motion(Link);

export default function Hero() {
  const ref = useRef(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const { scrollYProgress } = useScroll({ target: isMobile ? { current: null } : ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.6], [0, 0.3]);

  return (
    <section
      ref={isMobile ? null : ref}
      className="hero-root relative min-h-[100svh] flex flex-col overflow-hidden"
      style={{ position: 'relative' }}
    >
      <motion.div
        style={isMobile ? undefined : { y }}
        className={`absolute inset-0 pointer-events-none${isMobile ? '' : ' will-change-transform'}`}
      >
        <motion.img
          src="/images/avalon-hero.webp"
          srcSet="/images/avalon-hero-512.webp 512w, /images/avalon-hero-768.webp 768w, /images/avalon-hero.webp 1024w"
          sizes="100vw"
          alt="Avalon Vitality mobile recovery"
          width="1024"
          height="683"
          className="w-full h-full object-cover"
          style={{ objectPosition: '30% 55%', transformOrigin: '38% 62%' }}
          initial={{ scale: 1.06 }}
          animate={{ scale: 1.0 }}
          transition={{ duration: 3.2, ease: EASE }}
          loading="eager"
        />
        <div className="absolute inset-0 bg-background/65" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/45 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-[32rem] bg-gradient-to-t from-background from-20% via-background/60 via-60% to-transparent pointer-events-none" />
      </motion.div>

      {!isMobile && (
        <motion.div
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 bg-background pointer-events-none"
        />
      )}

      <div className="relative z-10 flex flex-col flex-1 px-5 md:px-12 pt-24 md:pt-32">

        {/* Mobile: fixed spacer keeps the CTA inside the first viewport. */}
        <div className="h-[28svh] shrink-0 md:hidden" />

        <motion.p
          {...premiumFadeUp(0.18)}
          initial={{ opacity: 0, y: 10 }}
          className="font-body text-[15px] tracking-[0.34em] uppercase mb-3 md:mb-5"
          style={{ color: 'hsl(var(--foreground) / 0.44)' }}
        >
          Avalon
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
          Clinical recovery. Delivered.
        </motion.p>

        <motion.div
          {...premiumFadeUp(0.98)}
          initial={{ opacity: 0, y: 22 }}
          transition={{ duration: 1.05, delay: 0.98, ease: EASE }}
          className="flex flex-col gap-2.5 mt-5 md:mt-8 w-full max-w-[19rem]"
        >
          <MotionLink
            to="/book"
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group w-full flex min-h-[54px] items-center justify-between px-5 font-body text-[11px] tracking-[0.24em] uppercase font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-base ease-editorial shadow-[0_18px_60px_hsl(var(--foreground)/0.14)]"
          >
            <span>Choose Your Protocol</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-base ease-editorial group-hover:translate-x-1" />
          </MotionLink>
          <MotionLink
            to="/subscription"
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group w-full flex min-h-[54px] items-center justify-between px-5 font-body text-[11px] tracking-[0.24em] uppercase font-semibold rounded-xl bg-white/[0.025] border border-foreground/22 text-foreground/76 hover:bg-white/[0.08] hover:border-foreground/45 hover:text-foreground transition-all duration-base ease-editorial backdrop-blur-sm"
          >
            <span>Plans</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-base ease-editorial group-hover:translate-x-1" />
          </MotionLink>
        </motion.div>

        {/* Proof rail */}
        <motion.div
          {...premiumFadeUp(1.18)}
          initial={{ opacity: 0, y: 14 }}
          transition={{ duration: 1.0, delay: 1.18, ease: EASE }}
          className="mt-5 flex w-full max-w-[19rem] flex-wrap gap-x-4 gap-y-2 md:mt-8 md:max-w-none"
        >
          {['Licensed clinicians', 'Clinical review', 'Mobile'].map((label) => (
            <span key={label} className="font-body text-[10px] uppercase tracking-[0.24em] text-foreground/42">
              {label}
            </span>
          ))}
        </motion.div>

        <div className="pb-10 md:pb-0 md:flex-1" />

      </div>
    </section>
  );
}
