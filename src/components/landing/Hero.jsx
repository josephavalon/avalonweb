import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Star, Zap, Heart } from 'lucide-react';

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
          src="https://media.base44.com/images/public/69e5682f98e509792c71ef21/3a0a1cbc3_winner.png"
          alt="Nurse with patient"
          className="w-full h-full object-cover brightness-110"
        />
        <div className="absolute inset-0 bg-background/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-white/10 blur-3xl opacity-40" />
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-screen">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.1em' }}
          animate={{ opacity: 1, letterSpacing: '0.4em' }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="font-body text-[10px] tracking-[0.4em] text-accent uppercase mb-6"
        >
          Presale — Limited Spots
        </motion.p>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="font-heading text-7xl md:text-9xl lg:text-[11rem] leading-tight tracking-wide text-foreground uppercase mb-4"
        >
          AVALON<br />VITALITY
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 1, ease: [0.16, 1, 0.3, 1] }}
          className="h-px bg-foreground/20 my-3 mx-auto max-w-md origin-center"
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="font-body text-xs md:text-base text-foreground/90 tracking-[0.2em] md:tracking-[0.3em] uppercase mb-12 px-2 mx-auto flex flex-col"
        >
          <div className="whitespace-nowrap">Mobile Optimization Therapy</div>
          <div className="whitespace-nowrap">Coming Soon to SF</div>
        </motion.div>

        {/* CTA pill */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="flex items-center justify-start w-full max-w-2xl mx-auto px-4"
        >
          <div className="flex items-center bg-background/40 backdrop-blur-sm border border-foreground/20 rounded-full overflow-hidden">
            <span className="font-body text-xs tracking-widest text-foreground uppercase px-8 py-4">
              A new standard in recovery
            </span>
            <Link
              to="/apply"
              className="px-8 py-4 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full hover:bg-foreground/90 transition-colors whitespace-nowrap shrink-0"
            >
              Apply Now
            </Link>
          </div>
        </motion.div>


      </motion.div>

      {/* Bottom text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center space-y-0.5"
      >
        <p className="font-body text-[9px] text-foreground tracking-widest">
         Licensed Nurses • Physician Supervised • HIPAA Secure
        </p>
        <p className="font-body text-[9px] text-foreground tracking-widest">
         Presale membership. Secure yours now.
        </p>
      </motion.div>
    </section>
  );
}