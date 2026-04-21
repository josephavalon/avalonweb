import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const APPLY_URL = '#membership';

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-14">
      {/* Parallax BG */}
      <motion.div style={{ y }} className="absolute inset-0 scale-110">
        <img
          src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=1920&q=85"
          alt="IV drip close up"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background" />
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.1em' }}
          animate={{ opacity: 1, letterSpacing: '0.4em' }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="font-body text-[10px] tracking-[0.4em] text-accent uppercase mb-8"
        >
          Presale — Limited Spots
        </motion.p>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="font-heading text-7xl md:text-[10rem] lg:text-[13rem] leading-none tracking-wide text-foreground uppercase"
        >
          AVALON
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 1, ease: [0.16, 1, 0.3, 1] }}
          className="h-px bg-foreground/20 my-4 mx-auto max-w-md origin-center"
        />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="font-body text-sm md:text-base text-muted-foreground tracking-[0.3em] uppercase mb-12"
        >
          Mobile IV Therapy · By Application Only
        </motion.p>

        {/* CTA pill — same style as The Protocole */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <div className="flex items-center bg-background/40 backdrop-blur-sm border border-foreground/20 rounded-full overflow-hidden pr-1">
            <span className="font-body text-xs tracking-widest text-muted-foreground uppercase px-6 py-3">
              A new standard in recovery
            </span>
            <a
              href={APPLY_URL}
              className="px-6 py-3 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full hover:bg-foreground/90 transition-colors whitespace-nowrap"
            >
              Apply Now
            </a>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          className="mt-4 font-body text-[10px] text-muted-foreground/60 tracking-widest"
        >
          Presale membership. Secure yours now.
        </motion.p>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="w-px h-12 bg-gradient-to-b from-foreground/40 to-transparent"
        />
      </motion.div>
    </section>
  );
}