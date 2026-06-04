import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowLeft, ArrowRight, Check, Clock, DollarSign, FlaskConical, ShieldCheck, Sparkles } from 'lucide-react';
import { EASE } from '@/lib/motion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { IV_SESSIONS } from '@/config/verticals';
import GlassCard from '@/components/ui/GlassCard';
import PremiumButton from '@/components/ui/PremiumButton';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.9, delay, ease: EASE },
});

export default function ProtocolPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const protocol = IV_SESSIONS.find((s) => s.key === slug);
  const price = priceForProtocol(protocol);
  const ingredients = getComposition(protocol);
  const mechanism = getMechanism(protocol);
  const doseOptions = getDoseOptions(protocol);

  useSeo({
    title: protocol ? `${protocol.label} IV Therapy — Avalon Vitality` : 'Protocol Not Found — Avalon Vitality',
    description: protocol?.tagline || 'Explore Avalon Vitality mobile IV therapy protocols.',
    path: `/therapies/${slug}`,
    jsonLd: protocol ? {
      '@context': 'https://schema.org',
      '@type': 'MedicalProcedure',
      name: `${protocol.label} IV Therapy`,
      description: protocol.desc || protocol.tagline,
      procedureType: 'Mobile IV therapy',
      howPerformed: 'A licensed RN administers the protocol after clinical clearance and eligibility review.',
      preparation: 'Clinical clearance and intake are required before treatment. Final protocol may be adjusted by the clinical team.',
      followup: 'Post-visit instructions and support are provided when appropriate.',
      provider: {
        '@type': 'MedicalBusiness',
        name: 'Avalon Vitality',
        areaServed: 'San Francisco Bay Area',
      },
    } : undefined,
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

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-background pt-24 pb-32">
        <div className="mx-auto max-w-4xl px-5 md:px-10">

          {/* Back */}
          <motion.button
            {...fadeUp(0.05)}
            type="button"
            onClick={() => navigate('/protocols')}
            className="mb-10 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-foreground/[0.10] px-4 font-body text-xs tracking-[0.2em] uppercase text-foreground/45 transition-colors hover:border-foreground/22 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Protocols
          </motion.button>

          {/* Tag + label */}

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

          {/* Meta widgets */}
          <motion.div {...fadeUp(0.36)} className="av-wide-card-grid mb-8">
            <GlassCard tone="soft" radius="1.35rem" className="av-rect-card min-h-[120px] p-4">
              <DollarSign className="h-4 w-4 text-foreground/42" strokeWidth={1.7} />
              <p className="mt-4 font-heading text-4xl uppercase leading-none text-foreground">${price}</p>
              <p className="mt-1 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/42">Price</p>
            </GlassCard>
            {protocol.duration && (
              <GlassCard tone="soft" radius="1.35rem" className="av-rect-card min-h-[120px] p-4">
                <Clock className="h-4 w-4 text-foreground/42" strokeWidth={1.7} />
                <p className="mt-4 truncate font-heading text-4xl uppercase leading-none text-foreground">{protocol.duration}</p>
                <p className="mt-1 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/42">Time</p>
              </GlassCard>
            )}
            <GlassCard tone="soft" radius="1.35rem" className="av-rect-card min-h-[120px] p-4">
              <ShieldCheck className="h-4 w-4 text-foreground/42" strokeWidth={1.7} />
              <p className="mt-4 font-heading text-4xl uppercase leading-none text-foreground">RN</p>
              <p className="mt-1 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/42">Mobile</p>
            </GlassCard>
            <GlassCard tone="soft" radius="1.35rem" className="av-rect-card min-h-[120px] p-4">
              <Sparkles className="h-4 w-4 text-foreground/42" strokeWidth={1.7} />
              <p className="mt-4 truncate font-heading text-4xl uppercase leading-none text-foreground capitalize">{protocol.category || 'IV'}</p>
              <p className="mt-1 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/42">Type</p>
            </GlassCard>
          </motion.div>

          <motion.div {...fadeUp(0.4)} className="mb-14 max-w-md">
            <PremiumButton
              as={Link}
              to="/book"
              className="flex min-h-[58px] w-full items-center justify-between rounded-full bg-foreground px-6 font-body text-xs font-black tracking-[0.16em] uppercase text-background shadow-[0_18px_50px_hsl(var(--foreground)/0.16)]"
              wrapperClassName="w-full"
            >
              Book
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </PremiumButton>
          </motion.div>

          {/* Composition */}
          {ingredients.length > 0 && (
            <motion.div {...fadeUp(0.44)} className="mb-14">
              <div className="flex items-center gap-2 mb-6">
                <FlaskConical className="h-4 w-4 text-foreground/40" strokeWidth={1.6} />
                <p className="font-body text-[11px] tracking-[0.32em] uppercase text-foreground/40">Ingredients</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ingredients.map((item) => (
                  <GlassCard
                    key={item}
                    tone="soft"
                    radius="1.35rem"
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/30 shrink-0" />
                    <span className="font-body text-sm text-foreground/75">{item.trim()}</span>
                  </GlassCard>
                ))}
              </div>
            </motion.div>
          )}

          {/* Mechanism */}
          <motion.div {...fadeUp(0.48)} className="mb-14">
            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck className="h-4 w-4 text-foreground/40" strokeWidth={1.6} />
              <p className="font-body text-[11px] tracking-[0.32em] uppercase text-foreground/40">Action</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {mechanism.map((item) => (
                <GlassCard key={item.title} tone="soft" radius="1.35rem" className="p-4">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/42">{item.title}</p>
                  <p className="mt-3 font-body text-sm leading-snug text-foreground/62">{item.body}</p>
                </GlassCard>
              ))}
            </div>
          </motion.div>

          {doseOptions.length > 0 && (
            <motion.div {...fadeUp(0.5)} className="mb-14">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="h-4 w-4 text-foreground/40" strokeWidth={1.6} />
                <p className="font-body text-[11px] tracking-[0.32em] uppercase text-foreground/40">Options</p>
              </div>
              <div className="grid gap-2">
                {doseOptions.map((dose) => (
                  <GlassCard key={dose.key || dose.label} tone="soft" radius="1.35rem" className="flex min-h-[64px] items-center justify-between gap-4 px-4">
                    <div>
                      <p className="font-body text-sm font-semibold text-foreground">{dose.label}</p>
                      <p className="mt-1 font-body text-xs text-foreground/45">{dose.duration || protocol.duration || 'Timing confirmed before visit'}</p>
                    </div>
                    <p className="font-heading text-2xl text-foreground">${Number(dose.price || price).toLocaleString()}</p>
                  </GlassCard>
                ))}
              </div>
            </motion.div>
          )}

          {/* Who it's for */}
          <motion.div {...fadeUp(0.54)} className="mb-16">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-4 w-4 text-foreground/40" strokeWidth={1.6} />
              <p className="font-body text-[11px] tracking-[0.32em] uppercase text-foreground/40">Best For</p>
            </div>
            <GlassCard tone="soft" radius="1.35rem" className="p-4">
              <p className="font-heading text-3xl uppercase leading-none text-foreground">Fit</p>
              <p className="mt-2 font-body text-sm font-semibold leading-snug text-foreground/62">{getBestFor(protocol)}</p>
            </GlassCard>
            <div className="mt-6 grid gap-2 md:grid-cols-2">
              {['Clinical review', 'Licensed RN', 'Protocol may adjust'].map((item) => (
                <GlassCard key={item} tone="soft" radius="1.35rem" className="flex items-center gap-2 px-3 py-3">
                  <Check className="h-3.5 w-3.5 text-foreground/45" strokeWidth={1.8} />
                  <span className="font-body text-xs text-foreground/58">{item}</span>
                </GlassCard>
              ))}
            </div>
          </motion.div>

          {/* Disclaimer */}
          <motion.p
            {...fadeUp(0.7)}
            className="mt-16 font-body text-[10px] leading-relaxed text-foreground/30 max-w-2xl"
          >
            Not FDA evaluated. Not intended to diagnose, treat, cure, or prevent disease. Results vary. Consult your physician.
          </motion.p>

        </div>
      </div>

      <Footer />
    </>
  );
}

