import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight } from 'lucide-react';
import { premiumHover, premiumTap, premiumCard } from '@/lib/motion';
import GlassCard from '@/components/ui/GlassCard';

const MotionLink = motion.create(Link);

// Direct-book insert — a mid-scroll nudge for anyone who hasn't taken the quiz
// or picked a plan. No consultation/nurse copy; one action, straight to /book.
export default function CTABanner() {
  return (
    <section id="cta-banner" className="pt-10 pb-10 md:pt-16 md:pb-16 px-5 md:px-12 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <motion.div {...premiumCard()}>
          <GlassCard
            tone="heavy"
            radius="1.75rem"
            className="flex flex-col items-start gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-12 md:py-11"
          >
            <div>
              <h2 className="font-heading text-[11vw] leading-[0.9] tracking-tight text-foreground md:text-6xl lg:text-7xl">
                Feel better, faster.
              </h2>
              <p className="mt-3 font-body text-xs uppercase leading-relaxed tracking-[0.22em] text-foreground/55 md:text-sm">
                IV therapy to your door, on your schedule
              </p>
            </div>
            <MotionLink
              to="/book"
              whileHover={premiumHover}
              whileTap={premiumTap}
              className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 font-body text-sm uppercase tracking-[0.2em] text-background transition-colors duration-base ease-editorial"
            >
              Book
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
            </MotionLink>
          </GlassCard>
        </motion.div>
      </div>
    </section>
  );
}
