import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Clock, ShieldCheck, Users, ChevronRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const EASE = [0.16, 1, 0.3, 1];

// Public Acuity embed URL — set VITE_ACUITY_EMBED_URL in .env
// Default fallback uses owner ID 35603623
const ACUITY_EMBED_URL =
  import.meta.env.VITE_ACUITY_EMBED_URL ||
  'https://app.acuityscheduling.com/schedule.php?owner=35603623';

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'Licensed RN',       sub: 'CA-credentialed' },
  { icon: MapPin,      label: 'Mobile Visits',      sub: 'Home · Hotel · Office' },
  { icon: Clock,       label: 'Same Day',            sub: '90-min arrival window' },
  { icon: Users,       label: 'Secure Intake',       sub: 'HIPAA-compliant' },
];

export default function BookNow() {
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [embedError, setEmbedError]   = useState(false);

  // Inject Acuity's resize script once
  useEffect(() => {
    if (document.getElementById('acuity-embed-script')) return;
    const script = document.createElement('script');
    script.id  = 'acuity-embed-script';
    script.src = 'https://embed.acuityscheduling.com/js/embed.js';
    script.type = 'text/javascript';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      const el = document.getElementById('acuity-embed-script');
      if (el) el.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* ── Hero strip ─────────────────────────────────────────────── */}
      <section className="pt-28 md:pt-36 pb-8 md:pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="font-body text-[11px] tracking-[0.3em] uppercase text-foreground/50">
                Available Today · SF Bay Area
              </span>
            </div>

            {/* Brand label */}
            <p className="font-body text-xs tracking-[0.3em] uppercase text-foreground/40 mb-2">
              Avalon Vitality
            </p>

            {/* Headline */}
            <h1 className="font-heading text-[13vw] sm:text-7xl md:text-8xl text-foreground uppercase tracking-tight leading-[0.9] mb-4">
              Book Your<br />Visit
            </h1>

            {/* Rule */}
            <div className="w-10 h-[2px] bg-accent mb-5" />

            {/* Sub */}
            <p className="font-body text-sm text-foreground/60 leading-relaxed max-w-md">
              Choose your service, drop your location, and pick a time.
              A licensed RN arrives within 90 minutes.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Trust strip ────────────────────────────────────────────── */}
      <section className="px-4 pb-8 md:pb-10">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-2"
          >
            {TRUST_ITEMS.map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02]"
              >
                <t.icon className="w-4 h-4 text-accent shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="font-body text-[11px] font-semibold text-foreground tracking-[0.04em]">
                    {t.label}
                  </p>
                  <p className="font-body text-[10px] text-foreground/40 leading-tight">
                    {t.sub}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Acuity embed ───────────────────────────────────────────── */}
      <section className="px-4 pb-16 md:pb-24 flex-1">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.25 }}
            className="rounded-3xl border border-foreground/[0.1] overflow-hidden bg-foreground/[0.015] relative"
          >
            {/* Loading shell — shown until iframe signals load */}
            {!embedLoaded && !embedError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8 rounded-full border-2 border-foreground/10 border-t-foreground/50"
                />
                <p className="font-body text-[11px] tracking-[0.25em] uppercase text-foreground/30">
                  Loading scheduler…
                </p>
              </div>
            )}

            {/* Error state */}
            {embedError && (
              <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
                <p className="font-body text-sm text-foreground/50">
                  Unable to load the scheduler. Please try refreshing.
                </p>
                <button
                  onClick={() => { setEmbedError(false); setEmbedLoaded(false); }}
                  className="font-body text-[11px] tracking-[0.2em] uppercase text-accent hover:text-foreground transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* The iframe */}
            {!embedError && (
              <iframe
                src={ACUITY_EMBED_URL}
                title="Book your Avalon Vitality visit"
                width="100%"
                className="block w-full border-0"
                style={{
                  height: 'clamp(820px, 90vh, 1050px)',
                  minHeight: '820px',
                  opacity: embedLoaded ? 1 : 0,
                  transition: 'opacity 0.4s ease',
                }}
                frameBorder="0"
                onLoad={() => setEmbedLoaded(true)}
                onError={() => setEmbedError(true)}
                allow="payment"
              />
            )}
          </motion.div>

          {/* Fine-print note */}
          <p className="font-body text-[10px] text-foreground/25 text-center mt-4 tracking-wide">
            No charge until your RN confirms availability. Powered by Acuity Scheduling.
          </p>
        </div>
      </section>

      {/* ── What to expect ─────────────────────────────────────────── */}
      <section className="px-4 pb-16 md:pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <p className="font-body text-[11px] tracking-[0.3em] uppercase text-foreground/40">
              What Happens Next
            </p>
            <Link
              to="/how-it-works"
              className="font-body text-[11px] tracking-[0.2em] uppercase text-foreground/40 hover:text-foreground transition-colors flex items-center gap-1"
            >
              Full process <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { step: '01', title: 'You book',      body: 'Choose service, location, and time. No account required.' },
              { step: '02', title: 'We confirm',    body: 'Our team confirms availability and sends your RN info.' },
              { step: '03', title: 'RN arrives',    body: 'A licensed nurse arrives with everything needed. You relax.' },
            ].map((s) => (
              <div key={s.step} className="px-5 py-4 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02]">
                <p className="font-body text-[9px] tracking-[0.3em] uppercase text-accent/70 mb-1">{s.step}</p>
                <p className="font-body text-sm font-semibold text-foreground mb-1 tracking-[0.02em]">{s.title}</p>
                <p className="font-body text-[11px] text-foreground/50 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
