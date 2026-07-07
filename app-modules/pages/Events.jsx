import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Home, MapPin, Minus, PartyPopper, Plus, Tent } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AvalonMark from '@/components/AvalonMark';
import { useSeo } from '@/lib/seo';
import { fetchEventsFeed } from '@/lib/eventsApi';
import { formatPriceCents } from '@/lib/eventStatus';

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/* ───────────────────────── Airbnb-style builder ─────────────────────────
   Where / When / Who composes a "bring Avalon to your event" inquiry.
   Admit info only — setting, date, headcounts, contact email. */

const SETTINGS = [
  { icon: Home, label: 'A home or estate', hint: 'House parties, dinners, weekends' },
  { icon: Building2, label: 'An office', hint: 'Team days, offsites, wellness weeks' },
  { icon: PartyPopper, label: 'A venue or club', hint: 'Parties, launches, afterparties' },
  { icon: Tent, label: 'A festival or retreat', hint: 'Multi-day recovery lounges' },
  { icon: MapPin, label: 'Somewhere else', hint: 'We pull up wherever' },
];

function CountRow({ label, hint, value, onChange, max = 500 }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.08] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="flex min-w-0 flex-col">
        <span className="font-body text-sm font-bold text-foreground">{label}</span>
        <span className="font-body text-[12px] font-semibold text-foreground/45">{hint}</span>
      </span>
      <span className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.045] disabled:opacity-35"
          disabled={value === 0}
          aria-label={`Fewer ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-6 text-center font-heading text-xl uppercase leading-none">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.045]"
          aria-label={`More ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}

