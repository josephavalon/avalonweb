import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { fetchEventsFeed } from '@/lib/eventsApi';
import { formatPriceCents } from '@/lib/eventStatus';

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* Right-hand value, BuilderRow style: one quiet fact per row. */
function rowValue(event) {
  if (event.status === 'sold_out') return 'Sold out';
  if (event.status === 'ended') return 'Ended';
  if (event.priceFromCents != null) return `From ${formatPriceCents(event.priceFromCents)}`;
  return 'Coming soon';
}

function EventRow({ event, dim = false }) {
  return (
    <Link
      to={`/events/${event.slug}`}
      className={`av-treatment-card relative flex items-center justify-between gap-3 overflow-hidden rounded-[1.05rem] border px-4 py-4 transition-colors duration-base ease-editorial md:px-5 ${dim ? 'opacity-60 hover:opacity-90' : ''}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-xl uppercase leading-none tracking-normal text-foreground md:text-2xl">
          {event.name}
        </span>
        <span className="mt-1.5 truncate font-body text-[12px] font-semibold text-foreground/45 md:text-[13px]">
          {formatEventDate(event.startsAt)} · {event.venue || 'San Francisco'}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="text-right font-body text-[13px] font-semibold text-foreground/64 md:text-sm">
          {dim ? formatEventDate(event.startsAt) : rowValue(event)}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-foreground/70" strokeWidth={2} />
      </span>
    </Link>
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
    title: 'Events - Avalon Vitality',
    description: 'Reserve Avalon IV therapy at events: book in seconds, health check by a licensed provider, back on the floor in ~30 minutes.',
    path: '/events',
  });

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header>
        <Navbar />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-24 pt-[5.25rem] md:pt-[5.75rem]">
        <div className="mb-8 pt-8 text-center md:mb-10 md:pt-12">
          <h1 className="font-heading text-[3.2rem] uppercase leading-[0.86] tracking-normal text-foreground md:text-[4.6rem]">
            Events
          </h1>
          <p className="mt-3 font-body text-[15px] font-semibold text-foreground/60">
            IV therapy at your event. Back on the floor in ~30 minutes.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-[1.05rem] border border-foreground/10 bg-foreground/[0.04]" />
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
          <div className="flex flex-col gap-3">
            {feed.upcoming.map((event) => (
              <EventRow key={event.slug} event={event} />
            ))}
          </div>
        )}

        {feed.previously.length > 0 && (
          <>
            <p className="mb-3 mt-14 text-center font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground/40">
              Previously
            </p>
            <div className="flex flex-col gap-3">
              {feed.previously.map((event) => (
                <EventRow key={event.slug} event={event} dim />
              ))}
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
