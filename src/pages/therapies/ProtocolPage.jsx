import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowLeft, ArrowRight, Check, Clock, FlaskConical, ShieldCheck, Sparkles } from 'lucide-react';
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
            onClick={() => navigate(-1)}
            className="mb-10 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-foreground/[0.10] px-4 font-body text-xs tracking-[0.2em] uppercase text-foreground/45 transition-colors hover:border-foreground/22 hover:text-foreground"
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
              <p className="font-heading text-3xl text-foreground">${price}</p>
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
              <p className="font-body text-sm font-semibold text-foreground capitalize">{protocol.category || 'protocol'}</p>
            </div>
          </motion.div>

          {/* Composition */}
          {ingredients.length > 0 && (
            <motion.div {...fadeUp(0.44)} className="mb-14">
              <div className="flex items-center gap-2 mb-6">
                <FlaskConical className="h-4 w-4 text-foreground/40" strokeWidth={1.6} />
                <p className="font-body text-[11px] tracking-[0.32em] uppercase text-foreground/40">Composition</p>
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

          {/* Mechanism */}
          <motion.div {...fadeUp(0.48)} className="mb-14">
            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck className="h-4 w-4 text-foreground/40" strokeWidth={1.6} />
              <p className="font-body text-[11px] tracking-[0.32em] uppercase text-foreground/40">How It Works</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {mechanism.map((item) => (
                <div key={item.title} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/42">{item.title}</p>
                  <p className="mt-3 font-body text-sm leading-snug text-foreground/62">{item.body}</p>
                </div>
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
                  <div key={dose.key || dose.label} className="flex min-h-[64px] items-center justify-between gap-4 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-4">
                    <div>
                      <p className="font-body text-sm font-semibold text-foreground">{dose.label}</p>
                      <p className="mt-1 font-body text-xs text-foreground/45">{dose.duration || protocol.duration || 'Timing confirmed before visit'}</p>
                    </div>
                    <p className="font-heading text-2xl text-foreground">${Number(dose.price || price).toLocaleString()}</p>
                  </div>
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
            <p className="font-body text-base leading-relaxed text-foreground/60 max-w-lg">
              {getBestFor(protocol)}
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {['Clinical clearance required', 'Licensed RN visit', 'Final protocol may be adjusted'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-3">
                  <Check className="h-3.5 w-3.5 text-foreground/45" strokeWidth={1.8} />
                  <span className="font-body text-xs text-foreground/58">{item}</span>
                </div>
              ))}
            </div>
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
      body: 'Fluids help replenish volume. Electrolytes support normal fluid balance and comfort after travel, heat, or high-output days.',
    },
    {
      title: 'Replenish',
      body: 'Selected vitamins, minerals, or amino acids are paired to the protocol and reviewed for eligibility before treatment.',
    },
    {
      title: 'Review',
      body: 'The clinical team may adjust, hold, or decline a protocol based on intake, annual GFE status, contraindications, and vitals.',
    },
  ];
  const map = {
    nad: [
      { title: 'NAD+', body: 'NAD+ is a molecule involved in cellular energy pathways. Appointment length and dose are reviewed before service.' },
      { title: 'Slow Infusion', body: 'NAD+ visits can run longer than standard hydration. The nurse monitors comfort and pauses or slows as needed.' },
      common[2],
    ],
    cbd: [
      { title: 'Approval Gated', body: 'CBD IV content is held until legal, physician, and compliance review are complete.' },
      { title: 'No Claims', body: 'Avalon will not publish disease-treatment, pain-cure, anxiety-cure, or guaranteed-result claims.' },
      common[2],
    ],
  };
  return map[protocol?.key] || common;
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
