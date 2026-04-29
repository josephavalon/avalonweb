import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import MagneticButton from '@/components/ui/MagneticButton';
import { Link } from 'react-router-dom';

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  // Cursor-aware parallax — gentle drift toward mouse (luxury micro-motion).
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const cx = useSpring(cursorX, { stiffness: 40, damping: 22, mass: 0.8 });
  const cy = useSpring(cursorY, { stiffness: 40, damping: 22, mass: 0.8 });
  const handleCursor = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    cursorX.set(nx * 12);
    cursorY.set(ny * 8);
  };

  return (
    <section
      ref={ref}
      className="hero-root relative min-h-[100svh] flex flex-col overflow-hidden pt-20 md:pt-24 pb-8 md:pb-12"
    >
      {/* Parallax BG */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="https://media.base44.com/images/public/69e5682f98e509792c71ef21/3a0a1cbc3_winner.png"
          alt="Avalon Vitality IV therapy"
          className="w-full h-full object-cover brightness-110"
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-background/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
        <div className="absolute bottom-0 inset-x-0 h-2/3 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-white/10 blur-3xl opacity-40" />
      </div>

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center justify-center gap-6 md:gap-10 w-full flex-1">
        {/* Top band: eyebrow + title */}
        <div className="flex flex-col items-center w-full">
          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.1em' }}
            animate={{ opacity: 1, letterSpacing: '0.4em' }}
            transition={{ duration: 1.2, delay: 0.15 }}
            className="font-body text-xs tracking-[0.4em] text-accent uppercase mb-5"
          >
            SF Bay Area
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="font-heading text-7xl md:text-7xl lg:text-[7rem] leading-[0.95] tracking-[0.06em] md:tracking-wide text-foreground uppercase"
          >
            AVALON<br />VITALITY
          </motion.h1>
        </div>

        {/* Middle band: divider + subhead + CTA pill, grouped with even gap */}
        <div className="flex flex-col items-center w-full gap-5 md:gap-7">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65 }}
            className="flex items-center justify-center w-full max-w-2xl mx-auto px-4"
          >
            <div className="flex flex-col items-center gap-3 md:gap-4">
              <MagneticButton strength={14}>
                <Link
                  to="/apply"
                  className="apply-now-btn inline-block px-10 py-4 bg-foreground text-background font-body text-xs tracking-[0.3em] uppercase font-semibold hover:bg-foreground/90 transition-colors whitespace-nowrap"
                >
                  Start Now
                </Link>
              </MagneticButton>
            </div>
          </motion.div>


        </div>
      </div>

      {/* Bottom band: glass divider + subhead in normal flow (prevents overlap on any viewport/browser) */}
      <div className="relative z-10 w-full px-4 flex flex-col items-center gap-4 md:gap-6 pb-2">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="h-px bg-foreground/20 w-full max-w-xs md:max-w-md origin-center"
        />
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-[90vw] md:max-w-xl mx-auto"
        >
          Built for high-performers who don't have time to slow down.
        </motion.p>
      </div>
    </section>
  );
}