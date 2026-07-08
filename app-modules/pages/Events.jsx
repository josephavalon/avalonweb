import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Armchair, ArrowRight, Briefcase, Calendar, ChevronDown, Clock, Droplet, Gem, MapPin,
  MoreHorizontal, Music, Pill, Presentation, Sparkles, Star, Syringe, Tent, Users, Wine,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AvalonMark from '@/components/AvalonMark';
import CannabisLeaf from '@/components/icons/CannabisLeaf';
import { useSeo } from '@/lib/seo';
import { fetchEventsFeed } from '@/lib/eventsApi';
import { formatPriceCents } from '@/lib/eventStatus';

const EVENT_TYPES = [
  { key: 'Corporate', icon: Briefcase },
  { key: 'Wedding', icon: Gem },
  { key: 'Concert', icon: Music },
  { key: 'Private Party', icon: Wine },
  { key: 'Athletic', icon: Activity },
  { key: 'Conference', icon: Presentation },
  { key: 'Festival', icon: Tent },
  { key: 'Other', icon: MoreHorizontal },
];

const GUEST_RANGES = ['4 – 10', '11 – 25', '26 – 50', '51 – 100', '100+'];

const SERVICES = [
  { key: 'IV Therapy', icon: Droplet },
  { key: 'NAD+', icon: Sparkles },
  { key: 'IM Injections', icon: Syringe },
  { key: 'CBD', icon: CannabisLeaf },
  { key: 'Vitamin Therapy', icon: Pill },
  { key: 'Recovery Lounge', icon: Armchair },
  { key: 'Other', icon: MoreHorizontal },
];

const inputClass = 'min-h-[52px] w-full rounded-xl border border-foreground/14 bg-background/60 px-4 font-body text-sm font-semibold text-foreground outline-none transition placeholder:text-foreground/36 focus:border-foreground/34';
const whiteBtn = { background: '#fff', color: '#000' };   // true white — the global bg-white neutralizer would repaint it dark

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function sectionLabel(text) {
  return <p className="mb-3 font-body text-[12px] font-black uppercase tracking-[0.12em] text-foreground/60">{text}</p>;
}

/* ───────────────────────── 60-second planner ───────────────────────── */

