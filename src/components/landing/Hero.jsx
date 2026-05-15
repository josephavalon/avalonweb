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
      className="hero-root relative min-h-0 md:min-h-[100svh] flex flex-col overflow-hidden"
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
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
      </motion.div>

      {!isMobile && (
        <motion.div
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 bg-background pointer-events-none"
        />
      )}

      <div className="relative z-10 flex flex-col flex-1 px-5 md:px-12 lg:px-20 pt-20 md:pt-32 pb-8 md:pb-0">

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="font-body text-[11px] tracking-[0.3em] text-accent uppercase mb-4 md:mb-5"
        >
          Avalon Vitality
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
          className="font-heading text-[15vw] sm:text-[12vw] md:text-[9vw] lg:text-[8rem] leading-[0.88] tracking-tight text-foreground uppercase max-w-3xl"
        >
          Recovery<br />On Demand
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
          style={{ transformOrigin: 'left' }}
          className="w-10 h-[2px] bg-accent mt-4"
        />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
          className="font-body text-[11px] md:text-xs tracking-[0.3em] text-foreground/70 uppercase mt-3 md:mt-5"
        >
          Licensed RN · Delivered to you
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.52, ease: EASE }}
          className="font-body text-[10px] tracking-[0.25em] text-foreground/40 uppercase mt-2"
        >
          Members save 15–25% · From $150 one-time
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.58, ease: EASE }}
          className="flex flex-col gap-2.5 mt-5 md:mt-8 w-full max-w-xs"
        >
          <div>
            <Link
              to="/newsletter"
              className="w-full flex items-center justify-between px-6 py-4 font-body text-xs tracking-[0.15em] uppercase font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              <span>BUY NOW</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="font-body text-[9px] tracking-[0.15em] text-foreground/35 uppercase mt-1.5 pl-1">One-time visit · from $150</p>
          </div>
          <div>
            <Link
              to="/newsletter"
              className="w-full flex items-center justify-between px-6 py-4 font-body text-xs tracking-[0.15em] uppercase font-semibold rounded-full bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 transition-colors"
            >
              <span>SUBSCRIBE & SAVE</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="font-body text-[9px] tracking-[0.15em] text-foreground/35 uppercase mt-1.5 pl-1">Membership plans · save 15–25%</p>
          </div>
        </motion.div>

        <div className="h-2 md:flex-1" />

      </div>
    </section>
  );
}
