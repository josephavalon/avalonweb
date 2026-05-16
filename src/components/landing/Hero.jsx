import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

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
        <img
          src="https://media.base44.com/images/public/69e5682f98e509792c71ef21/3a0a1cbc3_winner.png"
          alt="Avalon Vitality IV therapy"
          className="w-full h-full object-cover"
          style={{ objectPosition: '30% 55%', transform: 'scale(1.22)', transformOrigin: '38% 62%' }}
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

      <div className="relative z-10 flex flex-col flex-1 px-5 md:px-12 lg:px-20 pt-24 md:pt-32">

        {/* Mobile: flex spacer pushes content to lower half */}
        <div className="flex-1 md:hidden" />

        <motion.p
          initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
          className="font-body text-[16px] tracking-[0.3em] text-foreground/60 uppercase mb-3 md:mb-5"
        >
          Avalon Vitality
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 64, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, delay: 0.32, ease: EASE }}
          className="font-heading text-[15vw] sm:text-[12vw] md:text-[9vw] lg:text-[8rem] leading-[0.88] tracking-tight text-foreground uppercase max-w-3xl"
        >
          Recovery<br />On Demand
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.62, ease: EASE }}
          className="font-body text-base md:text-lg text-foreground/80 leading-snug mt-4 md:mt-6"
        >
          Your protocol.<br />Delivered by a licensed RN.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.85, delay: 0.88, ease: EASE }}
          className="flex flex-col gap-3 mt-7 md:mt-8 w-full max-w-sm"
        >
          <Link
            to="/newsletter"
            className="w-full flex items-center justify-between px-6 py-4 font-body text-xs tracking-[0.15em] uppercase font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors"
          >
            <span>Buy Now</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/newsletter"
            className="w-full flex items-center justify-between px-6 py-4 font-body text-xs tracking-[0.15em] uppercase font-semibold rounded-xl bg-transparent border border-foreground/40 text-foreground hover:bg-white/10 transition-colors"
          >
            <span>Subscribe & Save</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="pb-10 md:pb-0 md:flex-1" />

      </div>
    </section>
  );
}
