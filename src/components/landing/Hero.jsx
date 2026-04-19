import React from 'react';
import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1920&q=80"
          alt="IV therapy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
      </div>

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="font-heading text-5xl md:text-7xl lg:text-8xl tracking-wide text-foreground mb-8"
        >
          THE INFUSION
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <span className="px-8 py-3 border border-foreground/30 rounded-full text-xs md:text-sm tracking-[0.15em] text-foreground/80 font-body uppercase">
            Wellness delivered to your door
          </span>
          <a
            href="#membership"
            className="px-8 py-3 bg-foreground text-background rounded-full text-xs md:text-sm tracking-[0.15em] font-body uppercase hover:bg-foreground/90 transition-colors"
          >
            Book Now
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-6 text-xs tracking-[0.15em] text-muted-foreground font-body"
        >
          Premium mobile IV therapy. Nurse-administered. At your location.
        </motion.p>
      </div>
    </section>
  );
}