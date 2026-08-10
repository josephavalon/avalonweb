import { Calendar, MapPin, Leaf, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { useSeo } from '@/lib/seo';
import CannabisLeaf from '@/components/icons/CannabisLeaf';

// Dedicated marketing landing for the "Cannabis CE Night" event.
// The upstream card on /events (UPCOMING_EVENTS) links here so the event has
// a real page + shareable URL while details are finalized.
// If/when the event is created in the DB as an event_container, this can be
// deprecated in favor of the dynamic /events/:slug route.

const EVENT_ISO = '2026-08-28T19:00:00-07:00';

function formatFullDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

export default function CannabisCeNight() {
  useSeo({
    title: 'Cannabis CE Night — Avalon Vitality',
    description: 'An after-hours event exploring CBD IV therapy with clinician-led education. Details releasing soon; drop your email to be notified when tickets open.',
    path: '/events/cannabis-ce',
  });

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header><Navbar /></header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-[5.25rem] md:px-8 md:pt-[5.75rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/50">
          Upcoming event · Details releasing
        </p>
        <h1 className="mt-4 font-heading text-5xl uppercase leading-[0.9] tracking-tight text-foreground md:text-7xl">
          Cannabis <span className="inline-flex items-center gap-3"><CannabisLeaf className="h-10 w-10 md:h-14 md:w-14 text-foreground/85" /> CE</span> Night
        </h1>
        <p className="mt-4 max-w-xl font-body text-base font-semibold text-foreground/70 md:text-lg">
          An after-hours evening built around CBD IV therapy — clinician-led education, guided sessions, and the recovery lounge Avalon runs at every event.
        </p>

        <div className="mt-8 grid gap-3 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] p-5 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-foreground/60" strokeWidth={1.75} />
            <div>
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/50">When</p>
              <p className="mt-1 font-body text-sm font-semibold text-foreground">{formatFullDate(EVENT_ISO)}</p>
              <p className="font-body text-[13px] text-foreground/60">Doors at {formatTime(EVENT_ISO)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-foreground/60" strokeWidth={1.75} />
            <div>
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/50">Where</p>
              <p className="mt-1 font-body text-sm font-semibold text-foreground">San Francisco Bay Area</p>
              <p className="font-body text-[13px] text-foreground/60">Venue announced on notify list</p>
            </div>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground md:text-4xl">
            What to expect
          </h2>
          <ul className="mt-4 grid gap-3 font-body text-sm font-semibold text-foreground/72 md:text-base">
            <li className="flex items-start gap-3">
              <Leaf className="mt-0.5 h-5 w-5 shrink-0 text-foreground/60" strokeWidth={1.75} />
              <span>CBD IV therapy education from Avalon&apos;s licensed clinical team, with dose ranges from 33mg through 132mg.</span>
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-foreground/60" strokeWidth={1.75} />
              <span>Every service is clinician-reviewed. Eligibility and dosing are confirmed before treatment; nothing is administered without a good-faith exam on file.</span>
            </li>
            <li className="flex items-start gap-3">
              <CannabisLeaf className="mt-0.5 h-5 w-5 shrink-0 text-foreground/60" />
              <span>Recovery lounge with music, hospitality, and optional care from Avalon&apos;s independent clinical team.</span>
            </li>
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-[#C8F135]/25 bg-[#C8F135]/[0.05] p-6">
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-[#C8F135]">Notify me</p>
          <p className="mt-2 font-heading text-3xl uppercase leading-[0.95] text-foreground md:text-4xl">
            Tickets drop soon.
          </p>
          <p className="mt-3 max-w-lg font-body text-sm font-semibold text-foreground/72">
            Send your details through the event planner and we&apos;ll email you the moment the venue is confirmed and presale opens.
          </p>
          <Link
            to="/events#planner"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-6 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-background"
          >
            Get on the list <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <p className="mt-10 font-body text-[12px] text-foreground/45">
          Cannabis CE content is clinician-reviewed and held for legal and clinical review before publication. Nothing in this page constitutes medical advice.
        </p>
      </main>

      <ConsumerFooter />
    </div>
  );
}
