import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      className="hero-root relative h-[100svh] flex items-center justify-center overflow-hidden pt-20 md:pt-24 pb-10 md:pb-14"
    >
      {/* Parallax BG */}
      <motion.div style={{ y }} className="absolute inset-0 scale-110 pointer-events-none">
        <img
          src="https://media.base44.com/images/public/69e5682f98e509792c71ef21/3a0a1cbc3_winner.png"
          alt="Avalon Vitality IV therapy"
          className="w-full h-full object-cover brightness-110"
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-background/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-white/10 blur-3xl opacity-40" />
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center gap-6 md:gap-10 w-full">
        {/* Top band: eyebrow + title */}
        <div className="flex flex-col items-center w-full">
          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.1em' }}
            animate={{ opacity: 1, letterSpacing: '0.4em' }}
            transition={{ duration: 1.2, delay: 0.3 }}
            className="font-body text-xs tracking-[0.4em] text-accent uppercase mb-5"
          >
            Presale — Limited Spots
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="font-heading text-6xl md:text-7xl lg:text-[7rem] leading-[0.9] tracking-wide text-foreground uppercase"
          >
            AVALON<br />VITALITY
          </motion.h1>
        </div>

        {/* Middle band: divider + subhead + CTA pill, grouped with even gap */}
        <div className="flex flex-col items-center w-full gap-5 md:gap-7">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 1, ease: [0.16, 1, 0.3, 1] }}
            className="h-px bg-foreground/20 mx-auto max-w-md origin-center w-full"
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="px-2 mx-auto flex flex-col items-center gap-3 md:gap-4"
          >
            <div className="font-body text-xs md:text-sm text-foreground tracking-[0.2em] md:tracking-[0.4em] uppercase text-center md:whitespace-nowrap">
              The Operating System for Human Performance
            </div>
            <p className="font-body text-sm md:text-base text-foreground/85 leading-relaxed max-w-[90vw] md:max-w-xl px-2">
              Built for athletes, founders, and high-performers who don't have time to slow down.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
            className="flex items-center justify-center w-full max-w-2xl mx-auto px-4"
          >
            <div className="flex items-center bg-background/40 backdrop-blur-sm border border-foreground/20 rounded-full overflow-hidden">
              <span className="font-body text-xs tracking-widest text-foreground uppercase px-12 py-5">
                A new standard in recovery
              </span>
              <Link
                to="/apply"
                className="px-10 py-5 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full hover:bg-foreground/90 transition-colors whitespace-nowrap shrink-0"
              >
                Apply Now
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}