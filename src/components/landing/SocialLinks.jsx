import React from 'react';
import { Instagram } from 'lucide-react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

export default function SocialLinks() {
  return (
    <div className="mt-10 md:mt-14 w-full">
      <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-8 md:mb-10 text-left">
        Follow Avalon
      </p>
      <motion.a
        href="https://instagram.com/avalon_vitality"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Avalon Vitality on Instagram"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE }}
        className="inline-flex items-center gap-3 text-foreground/40 hover:text-foreground transition-colors duration-200"
      >
        <Instagram className="w-8 h-8 md:w-9 md:h-9" strokeWidth={1.25} />
        <span className="font-body text-xs tracking-[0.18em] uppercase">@avalon_vitality</span>
      </motion.a>
    </div>
  );
}
