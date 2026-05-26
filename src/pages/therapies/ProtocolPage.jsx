import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowLeft, ArrowRight, Clock, Sparkles, FlaskConical } from 'lucide-react';
import { EASE } from '@/lib/motion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { IV_SESSIONS } from '@/config/verticals';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.9, delay, ease: EASE },
});

export default function ProtocolPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const protocol = IV_SESSIONS.find((s) => s.key === slug);

  useSeo({
    title: protocol ? `${protocol.label} IV Therapy — Avalon Vitality` : 'Protocol Not Found — Avalon Vitality',
    description: protocol?.tagline || 'Explore Avalon Vitality mobile IV therapy protocols.',
    path: `/therapies/${slug}`,
  });

  if (!protocol) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Navbar />
        <p className="font-heading text-3xl text-foreground uppercase">Protocol not found</p>
        <Link to="/book" className="font-body text-sm text-foreground/60 underline">Back to booking</Link>
      </div>
    );
  }

  const Icon = protocol.icon;
  const ingredients = protocol.inside ? protocol.inside.split(' · ') : [];

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-background pt-24 pb-32">
        <div className="mx-auto max-w-4xl px-5 md:px-10">

          {/* Back */}
          <motion.button
            {...fadeUp(0.05)}
            type="button"
            onClick={() => navigate(-1)}
            className="mb-10 flex items-center gap-2 font-body text-xs tracking-[0.2em] uppercase text-foreground/45 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Back
          </motion.button>

          {/* Tag + label */}
          <motion.p {...fadeUp(0.1)} className="font-body text-[11px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
            {protocol.tag}
          </motion.p>

          <motion.h1
            {...fadeUp(0.18)}
            className="font-heading text-[14vw] sm:text-[10vw] md:text-[7rem] uppercase leading-[0.88] text-foreground mb-6"
          >
            {protocol.label}
          </motion.h1>

          <motion.p
            {...fadeUp(0.28)}
            className="font-body text-lg md:text-xl leading-relaxed text-foreground/65 max-w-xl mb-12"
          >
            {protocol.tagline}
          </motion.p>

          {/* Meta strip */}
          <motion.div
            {...fadeUp(0.36)}
            className="flex flex-wrap gap-6 mb-14 pb-14 border-b border-foreground/[0.08]"
          >
            <div>
              <p className="font-body text-[10px] tracking-[0.28em] uppercase text-foreground/35 mb-1">Price</p>
              <p className="font-heading text-3xl text-foreground">${protocol.price}</p>
            </div>
            {protocol.duration && (
              <div>
                <p className="font-body text-[10px] tracking-[0.28em] uppercase text-foreground/35 mb-1">Duration</p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-foreground/45" strokeWidth={1.6} />
                  <p className="font-body text-sm font-semibold text-foreground">{protocol.duration}</p>
                </div>
              </div>
            )}
            <div>
              <p className="font-body text-[10px] tracking-[0.28em] uppercase text-foreground/35 mb-1">Category</p>
              <p className="font-body text-sm font-semibold text-foreground capitalize">{protocol.category}</p>
            </div>
          </motion.div>

          {/* What's inside */}
          {ingredients.length > 0 && (
            <motion.div {...fadeUp(0.44)} className="mb-14">
              <div className="flex items-center gap-2 mb-6">
                <FlaskConical className="h-4 w-4 text-foreground/40" strokeWidth={1.6} />
                <p className="font-body text-[11px] tracking-[0.32em] uppercase text-foreground/40">What's Inside</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ingredients.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 py-3"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/30 shrink-0" />
                    <span className="font-body text-sm text-foreground/75">{item.trim()}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Who it's for */}
          <motion.div {...fadeUp(0.52)} className="mb-16">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-4 w-4 text-foreground/40" strokeWidth={1.6} />
              <p className="font-body text-[11px] tracking-[0.32em] uppercase text-foreground/40">Best For</p>
            </div>
            <p className="font-body text-base leading-relaxed text-foreground/60 max-w-lg">
              {getBestFor(protocol)}
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div {...fadeUp(0.6)} className="flex flex-col sm:flex-row gap-3 max-w-md">
            <Link
              to={`/book?protocol=${protocol.key}`}
              className="flex flex-1 items-center justify-between rounded-2xl bg-foreground px-6 py-4 font-body text-xs font-semibold tracking-[0.2em] uppercase text-background shadow-[0_18px_50px_hsl(var(--foreground)/0.16)] hover:opacity-90 transition-opacity"
            >
              Book This Protocol
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              to="/subscription"
              className="flex flex-1 items-center justify-between rounded-2xl border border-foreground/[0.14] bg-foreground/[0.04] px-6 py-4 font-body text-xs font-semibold tracking-[0.2em] uppercase text-foreground hover:bg-foreground/[0.08] transition-colors"
            >
              View Plans
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </motion.div>

          {/* Disclaimer */}
          <motion.p
            {...fadeUp(0.7)}
            className="mt-16 font-body text-[10px] leading-relaxed text-foreground/30 max-w-2xl"
          >
            Statements made by Avalon Vitality have not been evaluated by the FDA. Services are not intended to
            diagnose, treat, cure, or prevent any disease. Individual results vary. Always consult your physician
            before beginning any therapy.
          </motion.p>

        </div>
      </div>

      <Footer />
    </>
  );
}

function getBestFor(protocol) {
  const map = {
    hydration:    'Anyone needing rapid rehydration — post-workout, post-flight, or just feeling run down.',
    energy:       'High performers, professionals, and athletes looking to sharpen focus and sustain output.',
    immunity:     'Anyone feeling run down, fighting something off, or wanting to front-load their defenses.',
    beauty:       'Those looking to support skin clarity, hair strength, and a natural glow from the inside out.',
    recovery:     'Post-workout, travel, event, or late-night hydration support.',
    jetlag:       'Travelers crossing time zones who need to land sharp and stay that way.',
    myers:        'Anyone wanting the most well-rounded, clinically proven IV protocol available.',
    postnight:    'The morning after a long night — fast return to baseline, no questions asked.',
    nad:       'Clients interested in clinician-reviewed NAD+ support with longer appointment windows.',
    cbd:       'CBD IV information is held for clinical approval, legal review, and compliance-approved copy.',
    exosomes:  'Clients interested in advanced wellness support after clinician review.',
  };
  return map[protocol.key] || protocol.tagline;
}
