import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import { fetchEvent } from '@/lib/eventsApi';
import { formatPriceCents } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

/* Organizer photos only — no stock fallback. An empty gallery renders nothing. */
function uploadedPhotos(event) {
  return (event.assets || [])
    .map((a) => a.renditions?.hero_1920 || a.renditions?.card_640 || a.storage_path)
    .filter(Boolean);
}

/* Quiet fact row, BuilderRow closed-state style: title left, value right. */
function InfoRow({ title, hint, value }) {
  return (
    <div className="av-treatment-card flex items-center justify-between gap-3 overflow-hidden rounded-[1.05rem] border px-4 py-4 md:px-5">
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-lg uppercase leading-none tracking-normal text-foreground md:text-xl">{title}</span>
        {hint ? (
          <span className="mt-1 font-body text-[12px] font-semibold text-foreground/45 md:text-[13px]">{hint}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-right font-body text-[13px] font-semibold text-foreground/64 md:text-sm">{value}</span>
    </div>
  );
}

/* Expandable row, BuilderRow style: chevron, SmoothDisclosure body. */
function DisclosureRow({ title, items }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className={`av-treatment-card relative overflow-hidden rounded-[1.05rem] border transition-colors duration-base ease-editorial ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left md:px-5"
      >
        <span className="font-heading text-lg uppercase leading-none tracking-normal text-foreground md:text-xl">{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-foreground/70 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      <SmoothDisclosure open={open}>
        <div className="border-t border-foreground/[0.08] px-4 pb-4 pt-3.5 md:px-5">
          {items.map((item) => (
            <p key={item} className="border-t border-foreground/[0.08] py-2.5 font-body text-[13px] font-semibold leading-relaxed text-foreground/60 first:border-t-0 first:pt-0 last:pb-0">
              {item}
            </p>
          ))}
        </div>
      </SmoothDisclosure>
    </div>
  );
}

export default function EventPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEvent(slug)
      .then((data) => { if (alive) setEvent(data); })
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
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-24 pt-[9rem]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-[1.05rem] border border-foreground/10 bg-foreground/[0.04]" />
          ))}
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
  const openTier = tiers.find((t) => !t.soldOut && !t.applicationGated) || tiers[0];
  const applicationOnly = Boolean(openTier?.applicationGated);
  const closed = event.status === 'closed' || event.status === 'ended';
  const priceFrom = tiers.reduce(
    (min, t) => (t.priceCents > 0 && (min == null || t.priceCents < min) ? t.priceCents : min),
    null,
  );
  const ctaLabel = closed
    ? 'See upcoming events'
    : applicationOnly
      ? 'Request to join'
      : priceFrom != null
        ? `Reserve — from ${formatPriceCents(priceFrom)}`
        : 'Reserve';
  const ctaTarget = closed ? '/events' : `/presale/${event.slug}`;

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header><Navbar /></header>

      <main className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-24 pt-[5.25rem] md:pt-[5.75rem]">
        <div className="mb-8 pt-8 text-center md:mb-10 md:pt-12">
          <p className="font-body text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground/45">
            {formatEventDate(event.startsAt)} · {event.venue || 'San Francisco'}
          </p>
          <h1 className="mt-3 font-heading text-[3rem] uppercase leading-[0.86] tracking-normal text-foreground md:text-[4.4rem]">
            {event.name}
          </h1>
          {blocks.description ? (
            <p className="mx-auto mt-4 max-w-xl font-body text-[15px] font-semibold leading-relaxed text-foreground/60">
              {blocks.description}
            </p>
          ) : null}
        </div>

        {photos.length > 0 ? (
          <div className="relative mb-3 h-[240px] overflow-hidden rounded-[1.05rem] border border-foreground/10 md:h-[320px]">
            <img src={photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <InfoRow
            title="When"
            value={`${formatEventDate(event.startsAt)} · ${formatEventTime(event.startsAt, event.endsAt)}`}
          />
          <InfoRow
            title="Where"
            hint="Exact address after you reserve"
            value={event.venue || 'San Francisco'}
          />
          {tiers.map((tier) => (
            <InfoRow
              key={tier.id || tier.name}
              title={tier.name}
              hint={tier.description}
              value={tier.soldOut ? 'Sold out' : tier.applicationGated ? 'By application' : tier.priceCents > 0 ? formatPriceCents(tier.priceCents) : 'Free'}
            />
          ))}
          <DisclosureRow title="What's included" items={blocks.included} />
          <DisclosureRow title="Good to know" items={blocks.goodToKnow} />
        </div>

        <Link
          to={ctaTarget}
          className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-full bg-white px-5 font-heading text-lg uppercase leading-none tracking-[0.08em] text-black transition-transform hover:bg-white/95 active:scale-[0.99]"
        >
          {ctaLabel}
        </Link>
        <p className="mt-2 text-center font-body text-[12px] font-semibold text-foreground/50">
          First time? A 90-second health check from our clinical team clears you before the event.
        </p>
      </main>

      <Footer />
    </div>
  );
}
