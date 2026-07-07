import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AvalonMark from '@/components/AvalonMark';
import { fetchEvent } from '@/lib/eventsApi';
import { formatPriceCents } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

function formatDayLong(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatEventTime(startIso, endIso) {
  if (!startIso) return '';
  const opts = { hour: 'numeric', minute: '2-digit' };
  const start = new Date(startIso).toLocaleTimeString('en-US', opts);
  const end = endIso ? ` – ${new Date(endIso).toLocaleTimeString('en-US', opts)}` : '';
  return `${start}${end}`;
}

function blocksOf(event) {
  const blocks = event.descriptionBlocks;
  if (Array.isArray(blocks)) return { included: [], goodToKnow: [], description: '', vibe: '' };
  return {
    vibe: blocks?.vibe || '',
    description: blocks?.description || '',
    included: Array.isArray(blocks?.included) ? blocks.included : [],
    goodToKnow: Array.isArray(blocks?.goodToKnow) ? blocks.goodToKnow : [],
  };
}

/* Organizer photos only — no stock fallback (never the IV bag). */
function uploadedPhotos(event) {
  return (event.assets || [])
    .map((a) => a.renditions?.hero_1920 || a.renditions?.card_640 || a.storage_path)
    .filter(Boolean);
}

/* Luma-style icon chip rows: calendar tile for the date, pin tile for place. */
function CalendarChip({ iso }) {
  const d = iso ? new Date(iso) : null;
  return (
    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-foreground/14 bg-foreground/[0.045]">
      <span className="font-body text-[9px] font-black uppercase tracking-[0.12em] text-foreground/55">
        {d ? d.toLocaleDateString('en-US', { month: 'short' }) : 'TBA'}
      </span>
      <span className="font-heading text-xl leading-none text-foreground">{d ? d.getDate() : '—'}</span>
    </span>
  );
}

function InfoRow({ chip, title, hint }) {
  return (
    <div className="flex items-center gap-3.5">
      {chip}
      <span className="flex min-w-0 flex-col">
        <span className="font-body text-[15px] font-bold text-foreground">{title}</span>
        {hint ? <span className="mt-0.5 font-body text-[13px] font-semibold text-foreground/50">{hint}</span> : null}
      </span>
    </div>
  );
}

function TierRow({ tier, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={tier.soldOut}
      aria-pressed={active}
      className={`flex w-full items-center justify-between gap-3 rounded-[1.05rem] border px-4 py-3.5 text-left transition-colors ${
        active
          ? 'border-foreground/55 bg-foreground/[0.07]'
          : tier.soldOut
            ? 'cursor-not-allowed border-foreground/8 opacity-45'
            : 'border-foreground/12 bg-foreground/[0.03] hover:border-foreground/28'
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="font-body text-sm font-bold text-foreground">{tier.name}</span>
        {tier.description ? (
          <span className="mt-1 font-body text-[12px] font-semibold leading-relaxed text-foreground/50">{tier.description}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-right font-body text-sm font-bold text-foreground/80">
        {tier.soldOut ? 'Sold out' : tier.applicationGated ? 'Apply' : tier.priceCents > 0 ? formatPriceCents(tier.priceCents) : 'Free'}
      </span>
    </button>
  );
}

function QuietList({ label, items }) {
  if (!items.length) return null;
  return (
    <div className="mt-7">
      <p className="font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/40">{label}</p>
      <div className="mt-2">
        {items.map((item) => (
          <p key={item} className="border-t border-foreground/[0.08] py-2.5 font-body text-[13px] font-semibold leading-relaxed text-foreground/60 first:border-t-0">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function EventPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tierId, setTierId] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEvent(slug)
      .then((data) => {
        if (!alive) return;
        setEvent(data);
        // Feature the accessible clinical tier — never the experience add-on.
        const open = (data?.tiers || []).find((t) => !t.soldOut && !t.applicationGated && !t.experienceOnly)
          || (data?.tiers || []).find((t) => !t.soldOut && !t.applicationGated)
          || data?.tiers?.[0];
        setTierId(open?.id || '');
      })
      .catch(() => { if (alive) setEvent(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  useSeo({
    title: event ? `${event.name} - Avalon Events` : 'Avalon Events - Avalon Vitality',
    description: 'Avalon recovery lounge — reserve your spot.',
    path: `/events/${slug}`,
  });

  if (loading) {
    return (
      <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
        <header><Navbar /></header>
        <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 pb-24 pt-[9rem] md:grid-cols-[340px_1fr] md:px-8">
          <div className="aspect-square animate-pulse rounded-[1.35rem] border border-foreground/10 bg-foreground/[0.04]" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-[1.05rem] border border-foreground/10 bg-foreground/[0.04]" />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
        <header><Navbar /></header>
        <main className="mx-auto flex min-h-[70svh] max-w-xl flex-col items-center justify-center px-5 text-center">
          <h1 className="font-heading text-6xl uppercase leading-none">Event not found</h1>
          <Link to="/events" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/16 px-5 font-body text-xs font-semibold uppercase text-foreground/70">
            <ArrowLeft className="h-4 w-4" /> Back to events
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const blocks = blocksOf(event);
  const photos = uploadedPhotos(event);
  const tiers = event.tiers || [];
  const tier = tiers.find((t) => t.id === tierId) || tiers[0];
  const applicationOnly = Boolean(tier?.applicationGated);
  const closed = event.status === 'closed' || event.status === 'ended';
  const ctaLabel = closed
    ? 'See upcoming events'
    : applicationOnly
      ? 'Request to join'
      : tier?.priceCents > 0
        ? `Reserve — ${formatPriceCents(tier.priceCents)}`
        : 'Reserve';
  const ctaTarget = closed ? '/events' : `/presale/${event.slug}`;

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header><Navbar /></header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-[5.75rem] md:px-8 md:pt-[6.5rem]">
        <div className="grid gap-8 md:grid-cols-[340px_1fr] md:gap-10">
          {/* Left rail: poster, hosted-by, about (Luma) */}
          <aside className="md:sticky md:top-24 md:self-start">
            {photos.length > 0 ? (
              <div className="relative aspect-square overflow-hidden rounded-[1.35rem] border border-foreground/12">
                <img src={photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-[1.35rem] border border-foreground/12 bg-foreground/[0.035]">
                <AvalonMark className="h-16 w-11 text-foreground/45" />
              </div>
            )}

            <div className="mt-5">
              <p className="font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/40">Hosted by</p>
              <div className="mt-3 flex items-center gap-3 border-t border-foreground/[0.08] pt-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.045]">
                  <AvalonMark className="h-4 w-3 text-foreground" />
                </span>
                <span className="flex flex-col">
                  <span className="font-body text-sm font-bold text-foreground">{event.hostName || 'Avalon Vitality'}</span>
                  <span className="font-body text-[12px] font-semibold text-foreground/45">We deliver care</span>
                </span>
              </div>
            </div>

            {blocks.description ? (
              <div className="mt-6 hidden md:block">
                <p className="font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/40">About</p>
                <p className="mt-2 font-body text-[14px] font-semibold leading-relaxed text-foreground/60">{blocks.description}</p>
              </div>
            ) : null}

            <div className="hidden md:block">
              <QuietList label="What's included" items={blocks.included} />
              <QuietList label="Good to know" items={blocks.goodToKnow} />
            </div>
          </aside>

          {/* Right: title, date/place rows, reserve card (Luma) */}
          <section>
            <h1 className="font-heading text-[3rem] uppercase leading-[0.88] tracking-normal text-foreground md:text-[4.2rem]">
              {event.name}
            </h1>

            <div className="mt-6 flex flex-col gap-4">
              <InfoRow
                chip={<CalendarChip iso={event.startsAt} />}
                title={formatDayLong(event.startsAt)}
                hint={formatEventTime(event.startsAt, event.endsAt)}
              />
              <InfoRow
                chip={(
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-foreground/14 bg-foreground/[0.045]">
                    <MapPin className="h-5 w-5 text-foreground/70" strokeWidth={1.8} />
                  </span>
                )}
                title={event.venue || 'San Francisco'}
                hint="Exact address after you reserve"
              />
            </div>

            <div className="av-treatment-card mt-7 rounded-[1.35rem] border p-4 md:p-5">
              <p className="font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/40">Reserve</p>
              <div className="mt-3 flex flex-col gap-2.5">
                {tiers.map((t) => (
                  <TierRow key={t.id || t.name} tier={t} active={t.id === tier?.id} onClick={() => setTierId(t.id)} />
                ))}
              </div>
              <Link
                to={ctaTarget}
                className="mt-4 flex min-h-[54px] w-full items-center justify-center rounded-full bg-white px-5 font-heading text-lg uppercase leading-none tracking-[0.08em] text-black transition-transform hover:bg-white/95 active:scale-[0.99]"
              >
                {ctaLabel}
              </Link>
              <p className="mt-3 text-center font-body text-[12px] font-semibold leading-relaxed text-foreground/50">
                First time? A 90-second health check from our clinical team clears you before the event.
              </p>
            </div>

            {blocks.description ? (
              <div className="mt-7 md:hidden">
                <p className="font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/40">About</p>
                <p className="mt-2 font-body text-[14px] font-semibold leading-relaxed text-foreground/60">{blocks.description}</p>
              </div>
            ) : null}
            <div className="md:hidden">
              <QuietList label="What's included" items={blocks.included} />
              <QuietList label="Good to know" items={blocks.goodToKnow} />
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
