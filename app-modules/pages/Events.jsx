import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE } from '@/lib/motion';
import { fetchEventsFeed } from '@/lib/eventsApi';
import { eventStateChip, formatPriceCents, MONO_STACK } from '@/lib/eventStatus';

const FALLBACK_COVER = '/backgrounds/iv-vitamins-hero.webp';

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

/* State chips are the ONLY scarcity signal (DESIGN.md) — mono voice, quiet. */
function StateChip({ status }) {
  const chip = eventStateChip(status);
  return (
    <span
      className="inline-flex min-h-8 items-center rounded-full border border-white/14 bg-black/40 px-3 text-[11px] tracking-[0.08em]"
      style={{ fontFamily: MONO_STACK, color: chip.color }}
    >
      {chip.label}
    </span>
  );
}

function EventCard({ event, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: EASE }}
      className="group relative min-h-[420px] overflow-hidden rounded-[1.35rem] border border-white/12 bg-background md:min-h-[520px]"
    >
      <Link to={`/events/${event.slug}`} className="absolute inset-0 z-10" aria-label={`View ${event.name}`} />
      <img
        src={event.heroImage || FALLBACK_COVER}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-700 group-hover:opacity-75"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/72 to-black/35" />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <StateChip status={event.status} />
        {event.priceFromCents != null ? (
          <span
            className="rounded-full border border-white/14 bg-black/40 px-3 py-2 text-[11px] text-white/80"
            style={{ fontFamily: MONO_STACK }}
          >
            FROM {formatPriceCents(event.priceFromCents)}
          </span>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
        <p className="text-xs text-white/60" style={{ fontFamily: MONO_STACK, letterSpacing: '0.1em' }}>
          {formatEventDate(event.startsAt)} · {(event.venue || 'SAN FRANCISCO').toUpperCase()}
        </p>
        <h2 className="mt-3 max-w-xl font-heading text-[4.25rem] uppercase leading-[0.82] text-white md:text-[5.75rem]">
          {event.name}
        </h2>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <span className="text-[11px] text-white/60" style={{ fontFamily: MONO_STACK, letterSpacing: '0.08em' }}>
            <span className="whitespace-nowrap">IV · BACK IN ~30</span>{' '}·{' '}
            <span className="whitespace-nowrap">SHOTS · BACK IN ~5</span>
          </span>
          <span className="relative z-20 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 font-body text-xs font-bold uppercase text-black transition group-hover:bg-white/88">
            Reserve <Sparkles className="h-4 w-4" strokeWidth={2} />
          </span>
        </div>
      </div>
    </motion.article>
  );
}

function PreviouslyStrip({ events }) {
  if (!events.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
      <div className="mb-5">
        <p className="font-body text-xs font-semibold uppercase text-foreground/42">Previously</p>
        <h2 className="mt-2 font-heading text-5xl uppercase leading-none text-foreground md:text-6xl">Past rooms</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Link
            key={event.slug}
            to={`/events/${event.slug}`}
            className="group relative min-h-[240px] overflow-hidden rounded-[1.25rem] border border-white/12 bg-background"
          >
            <img
              src={event.heroImage || FALLBACK_COVER}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-72 transition group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/28 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-xs text-white/54" style={{ fontFamily: MONO_STACK }}>
                {formatEventDate(event.startsAt)} · {(event.venue || '').toUpperCase()}
              </p>
              <h3 className="mt-2 font-heading text-4xl uppercase leading-none text-white">{event.name}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Events() {
  const [feed, setFeed] = useState({ upcoming: [], previously: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchEventsFeed()
      .then((data) => { if (alive) setFeed(data); })
      .catch((err) => { if (alive) setError(err.message || 'Events are unavailable right now.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useSeo({
    title: 'Avalon Events - Avalon Vitality',
    description: 'Reserve Avalon recovery lounges at events: photo-led event pages, three-tap reserve, concierge health check, and a day-of trip page.',
    path: '/events',
  });

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        {/* Ive-quiet: the photo is a whisper behind near-black. One scrim. */}
        <div className="absolute inset-0 bg-black/90" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
      </div>
      <Navbar />

      <main>
        <section className="mx-auto flex min-h-[52svh] max-w-7xl flex-col justify-end px-4 pb-16 pt-36 md:px-8 md:pb-20 md:pt-44">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <p className="text-[11px] uppercase text-foreground/45" style={{ fontFamily: MONO_STACK, letterSpacing: '0.3em' }}>
              Avalon events
            </p>
            <h1 className="mt-5 max-w-4xl font-heading text-[4.5rem] uppercase leading-[0.85] text-foreground md:text-[8rem]">
              The recovery room.
            </h1>
            <p className="mt-6 text-[11px] uppercase text-foreground/45" style={{ fontFamily: MONO_STACK, letterSpacing: '0.14em' }}>
              We deliver care · IV back in ~30 · shot back in ~5
            </p>
          </motion.div>
        </section>

        {loading ? (
          <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 md:grid-cols-2 md:px-8">
            {[0, 1].map((i) => (
              <div key={i} className="min-h-[420px] animate-pulse rounded-[1.35rem] border border-white/12 bg-white/[0.04] md:min-h-[520px]" />
            ))}
          </section>
        ) : error ? (
          <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
            <div className="rounded-[1.35rem] border border-white/12 p-8 text-center" style={{ background: 'rgba(13,13,13,0.94)' }}>
              <p className="font-body text-foreground/68">{error}</p>
            </div>
          </section>
        ) : feed.upcoming.length === 0 ? (
          <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
            <div className="rounded-[1.35rem] border border-white/12 p-10 text-center" style={{ background: 'rgba(13,13,13,0.94)' }}>
              <h2 className="font-heading text-4xl uppercase text-foreground">The next room is being built.</h2>
              <p className="mt-3 font-body text-sm text-foreground/60">Members hear first. Check back soon.</p>
            </div>
          </section>
        ) : (
          <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 md:grid-cols-2 md:px-8">
            {feed.upcoming.map((event, index) => (
              <EventCard key={event.slug} event={event} index={index} />
            ))}
          </section>
        )}

        <PreviouslyStrip events={feed.previously} />
      </main>

      <Footer />
    </div>
  );
}
