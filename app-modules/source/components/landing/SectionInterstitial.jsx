import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';

const MotionLink = motion.create(Link);

// Poster-style band between sections. Plain background — sits directly on the
// page canvas so section rhythm reads as: content → punctuation → content.
// Renders one of two CTA shapes: an outline pill (variant="pill") or a small
// uppercase tracked link (variant="link"). No CTA at all when `cta` is omitted.
export default function SectionInterstitial({ kicker, title, body, cta }) {
  return (
    <section className="pt-10 pb-10 md:pt-16 md:pb-16 px-5 md:px-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-96px' }}
        transition={{ duration: 0.9, ease: EASE }}
        className="av-treatment-card mx-auto max-w-3xl rounded-[1.3rem] border px-6 py-10 text-center md:px-10 md:py-14"
      >
        {kicker && (
          <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45 md:text-[11px]">
            {kicker}
          </p>
        )}
        <h2 className="mt-3 font-heading uppercase text-foreground leading-[0.9] tracking-tight text-h1">
          {title}
        </h2>
        {body && (
          <p className="mx-auto mt-4 max-w-xl font-body text-[11px] uppercase leading-relaxed tracking-[0.22em] text-foreground/55 md:text-xs">
            {body}
          </p>
        )}
        {cta && cta.variant !== 'link' && (
          <MotionLink
            to={cta.to}
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-foreground/45 px-8 py-3.5 font-body text-sm uppercase tracking-[0.22em] text-foreground transition-colors duration-base ease-editorial hover:border-foreground/80 hover:bg-foreground/[0.04]"
          >
            {cta.label}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </MotionLink>
        )}
        {cta && cta.variant === 'link' && (
          <MotionLink
            to={cta.to}
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group mt-6 inline-flex items-center justify-center gap-2 font-body text-[11px] uppercase tracking-[0.28em] text-foreground/70 transition-colors duration-base ease-editorial hover:text-foreground"
          >
            {cta.label}
            <ArrowRight className="h-3 w-3 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </MotionLink>
        )}
      </motion.div>
    </section>
  );
}
