import React from 'react';
import { motion } from 'framer-motion';

const BOOK_URL = 'https://avalonvitality.as.me/schedule/a9d85b1e';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1920&q=80"
          alt="Festival performance"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
      </div>

      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="font-heading text-7xl md:text-9xl lg:text-[11rem] leading-none tracking-wide text-foreground uppercase"
        >
          MOBILE<br />RECOVERY<br />THERAPY
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="mt-6 font-body text-sm md:text-base text-muted-foreground tracking-widest uppercase"
        >
          Elite recovery — wherever you are
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.95 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href={BOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-foreground text-background font-body text-sm tracking-widest uppercase font-semibold hover:bg-foreground/90 transition-colors rounded"
          >
            Start Your Recovery
          </a>
          <a
            href="#treatments"
            className="px-8 py-4 border border-foreground/30 text-foreground font-body text-sm tracking-widest uppercase hover:border-foreground transition-colors rounded"
          >
            View Treatments
          </a>
        </motion.div>
      </div>
    </section>
  );
}