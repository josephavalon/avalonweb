import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, MapPin, Plus } from 'lucide-react';
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

/* Calendar tile + pin tile — Bebas date, hairline border, matches row-icon DNA. */
function CalendarChip({ iso }) {
  const d = iso ? new Date(iso) : null;
  return (
    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-foreground/12 bg-foreground/[0.04]">
      <span className="font-body text-[9px] uppercase leading-none tracking-[0.18em] text-foreground/55">
        {d ? d.toLocaleDateString('en-US', { month: 'short' }) : 'TBA'}
      </span>
      <span className="mt-0.5 font-heading text-[22px] leading-none tracking-tight text-foreground">
        {d ? d.getDate() : '—'}
      </span>
    </span>
  );
}

function InfoRow({ chip, title, hint }) {
  return (
    <div className="av-treatment-card flex items-center gap-3.5 rounded-[1.05rem] border px-4 py-3">
      {chip}
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-xl uppercase leading-none tracking-normal text-foreground md:text-2xl">
          {title}
        </span>
        {hint ? (
          <span className="mt-1 font-body text-[11px] uppercase leading-relaxed tracking-[0.18em] text-foreground/50">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function TierRow({ tier, active, onClick }) {
  const priceLabel = tier.soldOut
    ? 'Sold out'
    : tier.applicationGated
      ? 'Apply'
      : tier.priceCents > 0
        ? formatPriceCents(tier.priceCents)
        : 'Free';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={tier.soldOut}
      aria-pressed={active}
      className={`av-treatment-card flex w-full items-center justify-between gap-3 rounded-[1.25rem] border px-4 py-3.5 text-left transition-colors ${
        active
          ? 'border-foreground/55 bg-foreground/[0.06]'
          : tier.soldOut
            ? 'cursor-not-allowed opacity-45'
            : 'hover:border-foreground/30'
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-xl uppercase leading-none tracking-normal text-foreground md:text-2xl">
          {tier.name}
        </span>
        {tier.description ? (
          <span className="mt-1.5 font-body text-[11px] uppercase leading-relaxed tracking-[0.16em] text-foreground/50">
            {tier.description}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-right font-heading text-2xl leading-none tabular-nums text-foreground/82">
        {priceLabel}
      </span>
    </button>
  );
}

function QuietList({ kicker, title, items }) {
  if (!items.length) return null;
  return (
    <div className="mt-8">
      <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/42">{kicker}</p>
      <h3 className="mt-1.5 font-heading text-3xl uppercase leading-none tracking-tight text-foreground md:text-4xl">
        {title}
      </h3>
      <div className="mt-3">
        {items.map((item) => (
          <p key={item} className="border-t border-foreground/[0.08] py-2.5 font-body text-[13px] leading-relaxed text-foreground/60 first:border-t-0">
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
  const [selectedAddOns, setSelectedAddOns] = useState([]);

  const toggleAddOn = (id) =>
    setSelectedAddOns((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEvent(slug)
      .then((data) => {
        if (!alive) return;
        setEvent(data);
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
          <div className="aspect-square animate-pulse rounded-[1.55rem] border border-foreground/10 bg-foreground/[0.04]" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-[1.25rem] border border-foreground/10 bg-foreground/[0.04]" />
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
          <h1 className="font-heading text-6xl uppercase leading-none tracking-tight md:text-7xl">Event not found</h1>
          <Link
            to="/events"
            className="group mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/40 px-6 font-body text-[11px] uppercase tracking-[0.22em] text-foreground transition-colors hover:border-foreground/80 hover:bg-foreground/[0.04]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Back to events
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const blocks = blocksOf(event);
  const photos = uploadedPhotos(event);
  const tiers = event.tiers || [];
  const addOns = event.addOns || [];
  const tier = tiers.find((t) => t.id === tierId) || tiers[0];
  const addOnTotalCents = addOns
    .filter((ao) => selectedAddOns.includes(ao.id))
    .reduce((sum, ao) => sum + (ao.priceCents || 0), 0);
  const reserveTotalCents = (tier?.priceCents || 0) + addOnTotalCents;
  const applicationOnly = Boolean(tier?.applicationGated);
  const closed = event.status === 'closed' || event.status === 'ended';
  const ctaLabel = closed
    ? 'See upcoming events'
    : applicationOnly
      ? 'Request to join'
      : reserveTotalCents > 0
        ? `Reserve — ${formatPriceCents(reserveTotalCents)}`
        : 'Reserve';
  const ctaTarget = closed ? '/events' : `/presale/${event.slug}`;

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header><Navbar /></header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-[5.75rem] md:px-8 md:pt-[6.5rem]">
        <Link
          to="/events"
          className="group inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.24em] text-foreground/55 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" strokeWidth={2} />
          All events
        </Link>

        {/* Poster title — matches PLANS / IV THERAPY / EVENTS scale */}
        <h1 className="mt-6 font-heading text-[13vw] uppercase leading-[0.9] tracking-tight text-foreground md:text-7xl lg:text-8xl">
          {event.name}
        </h1>

        <div className="mt-10 grid gap-8 md:grid-cols-[360px_1fr] md:gap-12">
          {/* Left rail: poster, hosted-by, about */}
          <aside className="md:sticky md:top-24 md:self-start">
            {photos.length > 0 ? (
              <div className="relative aspect-square overflow-hidden rounded-[1.55rem] border border-foreground/12">
                <img src={photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-[1.55rem] border border-foreground/12 bg-foreground/[0.035]">
                <AvalonMark className="h-16 w-11 text-foreground/45" />
              </div>
            )}

            <div className="mt-8">
              <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/42">Hosted by</p>
              <h3 className="mt-1.5 font-heading text-3xl uppercase leading-none tracking-tight text-foreground md:text-4xl">
                The host
              </h3>
              <div className="mt-3 flex items-center gap-3 border-t border-foreground/[0.08] pt-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.045]">
                  <AvalonMark className="h-4 w-3 text-foreground" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-heading text-xl uppercase leading-none tracking-normal text-foreground md:text-2xl">
                    {event.hostName || 'Avalon Vitality'}
                  </span>
                  <span className="mt-1 font-body text-[11px] uppercase tracking-[0.18em] text-foreground/45">
                    We deliver care
                  </span>
                </span>
              </div>
            </div>

            {blocks.description ? (
              <div className="mt-8 hidden md:block">
                <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/42">About</p>
                <h3 className="mt-1.5 font-heading text-3xl uppercase leading-none tracking-tight text-foreground md:text-4xl">
                  The event
                </h3>
                <p className="mt-3 font-body text-[14px] leading-relaxed text-foreground/62">{blocks.description}</p>
              </div>
            ) : null}

            <div className="hidden md:block">
              <QuietList kicker="What's included" title="Included" items={blocks.included} />
              <QuietList kicker="Good to know" title="The fine print" items={blocks.goodToKnow} />
            </div>
          </aside>

          {/* Right: date/place rows + reserve card */}
          <section>
            <div className="flex flex-col gap-2.5">
              <InfoRow
                chip={<CalendarChip iso={event.startsAt} />}
                title={formatDayLong(event.startsAt)}
                hint={formatEventTime(event.startsAt, event.endsAt)}
              />
              <InfoRow
                chip={(
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-foreground/[0.04]">
                    <MapPin className="h-5 w-5 text-foreground/70" strokeWidth={1.8} />
                  </span>
                )}
                title={event.venue || 'San Francisco'}
                hint="Exact address after you reserve"
              />
            </div>

            <div className="av-treatment-card mt-6 rounded-[1.55rem] border p-5 md:p-6">
              <p className="font-body text-[11px] uppercase tracking-[0.22em] text-foreground/45">Reserve</p>
              <div className="mt-4 flex flex-col gap-2.5">
                {tiers.map((t) => (
                  <TierRow key={t.id || t.name} tier={t} active={t.id === tier?.id} onClick={() => setTierId(t.id)} />
                ))}
              </div>

              {addOns.length > 0 ? (
                <div className="mt-6 border-t border-foreground/[0.08] pt-5">
                  <p className="font-body text-[11px] uppercase tracking-[0.22em] text-foreground/45">Add-ons</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {addOns.map((ao) => {
                      const on = selectedAddOns.includes(ao.id);
                      return (
                        <button
                          key={ao.id}
                          type="button"
                          onClick={() => toggleAddOn(ao.id)}
                          aria-pressed={on}
                          className={`av-treatment-card flex w-full items-center justify-between gap-3 rounded-[1.05rem] border px-4 py-3 text-left transition-colors ${
                            on ? 'border-foreground/55 bg-foreground/[0.06]' : 'hover:border-foreground/30'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                              on ? 'border-foreground bg-foreground text-background' : 'border-foreground/25 text-foreground/40'
                            }`}>
                              {on ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />}
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <span className="font-heading text-lg uppercase leading-none tracking-normal text-foreground">
                                {ao.name}
                              </span>
                              {ao.description ? (
                                <span className="mt-1 font-body text-[11px] uppercase leading-relaxed tracking-[0.16em] text-foreground/50">
                                  {ao.description}
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="shrink-0 font-heading text-lg leading-none tabular-nums text-foreground/82">
                            {formatPriceCents(ao.priceCents)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <Link
                to={ctaTarget}
                className="group mt-5 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 font-body text-sm uppercase tracking-[0.22em] text-background transition-colors hover:bg-foreground/90"
              >
                {ctaLabel}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" strokeWidth={2} />
              </Link>
              <p className="mt-4 text-center font-body text-[11px] uppercase leading-relaxed tracking-[0.18em] text-foreground/45">
                90-second health check clears you before the event
              </p>
            </div>

            {blocks.description ? (
              <div className="mt-8 md:hidden">
                <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/42">About</p>
                <h3 className="mt-1.5 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
                  The event
                </h3>
                <p className="mt-3 font-body text-[14px] leading-relaxed text-foreground/62">{blocks.description}</p>
              </div>
            ) : null}
            <div className="md:hidden">
              <QuietList kicker="What's included" title="Included" items={blocks.included} />
              <QuietList kicker="Good to know" title="The fine print" items={blocks.goodToKnow} />
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
