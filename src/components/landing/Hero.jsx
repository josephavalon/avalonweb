import React from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { EASE, premiumFadeUp, premiumHover, premiumTap } from '@/lib/motion';

const MotionLink = motion.create(Link);

export default function Hero() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <section
      className="hero-root relative min-h-[100svh] flex flex-col overflow-hidden"
      style={{ position: 'relative' }}
    >
      <motion.div
        style={undefined}
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

      {!isMobile && <div className="absolute inset-0 bg-background/0 pointer-events-none" />}

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
          Your protocol.<br />Delivered by an RN.
        </motion.p>

        <motion.div
          {...premiumFadeUp(0.98)}
          initial={{ opacity: 0, y: 22 }}
          transition={{ duration: 1.05, delay: 0.98, ease: EASE }}
          className="flex w-full max-w-[38rem] flex-col gap-3 mt-5 md:mt-8"
        >
          <MotionLink
            to="/book"
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group flex min-h-[64px] w-full items-center justify-between rounded-[18px] bg-foreground px-6 font-body text-[11px] font-semibold uppercase tracking-[0.24em] text-background shadow-[0_18px_60px_hsl(var(--foreground)/0.14)] transition-all duration-base ease-editorial hover:bg-foreground/90 md:min-h-[72px] md:px-8"
          >
            <span>Choose Protocol</span>
            <ArrowRight className="h-5 w-5 transition-transform duration-base ease-editorial group-hover:translate-x-1" />
          </MotionLink>
          <MotionLink
            to="/subscription"
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group flex min-h-[64px] w-full items-center justify-between rounded-[18px] border border-foreground/22 bg-white/[0.025] px-6 font-body text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/76 backdrop-blur-sm transition-all duration-base ease-editorial hover:border-foreground/45 hover:bg-white/[0.08] hover:text-foreground md:min-h-[72px] md:px-8"
          >
            <span>Plans</span>
            <ArrowRight className="h-5 w-5 transition-transform duration-base ease-editorial group-hover:translate-x-1" />
          </MotionLink>
        </motion.div>

        {/* Proof rail */}
        <motion.div
          {...premiumFadeUp(1.18)}
          initial={{ opacity: 0, y: 14 }}
          transition={{ duration: 1.0, delay: 1.18, ease: EASE }}
          className="mt-5 flex w-full max-w-[38rem] flex-wrap gap-x-4 gap-y-2 md:mt-8 md:max-w-none"
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
