import { useState } from 'react';
import { ArrowRight, Calendar, GraduationCap, MapPin, MessagesSquare, Sofa } from 'lucide-react';
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

// Doses and prices come from the shipping catalog (src/data/catalog/iv-sessions.js,
// the `cbd` session) so the event page can never drift from the booking flow.
const TICKETS = [
  { key: 'cbd_33', label: '33mg', price: 250, duration: '45 min', image: '/bags/cbd-33.webp' },
  { key: 'cbd_66', label: '66mg', price: 300, duration: '45 min', image: '/bags/cbd-66.webp' },
  { key: 'cbd_vitality', label: 'Vitality', price: 350, duration: '45 min', image: '/bags/cbd-vitality.webp', note: '66mg CBD + vitamins & hydration' },
  { key: 'cbd_99', label: '99mg', price: 350, duration: '45 min', image: '/bags/cbd-99.webp' },
  { key: 'cbd_132', label: '132mg', price: 450, duration: '45 min', image: '/bags/cbd-132.webp' },
];

// Subset of src/data/catalog/iv-addons.js that makes sense on an evening event.
// The approval-gated "CBD Review" line items are deliberately excluded — that is
// the eligibility gate, not something a guest adds to a cart.
const ADDONS = [
  { label: 'Extra Fluid', price: 50, desc: 'Additional 500ml saline', img: '/addons/extra-fluid.png' },
  { label: 'Extra Ingredients', price: 30, desc: 'B-complex, minerals, and amino support', img: '/addons/extra-ingredients.png' },
  { label: 'Glutathione Push · 600mg', price: 60, desc: 'Antioxidant support', img: '/addons/glutathione-iv.png' },
  { label: 'Magnesium Support', price: 30, desc: 'Magnesium support', img: '/addons/magnesium-iv.png' },
  { label: 'Vitamin C IV Push · 5g', price: 45, desc: 'Entry high-dose antioxidant support', img: '/addons/vitamin-c-iv.png' },
];

const WHAT_TO_EXPECT = [
  { title: 'CBD IV therapy', copy: 'Clinician-administered CBD IV therapy with dose ranges from 33mg through 132mg.', icon: CannabisLeaf },
  { title: 'Continuing education', copy: 'Earn CE credits with approved cannabis and CBD therapy education.', icon: GraduationCap },
  { title: 'Guided sessions', copy: 'Q&A and discussions with leading clinicians and industry experts.', icon: MessagesSquare },
  { title: 'Recovery lounge', copy: 'Unwind with our recovery lounge, hydration, and community.', icon: Sofa },
];

const AGENDA = [
  { time: '7:00 PM', label: 'Doors', detail: 'Check-in, welcome, and recovery lounge opens.' },
  { time: '7:30 PM', label: 'Program', detail: 'Clinician-led CE session on CBD IV therapy and dosing.' },
  { time: '9:30 PM', label: 'Recovery lounge', detail: 'Open lounge, hydration, and optional clinical services until 11:00 PM.' },
];

const FAQ = [
  { q: 'Do I need to be a licensed clinician to attend?', a: 'No. The CE credit track is for licensed clinicians and wellness professionals, but the evening is open to anyone interested in the education and the recovery lounge.' },
  { q: 'Is a CBD IV included with entry?', a: 'No. Entry covers the program and the lounge. CBD IV sessions and add-ons are booked separately and are subject to clinical review.' },
  { q: 'Where is it?', a: 'San Francisco Bay Area. The exact venue is released to the notify list before the event.' },
  { q: 'What is the clinical review?', a: 'Every CBD service is approval-gated. Eligibility and dosing are confirmed by a licensed clinician before anything is administered.' },
];

const TABS = [
  { key: 'about', label: 'About' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'who', label: "Who it's for" },
  { key: 'faq', label: 'FAQ' },
];

const MONO = { fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace", fontVariantNumeric: 'tabular-nums' };

function formatFullDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function FactRow({ icon: Icon, label, value, detail }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground/60" strokeWidth={1.75} />
      <div>
        <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/50">{label}</p>
        <p className="mt-1 font-body text-sm font-semibold text-foreground">{value}</p>
        {detail ? <p className="font-body text-[13px] text-foreground/60">{detail}</p> : null}
      </div>
    </div>
  );
}