function EventBuilder({ builderRef }) {
  const [open, setOpen] = useState('');          // '' | 'where' | 'when' | 'who' | 'email'
  const [where, setWhere] = useState('');
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState(0);
  const [ivDrips, setIvDrips] = useState(0);
  const [shots, setShots] = useState(0);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen('');
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const whoSummary = guests || ivDrips || shots
    ? [guests && `${guests} guests`, ivDrips && `${ivDrips} IVs`, shots && `${shots} shots`].filter(Boolean).join(' · ')
    : '';

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
        body: JSON.stringify({ where, date, guests, ivDrips, shots, email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) throw new Error(body.error || 'Something went wrong — try again.');
      setSent(true);
      setOpen('');
    } catch (err) {
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setSending(false);
    }
  }

  const segment = (key, label, value, placeholder) => (
    <button
      type="button"
      onClick={() => setOpen(open === key ? '' : key)}
      className={`flex min-w-0 flex-1 flex-col items-start gap-0.5 px-5 py-3 text-left transition-colors ${open === key ? 'rounded-full bg-foreground/[0.07]' : ''}`}
    >
      <span className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-foreground">{label}</span>
      <span className={`w-full truncate font-body text-[13px] font-semibold ${value ? 'text-foreground/80' : 'text-foreground/40'}`}>
        {value || placeholder}
      </span>
    </button>
  );

  if (sent) {
    return (
      <div ref={builderRef} className="av-treatment-card rounded-[1.35rem] border px-5 py-6 text-center">
        <p className="font-heading text-2xl uppercase leading-none text-foreground">Request received</p>
        <p className="mt-2 font-body text-[13px] font-semibold text-foreground/55">
          We'll reply within 24 hours with a quote. We pull up with whatever, whoever, wherever.
        </p>
      </div>
    );
  }

  return (
    <div ref={(el) => { rootRef.current = el; if (builderRef) builderRef.current = el; }} className="relative">
      {/* Desktop pill */}
      <div className="hidden items-center rounded-full border border-foreground/14 bg-background/72 p-1.5 backdrop-blur-xl md:flex">
        {segment('where', 'Where', where, 'Your venue, home, office…')}
        <span className="h-8 w-px shrink-0 bg-foreground/12" />
        {segment('when', 'When', date ? formatEventDate(date) : '', 'Add a date')}
        <span className="h-8 w-px shrink-0 bg-foreground/12" />
        {segment('who', 'Who', whoSummary, 'Add your people')}
        <button
          type="button"
          onClick={() => setOpen(open === 'email' ? '' : 'email')}
          aria-label="Get a quote"
          className="ml-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-foreground/82 bg-foreground text-background transition-transform active:scale-[0.97]"
        >
          <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </div>

      {/* Mobile stacked builder */}
      <div className="av-treatment-card overflow-hidden rounded-[1.35rem] border md:hidden">
        {[
          ['where', 'Where', where || 'Your venue, home, office…', Boolean(where)],
          ['when', 'When', date ? formatEventDate(date) : 'Add a date', Boolean(date)],
          ['who', 'Who', whoSummary || 'Add your people', Boolean(whoSummary)],
        ].map(([key, label, value, hasValue]) => (
          <button
            key={key}
            type="button"
            onClick={() => setOpen(open === key ? '' : key)}
            className="flex w-full items-center justify-between gap-3 border-t border-foreground/[0.08] px-4 py-3.5 text-left first:border-t-0"
          >
            <span className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-foreground">{label}</span>
            <span className={`truncate font-body text-[13px] font-semibold ${hasValue ? 'text-foreground/80' : 'text-foreground/40'}`}>{value}</span>
          </button>
        ))}
        <div className="border-t border-foreground/[0.08] p-3">
          <button
            type="button"
            onClick={() => setOpen(open === 'email' ? '' : 'email')}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white px-4 font-heading text-base uppercase leading-none tracking-[0.08em] text-black"
          >
            Get a quote <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Panels */}
      {open ? (
        <div className="av-treatment-card z-30 mt-2 rounded-[1.35rem] border p-4 md:absolute md:inset-x-0 md:top-full md:p-5" style={{ background: 'rgba(13,13,13,0.96)' }}>
          {open === 'where' ? (
            <div>
              <input
                autoFocus
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="City, venue, or address"
                aria-label="Where is your event"
                className="min-h-[48px] w-full rounded-xl border border-foreground/14 bg-background/60 px-4 font-body text-sm font-semibold text-foreground outline-none placeholder:text-foreground/36 focus:border-foreground/34"
              />
              <p className="mb-2 mt-4 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/40">Suggested settings</p>
              <div className="grid gap-1">
                {SETTINGS.map(({ icon: Icon, label, hint }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setWhere(label); setOpen('when'); }}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-foreground/[0.06]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-foreground/[0.045]">
                      <Icon className="h-5 w-5 text-foreground/70" strokeWidth={1.8} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-body text-sm font-bold text-foreground">{label}</span>
                      <span className="truncate font-body text-[12px] font-semibold text-foreground/45">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : open === 'when' ? (
            <div>
              <p className="mb-2 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/40">When is your event?</p>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setOpen('who'); }}
                aria-label="Event date"
                className="min-h-[48px] w-full rounded-xl border border-foreground/14 bg-background/60 px-4 font-body text-sm font-semibold text-foreground outline-none [color-scheme:dark] focus:border-foreground/34"
              />
              <p className="mt-3 font-body text-[12px] font-semibold text-foreground/45">No date yet? Leave it blank — we'll plan around you.</p>
            </div>
          ) : open === 'who' ? (
            <div>
              <CountRow label="Guests" hint="Roughly how many people" value={guests} onChange={setGuests} max={5000} />
              <CountRow label="IV drips" hint="Back on the floor in ~30 min" value={ivDrips} onChange={setIvDrips} />
              <CountRow label="Recovery shots" hint="Back on the floor in ~5 min" value={shots} onChange={setShots} max={2000} />
            </div>
          ) : (
            <div>
              <p className="mb-2 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/40">Where should the quote go?</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  aria-label="Your email"
                  className="min-h-[48px] w-full rounded-xl border border-foreground/14 bg-background/60 px-4 font-body text-sm font-semibold text-foreground outline-none placeholder:text-foreground/36 focus:border-foreground/34"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={sending}
                  className="flex min-h-[48px] shrink-0 items-center justify-center rounded-full bg-white px-6 font-heading text-base uppercase leading-none tracking-[0.08em] text-black disabled:opacity-60"
                >
                  {sending ? 'Sending…' : 'Send request'}
                </button>
              </div>
              {error ? <p role="alert" className="mt-2 font-body text-[13px] font-semibold text-foreground/75">{error}</p> : null}
              <p className="mt-2 font-body text-[12px] font-semibold text-foreground/45">
                We reply within 24 hours. Nothing medical is asked here.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── Luma-style discover rows ───────────────────────── */

function EventThumb({ event, size = 'h-[72px] w-[72px]' }) {
  return event.heroImage ? (
    <img src={event.heroImage} alt="" loading="lazy" className={`${size} shrink-0 rounded-xl border border-foreground/10 object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-foreground/[0.045]`}>
      <AvalonMark className="h-6 w-4 text-foreground/70" />
    </span>
  );
}

function EventRow({ event, dim = false }) {
  return (
    <Link
      to={`/events/${event.slug}`}
      className={`av-treatment-card flex items-center gap-4 rounded-[1.05rem] border p-3 transition-colors duration-base ease-editorial md:p-3.5 ${dim ? 'opacity-60 hover:opacity-90' : ''}`}
    >
      <EventThumb event={event} />
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

function SectionHead({ title, hint }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="font-heading text-4xl uppercase leading-none tracking-normal text-foreground md:text-5xl">{title}</h2>
      {hint ? <p className="font-body text-[12px] font-semibold text-foreground/45">{hint}</p> : null}
    </div>
  );
}

export default function Events() {
  const [feed, setFeed] = useState({ upcoming: [], previously: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const builderRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchEventsFeed()
      .then((data) => { if (alive) setFeed(data); })
      .catch((err) => { if (alive) setError(err.message || 'Events are unavailable right now.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useSeo({
    title: 'Events - Avalon Vitality',
    description: 'Discover Avalon recovery events — or bring Avalon to your own. IV therapy at parties, offices, and retreats. Back on the floor in ~30.',
    path: '/events',
  });

  function scrollToBuilder() {
    builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header>
        <Navbar />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-24 pt-[5.25rem] md:pt-[5.75rem]">
        <div className="mb-7 pt-8 text-center md:pt-12">
          <h1 className="font-heading text-[3.2rem] uppercase leading-[0.86] tracking-normal text-foreground md:text-[4.6rem]">
            Events
          </h1>
          <p className="mt-3 font-body text-[15px] font-semibold text-foreground/60">
            IV therapy at your event. Back on the floor in ~30 minutes.
          </p>
        </div>

        <EventBuilder builderRef={builderRef} />

        <section className="mt-12 md:mt-14">
          <SectionHead title="Upcoming" hint="San Francisco Bay Area" />
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-[96px] animate-pulse rounded-[1.05rem] border border-foreground/10 bg-foreground/[0.04]" />
              ))}
            </div>
          ) : error ? (
            <div className="av-treatment-card rounded-[1.05rem] border px-5 py-6 text-center">
              <p className="font-body text-sm font-semibold text-foreground/60">{error}</p>
            </div>
          ) : feed.upcoming.length === 0 ? (
            <div className="av-treatment-card rounded-[1.05rem] border px-5 py-6 text-center">
              <p className="font-heading text-2xl uppercase leading-none text-foreground">No events yet</p>
              <p className="mt-2 font-body text-[13px] font-semibold text-foreground/50">Members hear first. Check back soon.</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${feed.upcoming.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {feed.upcoming.map((event) => (
                <EventRow key={event.slug} event={event} />
              ))}
            </div>
          )}
        </section>

        {feed.previously.length > 0 && (
          <section className="mt-12">
            <SectionHead title="Previously" />
            <div className={`grid gap-3 ${feed.previously.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {feed.previously.map((event) => (
                <EventRow key={event.slug} event={event} dim />
              ))}
            </div>
          </section>
        )}

        <section className="mt-14 text-center">
          <h2 className="font-heading text-4xl uppercase leading-[0.9] tracking-normal text-foreground md:text-5xl">
            Your event. We pull up.
          </h2>
          <p className="mx-auto mt-3 max-w-md font-body text-[14px] font-semibold text-foreground/55">
            House party, offsite, festival, retreat — clinician-led recovery, delivered wherever you are.
          </p>
          <button
            type="button"
            onClick={scrollToBuilder}
            className="mx-auto mt-5 flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white px-8 font-heading text-lg uppercase leading-none tracking-[0.08em] text-black transition-transform hover:bg-white/95 active:scale-[0.99]"
          >
            Create your own event <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </main>

      <Footer />
    </div>
  );
}
