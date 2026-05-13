import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft, CalendarPlus, User } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

/* ─── Data ───────────────────────────────────────────────────── */
const TIMELINE_STEPS = [
  {
    number: '01',
    title: 'Text Confirmation',
    body: "You'll receive a text confirmation with your nurse's name and ETA within 15 minutes of booking.",
  },
  {
    number: '02',
    title: 'Nurse En Route',
    body: 'Your licensed RN will arrive within your 90-minute window. They bring all supplies — no prep needed on your end.',
  },
  {
    number: '03',
    title: 'Your Session',
    body: 'Sessions run 30–90 minutes. Relax at home while your nurse handles everything. They clean up before leaving.',
  },
];

const PREP_ITEMS = [
  'Have water available (optional but helpful)',
  'Wear loose-fitting clothing with easy arm access',
  'Have your ID ready for nurse verification',
  'Let us know if symptoms change before arrival',
];

/* ─── Animated Checkmark ─────────────────────────────────────── */
function AnimatedCheck() {
  return (
    <div className="flex items-center justify-center mb-8">
      <svg
        viewBox="0 0 80 80"
        className="w-20 h-20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.circle
          cx="40"
          cy="40"
          r="36"
          stroke="currentColor"
          strokeWidth="2"
          className="text-accent"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
          style={{ pathLength: 0 }}
        />
        <motion.path
          d="M24 40 L35 51 L56 30"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-accent"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.75 }}
        />
      </svg>
    </div>
  );
}

/* ─── Timeline Step ──────────────────────────────────────────── */
function TimelineStep({ step, index, isLast }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.8 + index * 0.12 }}
      className="flex gap-4"
    >
      {/* Left column: number + line */}
      <div className="flex flex-col items-center shrink-0">
        <span className="font-heading text-4xl text-accent/30 leading-none">
          {step.number}
        </span>
        {!isLast && (
          <div className="w-px flex-1 mt-3 bg-foreground/[0.08]" style={{ minHeight: '2rem' }} />
        )}
      </div>

      {/* Right column: content */}
      <div className={`flex-1 min-w-0 pt-1 ${isLast ? '' : 'pb-8'}`}>
        <p className="font-heading text-xl text-foreground tracking-wide mb-1">
          {step.title}
        </p>
        <p className="font-body text-sm text-foreground/60 leading-relaxed">
          {step.body}
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function BookingConfirmation() {
  useSeo({
    title: 'Session Confirmed — Avalon Vitality',
    description: 'Your IV wellness session has been confirmed. A licensed RN is en route.',
    path: '/store/confirmation',
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-lg mx-auto px-5 md:px-8 pt-24 pb-32 space-y-10">

        {/* ── 1. Confirmation Hero ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center pt-4"
        >
          <AnimatedCheck />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
          >
            <h1 className="font-heading text-5xl md:text-6xl text-foreground uppercase tracking-tight leading-none mb-4">
              Your Session Is Confirmed.
            </h1>
            <p className="font-body text-sm text-foreground/60 leading-relaxed max-w-sm mx-auto mb-6">
              A licensed RN is en route. You'll receive a text confirmation with nurse details shortly.
            </p>

            {/* Booking meta pill */}
            <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-6 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-6 py-3 mx-auto">
              <div className="text-center sm:text-left">
                <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-0.5">
                  Reference
                </p>
                <p className="font-body text-sm text-accent font-medium tracking-wider">
                  REF #AV-2847
                </p>
              </div>
              <div className="w-px h-6 bg-foreground/[0.08] hidden sm:block" />
              <div className="text-center sm:text-left">
                <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-0.5">
                  Session Time
                </p>
                <p className="font-body text-sm text-foreground">
                  Today, 3:30 PM – 5:00 PM
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── 2. What to Expect — Timeline ─────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.65 }}
          className="space-y-4"
        >
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 px-1">
            What to Expect
          </p>

          <div className="rounded-2xl border border-foreground/[0.08] bg-background/80 backdrop-blur-xl px-5 pt-5 pb-4">
            {TIMELINE_STEPS.map((step, i) => (
              <TimelineStep
                key={step.number}
                step={step}
                index={i}
                isLast={i === TIMELINE_STEPS.length - 1}
              />
            ))}
          </div>
        </motion.div>

        {/* ── 3. Prep Checklist Card ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.0 }}
          className="space-y-3"
        >
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 px-1">
            Get Ready for Your Visit
          </p>

          <div className="rounded-2xl border border-foreground/[0.08] bg-background/80 backdrop-blur-xl px-5 py-5 space-y-3.5">
            {PREP_ITEMS.map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 1.05 + i * 0.07 }}
                className="flex items-start gap-3"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <p className="font-body text-sm text-foreground/70 leading-relaxed">
                  {item}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── 4. Nurse Card Preview ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.15 }}
          className="space-y-3"
        >
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 px-1">
            Your Nurse
          </p>

          <div className="rounded-2xl border border-foreground/[0.08] bg-background/80 backdrop-blur-xl px-5 py-5">
            <div className="flex items-center gap-4 mb-4">
              {/* Avatar initials */}
              <div className="w-12 h-12 rounded-full border border-accent/30 bg-accent/5 flex items-center justify-center shrink-0">
                <span className="font-heading text-lg text-accent tracking-wide">SK</span>
              </div>
              <div>
                <p className="font-body text-sm text-foreground font-medium">
                  Sarah K., RN
                </p>
                <p className="font-body text-[11px] text-foreground/50 leading-relaxed">
                  8 years experience · Critical Care &amp; IV Therapy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4 px-0">
              <User className="w-3.5 h-3.5 text-foreground/30 shrink-0" strokeWidth={1.5} />
              <p className="font-body text-[11px] text-foreground/40 tracking-wide">
                California RN License #XXXXXX
              </p>
            </div>

            <div className="rounded-xl border border-accent/10 bg-accent/5 px-4 py-2.5">
              <p className="font-body text-[10px] text-accent/70 leading-relaxed tracking-wide">
                Full details — name, photo, and license — sent by text 30 min before arrival.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── 5. Footer Actions ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.28 }}
          className="space-y-4 pt-2"
        >
          {/* Add to Calendar */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors px-5 py-3.5 group"
            onClick={() => {/* placeholder */}}
          >
            <CalendarPlus className="w-4 h-4 text-foreground/50 group-hover:text-accent transition-colors" strokeWidth={1.5} />
            <span className="font-body text-sm text-foreground/60 group-hover:text-foreground transition-colors tracking-wide">
              Add to Calendar
            </span>
          </button>

          {/* Reschedule + Back to Home */}
          <div className="flex items-center justify-between px-1">
            <a
              href="sms:+14150000000"
              className="font-body text-xs text-foreground/40 hover:text-accent transition-colors tracking-wide"
            >
              Need to reschedule?{' '}
              <span className="underline underline-offset-4">Text us at (415) 000-0000</span>
            </a>

            <Link
              to="/"
              className="flex items-center gap-1.5 font-body text-xs tracking-[0.18em] uppercase text-foreground/40 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
              Back to Home
            </Link>
          </div>
        </motion.div>

      </div>

      <Footer />
    </div>
  );
}