export default function CannabisCeNight() {
  const [tab, setTab] = useState('about');

  useSeo({
    title: 'Cannabis CE Night — Avalon Vitality',
    description: 'An after-hours event exploring CBD IV therapy with clinician-led education. Friday, August 28, 2026 in the San Francisco Bay Area.',
    path: '/events/cannabis-ce',
  });

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header><Navbar /></header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-32 md:px-8 md:pt-36">

        {/* Hero — copy left, event photograph right. */}
        <section className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/50">
              Upcoming event
            </p>
            <h1 className="mt-3 font-heading text-5xl uppercase leading-[0.9] tracking-tight text-foreground md:text-7xl">
              Cannabis <span className="inline-flex items-center gap-3"><CannabisLeaf className="h-10 w-10 text-foreground/85 md:h-14 md:w-14" /> CE</span> Night
            </h1>
            <p className="mt-5 max-w-xl font-body text-base text-foreground/70 md:text-lg">
              An after-hours evening built around CBD IV therapy — clinician-led education, guided sessions, and the recovery lounge Avalon runs at every event.
            </p>

            <div className="mt-7 grid gap-4">
              <FactRow icon={Calendar} label="When" value={formatFullDate(EVENT_ISO)} detail={`Doors at ${formatTime(EVENT_ISO)}`} />
              <FactRow icon={MapPin} label="Where" value="San Francisco Bay Area" detail="Venue announced on notify list" />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#tickets"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-7 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-background transition hover:opacity-90"
              >
                Reserve your spot <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#details"
                className="inline-flex min-h-12 items-center rounded-full border border-foreground/20 px-7 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground transition hover:border-foreground/40"
              >
                Event details
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-foreground/[0.10]">
            <img
              src="/images/events/avalon-events-editorial-hero.jpg"
              alt="Avalon nurse preparing IV therapy at an Avalon Vitality event"
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </div>
        </section>

        {/* Tabs */}
        <div id="details" className="mt-14 scroll-mt-24 border-b border-foreground/[0.12]">
          <div className="no-scrollbar -mb-px flex gap-8 overflow-x-auto" role="tablist" aria-label="Event information">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`min-h-11 whitespace-nowrap border-b-2 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition ${
                  tab === key
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-foreground/45 hover:text-foreground/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8" role="tabpanel">
          {tab === 'about' ? (
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-4 font-body text-sm text-foreground/72 md:text-base">
                <p>Cannabis CE Night brings together licensed clinicians and wellness professionals for a night of continuing education, real discussions, and recovery.</p>
                <p>Enjoy CBD IV therapy, connect with the community, and leave feeling better than you came.</p>
              </div>

              <div className="grid gap-6 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] p-6 sm:grid-cols-3">
                <div>
                  <Calendar className="h-5 w-5 text-foreground/60" strokeWidth={1.75} />
                  <p className="mt-3 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/50">When</p>
                  <p className="mt-2 font-body text-sm font-semibold text-foreground">{formatFullDate(EVENT_ISO)}</p>
                  <p className="mt-1 font-body text-[13px] text-foreground/60" style={MONO}>Doors {formatTime(EVENT_ISO)}</p>
                  <p className="font-body text-[13px] text-foreground/60" style={MONO}>Program 7:30 – 9:30 PM</p>
                  <p className="font-body text-[13px] text-foreground/60" style={MONO}>Lounge 9:30 – 11:00 PM</p>
                </div>
                <div>
                  <MapPin className="h-5 w-5 text-foreground/60" strokeWidth={1.75} />
                  <p className="mt-3 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/50">Where</p>
                  <p className="mt-2 font-body text-sm font-semibold text-foreground">San Francisco Bay Area</p>
                  <p className="mt-1 font-body text-[13px] text-foreground/60">Venue announced on notify list</p>
                  <Link to="/events#planner" className="mt-2 inline-flex items-center gap-1.5 font-body text-[13px] font-semibold text-foreground underline underline-offset-4">
                    Join notify list <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div>
                  <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/50">Hosted by</p>
                  <p className="mt-2 font-heading text-2xl uppercase leading-none text-foreground">Avalon Vitality</p>
                  <p className="mt-2 font-body text-[13px] text-foreground/60">with the Cannabis Education Collaborative</p>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'agenda' ? (
            <ul className="divide-y divide-foreground/[0.10] border-y border-foreground/[0.10]">
              {AGENDA.map(({ time, label, detail }) => (
                <li key={time} className="flex flex-col gap-1 py-5 sm:flex-row sm:gap-8">
                  <span className="w-24 shrink-0 font-body text-sm font-semibold text-foreground" style={MONO}>{time}</span>
                  <div>
                    <p className="font-body text-sm font-bold text-foreground">{label}</p>
                    <p className="mt-1 font-body text-sm text-foreground/65">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === 'who' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Licensed clinicians', 'Nurses, NPs, and physicians earning CE credit on cannabis and CBD therapy.'],
                ['Wellness professionals', 'Practitioners who want a clinical grounding in CBD IV therapy.'],
                ['Industry and community', 'Anyone curious about the education, the discussion, and the lounge.'],
                ['Existing Avalon guests', 'Members and past guests who want the evening and optional services.'],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] p-5">
                  <p className="font-body text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-2 font-body text-sm text-foreground/65">{copy}</p>
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'faq' ? (
            <dl className="divide-y divide-foreground/[0.10] border-y border-foreground/[0.10]">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="py-5">
                  <dt className="font-body text-sm font-bold text-foreground">{q}</dt>
                  <dd className="mt-2 max-w-2xl font-body text-sm text-foreground/65">{a}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {/* What to expect */}
        <section className="mt-14">
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground md:text-4xl">
            What to expect
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHAT_TO_EXPECT.map(({ title, copy, icon: Icon }) => (
              <div key={title}>
                <Icon className="h-6 w-6 text-foreground/60" strokeWidth={1.75} />
                <p className="mt-3 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">{title}</p>
                <p className="mt-2 font-body text-sm text-foreground/65">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ticket options */}
        <section id="tickets" className="mt-14 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground md:text-4xl">
              Ticket options
            </h2>
            <p className="font-body text-[12px] text-foreground/55">
              Entry is free on the notify list. CBD IV sessions are optional and clinician-reviewed.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TICKETS.map(({ key, label, price, duration, image, note }) => (
              <article key={key} className="flex items-center gap-4 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] p-4">
                <img src={image} alt="" className="h-20 w-16 shrink-0 rounded-lg object-contain" loading="lazy" />
                <div className="min-w-0">
                  <p className="font-heading text-2xl uppercase leading-none text-foreground">CBD {label}</p>
                  {note ? <p className="mt-1 font-body text-[12px] text-foreground/60">{note}</p> : null}
                  <p className="mt-2 font-body text-[12px] text-foreground/55" style={MONO}>{duration}</p>
                  <p className="mt-1 font-body text-lg font-bold text-foreground" style={MONO}>${price}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-[#C8F135]/25 bg-[#C8F135]/[0.05] p-5">
            <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70">Clinical review required</p>
            <p className="mt-2 max-w-2xl font-body text-sm text-foreground/72">
              Every CBD service is approval-gated. Eligibility and dosing are confirmed by a licensed clinician before anything is administered — nothing is booked without a good-faith exam on file.
            </p>
          </div>
        </section>

        {/* Add-ons */}
        <section className="mt-14">
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground md:text-4xl">
            Add-ons
          </h2>
          <p className="mt-2 font-body text-[13px] text-foreground/55">Added to any CBD IV session on the night.</p>

          <ul className="mt-6 divide-y divide-foreground/[0.10] border-y border-foreground/[0.10]">
            {ADDONS.map(({ label, price, desc, img }) => (
              <li key={label} className="flex items-center gap-4 py-4">
                <img src={img} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-bold text-foreground">{label}</p>
                  <p className="mt-0.5 font-body text-[13px] text-foreground/60">{desc}</p>
                </div>
                <p className="shrink-0 font-body text-base font-bold text-foreground" style={MONO}>${price}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Notify */}
        <section className="mt-14 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] p-6">
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/50">Notify me</p>
          <p className="mt-2 font-heading text-3xl uppercase leading-[0.95] text-foreground md:text-4xl">
            Venue drops soon.
          </p>
          <p className="mt-3 max-w-lg font-body text-sm text-foreground/72">
            Send your details through the event planner and we&apos;ll email you the moment the venue is confirmed and reservations open.
          </p>
          <Link
            to="/events#planner"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-6 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-background"
          >
            Get on the list <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <p className="mt-10 font-body text-[12px] text-foreground/45">
          Cannabis CE content is clinician-reviewed and held for legal and clinical review before publication. Nothing on this page constitutes medical advice.
        </p>
      </main>

      <ConsumerFooter />
    </div>
  );
}