function priceForProtocol(protocol) {
  return Number(protocol?.price || protocol?.doses?.[0]?.price || 250).toLocaleString();
}

function getComposition(protocol) {
  if (!protocol) return [];
  if (protocol.inside) return protocol.inside.split(' · ').map((item) => item.trim()).filter(Boolean);
  return (protocol.features || []).map((item) => String(item).trim()).filter(Boolean);
}

function getDoseOptions(protocol) {
  if (!protocol?.doses?.length) return [];
  return protocol.doses;
}

function getMechanism(protocol) {
  const common = [
    {
      title: 'Hydrate',
      body: 'Fluids and electrolytes support normal hydration.',
    },
    {
      title: 'Replenish',
      body: 'Vitamins, minerals, or amino acids are reviewed before treatment.',
    },
    {
      title: 'Review',
      body: 'The clinical team may adjust, hold, or decline service.',
    },
  ];
  const map = {
    nad: [
      { title: 'NAD+', body: 'Dose and timing are reviewed before service.' },
      { title: 'Slow Infusion', body: 'The nurse monitors comfort and adjusts pace.' },
      common[2],
    ],
    cbd: [
      { title: 'Review gated', body: 'CBD IV content is held for legal and clinical review.' },
      { title: 'No claims', body: 'No disease, pain, anxiety, or guaranteed-result claims.' },
      common[2],
    ],
  };
  return map[protocol?.key] || common;
}

function getBestFor(protocol) {
  const map = {
    hydration:    'Post-workout, post-flight, heat, or dehydration support.',
    energy:       'Long days, travel, training, or demanding work.',
    immunity:     'Run-down days and seasonal support.',
    beauty:       'Skin, hair, and glow support.',
    recovery:     'Training, travel, events, or late nights.',
    jetlag:       'Time-zone shifts and arrival support.',
    myers:        'Broad hydration and vitamin support.',
    postnight:    'Late-night recovery support.',
    nad:       'Clinician-reviewed NAD+ support.',
    cbd:       'Held for clinical, legal, and compliance review.',
    exosomes:  'Advanced wellness support after review.',
  };
  return map[protocol.key] || protocol.tagline;
}
