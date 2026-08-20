import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import CognitoFormEmbed from '@/components/forms/CognitoFormEmbed';
import { useSeo } from '@/lib/seo';

// Vital Ice × Avalon evergreen appointment front door.
// Same PHI posture as /start (see CognitoFormEmbed): the sealed Cognito form is
// the only intake surface; this page never observes a submit. The account key
// is shared with the shipping Avalon intake, but data-form points at a separate
// campaign form so submissions land in a dedicated Cognito entry queue.
const VITALICE_FORM_NUMBER = import.meta.env.VITE_COGNITO_VITALICE_FORM_ID;

// Exact reproduction of the Vital Ice header monogram from vitalicesf.com
// (their <header> SVG, verified 2026-08-05): a thin horizontal rail above
// two letters V and I in SF Pro Display 600.
function ViMark({ className = '' }) {
  return (
    <svg
      viewBox="0 0 120 60"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <line
        x1="28"
        y1="8"
        x2="72"
        y2="8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <text
        x="40"
        y="35"
        fontSize="32"
        fontWeight="600"
        fontFamily="'SF Pro Display', 'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        V
      </text>
      <text
        x="70"
        y="35"
        fontSize="32"
        fontWeight="600"
        fontFamily="'SF Pro Display', 'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        I
      </text>
    </svg>
  );
}

function CoBrandRibbon() {
  return (
    <div className="rounded-2xl bg-foreground text-background px-5 py-4 md:px-8 md:py-5">
      <div className="flex items-center justify-between gap-4">
        <ViMark className="h-10 w-20 md:h-12 md:w-24 text-background" />
        {/* Vital Ice's wordmark on their site is a raster image; approximate its
            thin, extremely-tracked feel with the body font at light weight
            rather than embedding a new webfont. */}
        <div className="font-body font-light text-[11px] uppercase tracking-[0.32em] text-background/90 md:text-[15px] md:tracking-[0.42em]">
          <span>Vital Ice</span>
          <span className="mx-2 md:mx-4 text-background/50">×</span>
          <span>Avalon Vitality</span>
        </div>
        <div className="flex items-center gap-2 text-background">
          <AvalonMark className="h-7 w-7 md:h-9 md:w-9" />
          <span className="hidden md:inline font-heading text-[15px] uppercase tracking-tight">
            Avalon Vitality
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Vitalice() {
  useSeo({
    title: 'Vital Ice × Avalon — Treatment Menu',
    description:
      'Vital Ice members: request a preferred appointment time for a mobile IV or B-12 shot with Avalon Vitality.',
    path: '/vitalice',
  });

  return (
    <div className="nd-flow app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden text-foreground">
      {/* Vital Ice-aligned hero backdrop. Fixed so it doesn't scroll off, with
          a soft cream veil on top to keep the co-brand ribbon (dark) and cream
          cards legible when they overlap the darker parts of the photo. */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <img
          src="/vitalice/vitalice-hero-glacier.webp"
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
        {/* No veil — let the glacier read at full weight; cards carry the
            legibility duty via their own opaque cream fill + shadow. */}
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 md:px-6 md:pt-10 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <CoBrandRibbon />

          <div className="mx-auto mt-8 max-w-2xl lg:mt-10">
            {/* START card */}
            <div className="rounded-[2rem] border border-foreground/[0.10] bg-background px-6 py-8 shadow-[0_20px_60px_-30px_rgba(43,33,27,0.35)] md:px-10 md:py-10">
              <div className="flex items-center gap-2 text-foreground">
                <AvalonMark className="h-7 w-7" />
                <span className="font-heading uppercase tracking-tight text-[1.15rem]">
                  Avalon Vitality
                </span>
              </div>

              <h1 className="mt-6 font-heading uppercase tracking-tight text-foreground text-[5.5rem] leading-[0.84] md:text-[7rem]">
                <span data-when="pre-submit">Start</span>
                <span data-when="post-submit">Received</span>
              </h1>
              <div
                data-when="pre-submit"
                className="mt-4 h-[3px] w-16 rounded-full bg-[#4FB3B8]"
                aria-hidden="true"
              />

              <div data-when="pre-submit">
                <h2 className="mt-7 font-body text-[1.6rem] font-semibold leading-tight text-foreground md:text-[1.85rem]">
                  Reserve Your Appointment
                </h2>
                <p className="mt-4 font-body text-[15px] leading-[1.55] text-foreground/75 md:text-base">
                  Choose your preferred appointment date and time. Our team will text to confirm availability.
                </p>
                <div className="mt-5 flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#4FB3B8]" strokeWidth={1.75} />
                  <p className="font-body text-[14px] leading-[1.55] text-foreground/75 md:text-[15px]">
                    Complete the form below to request your appointment.
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4" data-testid="vitalice-form">
                <CognitoFormEmbed compact tight formNumber={VITALICE_FORM_NUMBER} appointmentFields treatmentField />

                <p
                  data-when="pre-submit"
                  className="font-body text-sm font-medium leading-[1.55] text-foreground/65"
                >
                  Payment on site · No deposit required.
                </p>
                <p
                  data-when="pre-submit"
                  className="flex items-start gap-2 font-body text-[11px] font-medium leading-[1.55] text-foreground/50"
                >
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  By submitting, you consent to service-related SMS from Avalon Vitality. Reply STOP to opt out. Message and data rates may apply.
                </p>

                <Link
                  to="/"
                  data-when="post-submit"
                  data-testid="vitalice-return-home"
                  className="group mt-1 inline-flex w-fit items-center gap-2 border-b border-foreground/30 pb-1 font-body text-[1.0625rem] font-medium text-foreground transition-colors hover:border-foreground"
                >
                  Return home
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                </Link>
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