function EventPlanner() {
  const [where, setWhere] = useState('');
  const [date, setDate] = useState('');
  const [eventType, setEventType] = useState('');
  const [guestRange, setGuestRange] = useState('');
  const [services, setServices] = useState([]);
  const [active, setActive] = useState('where');   // one editor open at a time — the tiles ARE the controls
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const summary = [
    { key: 'where', icon: MapPin, label: 'Where', value: where || 'Anywhere', set: Boolean(where) },
    { key: 'when', icon: Calendar, label: 'When', value: date ? formatEventDate(date) : 'Any date', set: Boolean(date) },
    { key: 'guests', icon: Users, label: 'Guests', value: guestRange || 'Any size', set: Boolean(guestRange) },
    { key: 'type', icon: Star, label: 'Event type', value: eventType || 'Choose', set: Boolean(eventType) },
    { key: 'services', icon: Droplet, label: 'Services', value: services.length ? services.slice(0, 2).join(', ') + (services.length > 2 ? '…' : '') : 'Choose', set: services.length > 0 },
  ];

  function toggleService(key) {
    setServices((cur) => (cur.includes(key) ? cur.filter((s) => s !== key) : [...cur, key]));
  }

  async function submit() {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Add your email so we can send your quote.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/events/host-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ where, date, eventType, guestRange, services, email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) throw new Error(body.error || 'Something went wrong — try again.');
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="av-treatment-card rounded-[1.35rem] border px-5 py-10 text-center">
        <p className="font-heading text-3xl uppercase leading-none text-foreground">Request received</p>
        <p className="mx-auto mt-3 max-w-sm font-body text-[14px] font-semibold text-foreground/55">
          Your quote lands at {email.trim()} within 24 hours. We pull up with whatever, whoever, wherever.
        </p>
      </div>
    );
  }

  /* The editor panel for whichever tile is active. */
  const panels = {
    where: (
      <div>
        {sectionLabel('Where is your event?')}
        <input
          autoFocus
          className={inputClass}
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setActive('when'); }}
          placeholder="City, venue, or address"
          aria-label="Where is your event"
          autoComplete="off"
        />
      </div>
    ),
    when: (
      <div>
        {sectionLabel('When is your event?')}
        <input
          type="date"
          className={`${inputClass} [color-scheme:dark]`}
          value={date}
          onChange={(e) => { setDate(e.target.value); setActive('guests'); }}
          aria-label="Event date"
        />
        <p className="mt-2 font-body text-[12px] font-semibold text-foreground/45">No date yet? Skip it — we'll plan around you.</p>
      </div>
    ),
    guests: (
      <div>
        {sectionLabel('How many guests?')}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {GUEST_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => { setGuestRange(guestRange === range ? '' : range); setActive('type'); }}
              aria-pressed={guestRange === range}
              className={`min-h-[44px] rounded-full border px-3 font-body text-[13px] font-bold transition-colors ${
                guestRange === range ? 'border-foreground/70 bg-foreground/[0.09] text-foreground' : 'border-foreground/14 text-foreground/70 hover:border-foreground/28'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
    ),
    type: (
      <div>
        {sectionLabel("What's the type of event?")}
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
          {EVENT_TYPES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setEventType(eventType === key ? '' : key); setActive('services'); }}
              aria-pressed={eventType === key}
              className={`flex flex-col items-center gap-2 rounded-[1.05rem] border px-2 py-4 transition-colors ${
                eventType === key ? 'border-foreground/60 bg-foreground/[0.08]' : 'border-foreground/12 bg-foreground/[0.03] hover:border-foreground/26'
              }`}
            >
              <Icon className="h-5 w-5 text-foreground/80" strokeWidth={1.6} />
              <span className="font-body text-[11px] font-semibold text-foreground/75">{key}</span>
            </button>
          ))}
        </div>
      </div>
    ),
    services: (
      <div>
        {sectionLabel('Which services are you interested in?')}
        <div className="flex flex-wrap gap-2">
          {SERVICES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleService(key)}
              aria-pressed={services.includes(key)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 font-body text-[13px] font-bold transition-colors ${
                services.includes(key) ? 'border-foreground/70 bg-foreground/[0.09] text-foreground' : 'border-foreground/14 text-foreground/70 hover:border-foreground/28'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {key}
            </button>
          ))}
        </div>
      </div>
    ),
  };

  const tileButton = ({ key, icon: Icon, label, value, set }, i, mobile = false) => (
    <button
      key={key}
      type="button"
      onClick={() => setActive(active === key && !mobile ? key : active === key ? '' : key)}
      aria-expanded={active === key}
      className={
        mobile
          ? `flex w-full items-center gap-4 px-4 py-4 text-left transition-colors ${i > 0 ? 'border-t border-foreground/[0.08]' : ''} ${active === key ? 'bg-foreground/[0.06]' : ''}`
          : `flex flex-col items-center gap-2 px-3 py-5 text-center transition-colors ${i > 0 ? 'border-l border-foreground/[0.08]' : ''} ${active === key ? 'bg-foreground/[0.07]' : 'hover:bg-foreground/[0.04]'}`
      }
    >
      <Icon className={`${mobile ? 'h-5 w-5' : 'h-6 w-6'} shrink-0 text-foreground/70`} strokeWidth={1.6} />
      <span className={mobile ? 'flex min-w-0 flex-col' : 'contents'}>
        <span className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-foreground">{label}</span>
        <span className={`font-body text-[13px] font-semibold ${set ? 'text-foreground/80' : 'text-foreground/45'} ${mobile ? 'truncate' : 'line-clamp-1'}`}>
          {value}
        </span>
      </span>
      <ChevronDown
        className={`h-4 w-4 shrink-0 text-foreground/50 transition-transform duration-300 ${active === key ? 'rotate-180' : ''} ${mobile ? 'ml-auto' : ''}`}
        strokeWidth={2}
      />
    </button>
  );

  return (
    <div>
      {/* Desktop: the tiles ARE the controls — one editor panel opens below */}
      <div className="hidden md:block">
        <div className="av-treatment-card grid rounded-[1.35rem] border md:grid-cols-5">
          {summary.map((tile, i) => tileButton(tile, i))}
        </div>
        {active && panels[active] ? (
          <div className="av-treatment-card mt-3 rounded-[1.35rem] border p-5">{panels[active]}</div>
        ) : null}
      </div>

      {/* Mobile: accordion — each row expands its editor inline */}
      <div className="av-treatment-card overflow-hidden rounded-[1.35rem] border md:hidden">
        {summary.map((tile, i) => (
          <div key={tile.key}>
            {tileButton(tile, i, true)}
            {active === tile.key ? (
              <div className="border-t border-foreground/[0.08] px-4 pb-5 pt-4">{panels[tile.key]}</div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-8">
        {sectionLabel('Where should the quote go?')}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            aria-label="Your email"
            autoComplete="email"
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-full px-8 font-heading text-lg uppercase leading-none tracking-[0.08em] transition-transform active:scale-[0.99] disabled:opacity-60"
            style={whiteBtn}
          >
            {sending ? 'Sending…' : 'Get a quote'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {error ? <p role="alert" className="mt-2 font-body text-[13px] font-semibold text-foreground/75">{error}</p> : null}
        <p className="mt-2 font-body text-[12px] font-semibold text-foreground/50">
          Transparent pricing. Nothing medical is asked here.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── Luma-style discover rows ───────────────────────── */

function EventRow({ event, dim = false }) {
  return (
    <Link
      to={`/events/${event.slug}`}
      className={`av-treatment-card flex items-center gap-4 rounded-[1.05rem] border p-3 transition-colors duration-base ease-editorial md:p-3.5 ${dim ? 'opacity-60 hover:opacity-90' : ''}`}
    >
      {event.heroImage ? (
        <img src={event.heroImage} alt="" loading="lazy" className="h-[72px] w-[72px] shrink-0 rounded-xl border border-foreground/10 object-cover" />
      ) : (
        <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-foreground/[0.045]">
          <AvalonMark className="h-6 w-4 text-foreground/70" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-body text-[12px] font-semibold text-foreground/50">
          {formatEventDate(event.startsAt)}{event.startsAt ? ` · ${formatEventTime(event.startsAt)}` : ''}
        </span>
        <span className="mt-0.5 truncate font-heading text-xl uppercase leading-none tracking-normal text-foreground md:text-2xl">
          {event.name}
        </span>
        <span className="mt-1 truncate font-body text-[12px] font-semibold text-foreground/45">
          {event.venue || 'San Francisco'}
        </span>
      </span>
      <span className="shrink-0 text-right font-body text-[13px] font-semibold text-foreground/64">
        {dim ? '' : event.status === 'sold_out' ? 'Sold out' : event.priceFromCents != null ? `From ${formatPriceCents(event.priceFromCents)}` : 'Soon'}
      </span>
    </Link>
  );
}

const HOW_IT_WORKS = [
  { step: '1', title: 'Tell us about your event', text: 'Share the basics and what you need.' },
  { step: '2', title: 'Customize services', text: "We'll help build the perfect wellness experience." },
  { step: '3', title: 'Receive your quote', text: 'Transparent pricing. Fast response.' },
  { step: '4', title: 'Build your event page', text: 'Private landing page so guests can RSVP and prep.' },
  { step: '5', title: 'Prescreen attendees', text: 'Intake & consent forms collected before we arrive.' },
];


export default function Events() {
  const [feed, setFeed] = useState({ upcoming: [], previously: [] });
  const [loading, setLoading] = useState(true);
  const plannerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchEventsFeed()
      .then((data) => { if (alive) setFeed(data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useSeo({
    title: 'Wellness For Your Event - Avalon Vitality',
    description: 'IV therapy, recovery, and wellness care for events of any size. Plan your event in under 60 seconds — quotes delivered within 24 hours.',
    path: '/events',
  });

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header>
        <Navbar />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-[5.25rem] md:px-8 md:pt-[5.75rem]">
        {/* Planner */}
        <section ref={plannerRef} className="scroll-mt-24 pt-6">
          <div className="mb-7 text-center">
            <h2 className="font-heading text-[13vw] uppercase leading-[0.9] tracking-tight text-foreground md:text-7xl lg:text-8xl">
              Let's build your event
            </h2>
          </div>
          <EventPlanner />
        </section>

        {/* How it works */}
        <section className="mt-16">
          <h2 className="mb-8 font-heading text-[13vw] uppercase leading-[0.9] tracking-tight text-foreground md:text-7xl lg:text-8xl">
            How it works
          </h2>
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
            {HOW_IT_WORKS.map(({ step, title, text }) => (
              <div key={step} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/20 font-heading text-lg text-foreground">
                  {step}
                </span>
                <span className="flex flex-col">
                  <span className="font-body text-[13px] font-black uppercase tracking-[0.06em] text-foreground">{title}</span>
                  <span className="mt-1 font-body text-[13px] font-semibold leading-relaxed text-foreground/50">{text}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Avalon-hosted events */}
        {!loading && (feed.upcoming.length > 0 || feed.previously.length > 0) ? (
          <section className="mt-16">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="font-heading text-[13vw] uppercase leading-[0.9] tracking-tight text-foreground md:text-7xl lg:text-8xl">
                Upcoming
              </h2>
              <p className="pb-1.5 font-body text-xs uppercase tracking-[0.18em] text-foreground/55 md:text-sm">
                San Francisco Bay Area
              </p>
            </div>
            <div className={`grid gap-3 ${feed.upcoming.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {feed.upcoming.map((event) => (
                <EventRow key={event.slug} event={event} />
              ))}
            </div>
            {feed.previously.length > 0 ? (
              <>
                <p className="mb-3 mt-10 font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground/40">Previously</p>
                <div className={`grid gap-3 ${feed.previously.length > 1 ? 'md:grid-cols-2' : ''}`}>
                  {feed.previously.map((event) => (
                    <EventRow key={event.slug} event={event} dim />
                  ))}
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        <p className="mt-16 flex items-center justify-center gap-3 text-center font-body text-[11px] font-black uppercase tracking-[0.2em] text-foreground/45">
          Registered nurses <AvalonMark className="h-4 w-3 text-foreground/70" /> Premium care. Anywhere.
        </p>
      </main>

      <Footer />
    </div>
  );
}
