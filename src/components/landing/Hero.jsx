import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Tag, MapPin } from 'lucide-react';
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
          src="https://media.base44.com/images/public/69e5682f98e509792c71ef21/3a0a1cbc3_winner.png"
          alt="Avalon Vitality IV therapy"
          className="w-full h-full object-cover"
          style={{ objectPosition: '30% 55%', transformOrigin: '38% 62%' }}
          initial={{ scale: 1.28 }}
          animate={{ scale: 1.22 }}
          transition={{ duration: 3.2, ease: EASE }}
          loading="eager"
          fetchpriority="high"
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

        {/* Mobile: flex spacer pushes content to lower half */}
        <div className="flex-1 md:hidden" />

        <motion.p
          {...premiumFadeUp(0.18)}
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          className="font-body text-[16px] tracking-[0.3em] uppercase mb-3 md:mb-5"
          style={{ color: 'hsl(var(--foreground) / 0.5)' }}
        >
          Avalon Vitality
        </motion.p>

        <motion.h1
          {...premiumFadeUp(0.38)}
          initial={{ opacity: 0, y: 38, filter: 'blur(12px)' }}
          transition={{ duration: 1.6, delay: 0.38, ease: EASE }}
          className="font-heading text-[15vw] sm:text-[12vw] md:text-[9vw] lg:text-[8rem] leading-[0.88] tracking-tight text-foreground uppercase max-w-3xl"
          style={{ willChange: 'opacity, transform' }}
        >
          Recovery<br />On Demand
        </motion.h1>

        <motion.p
          {...premiumFadeUp(0.72)}
          initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
          transition={{ duration: 1.15, delay: 0.72, ease: EASE }}
          className="font-body text-base md:text-lg leading-snug mt-4 md:mt-6"
          style={{ color: 'hsl(var(--foreground) / 0.75)' }}
        >
          Your protocol.<br />Delivered by a licensed RN.<br />At home, hotel, office, or event.
        </motion.p>

        <motion.div
          {...premiumFadeUp(0.98)}
          initial={{ opacity: 0, y: 22, filter: 'blur(7px)' }}
          transition={{ duration: 1.05, delay: 0.98, ease: EASE }}
          className="flex flex-col gap-3 mt-7 md:mt-8 w-full max-w-sm"
        >
          <MotionLink
            to="/book"
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group w-full flex items-center justify-between px-6 py-4 font-body text-xs tracking-[0.15em] uppercase font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-base ease-editorial shadow-[0_18px_60px_hsl(var(--foreground)/0.14)]"
          >
            <span>Buy Now</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-base ease-editorial group-hover:translate-x-1" />
          </MotionLink>
          <MotionLink
            to="/subscription"
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group w-full flex items-center justify-between px-6 py-4 font-body text-xs tracking-[0.15em] uppercase font-semibold rounded-xl bg-white/[0.03] border border-foreground/35 text-foreground hover:bg-white/[0.10] hover:border-foreground/55 transition-all duration-base ease-editorial backdrop-blur-sm"
          >
            <span>Subscribe & Save 10%</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-base ease-editorial group-hover:translate-x-1" />
          </MotionLink>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          {...premiumFadeUp(1.18)}
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          transition={{ duration: 1.0, delay: 1.18, ease: EASE }}
          className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-8 md:mt-10"
        >
          {[
            { icon: Tag,    label: 'No Hidden Fees' },
            { icon: MapPin, label: 'SF Bay Area' },
          ].map(({ icon: Icon, label }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <span className="hidden sm:block w-px h-3.5 bg-foreground/20" />}
              <span className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-foreground/45" strokeWidth={1.6} />
                <span className="font-body text-[11px] tracking-[0.12em] text-foreground/55 uppercase">{label}</span>
              </span>
            </React.Fragment>
          ))}
        </motion.div>

        <div className="pb-10 md:pb-0 md:flex-1" />

      </div>
    </section>
  );
}
