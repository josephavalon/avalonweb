import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, MapPin, Ticket, Users } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PremiumButton from '@/components/ui/PremiumButton';
import { fetchEvent } from '@/lib/eventsApi';
import { eventStateChip, backOnFloorBadge, formatPriceCents, MONO_STACK } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];
const FALLBACK_COVER = '/recovery-lounge-hero.jpg';

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

function formatEventTime(startIso, endIso) {
  if (!startIso) return '';
  const opts = { hour: 'numeric', minute: '2-digit' };
  const start = new Date(startIso).toLocaleTimeString('en-US', opts);
  const end = endIso ? ` – ${new Date(endIso).toLocaleTimeString('en-US', opts)}` : '';
  return `${start}${end}`;
}

function heroImages(event) {
  const gallery = (event.assets || [])
    .map((a) => a.renditions?.hero_1920 || a.renditions?.card_640 || a.storage_path)
    .filter(Boolean);
  return gallery.length ? gallery : [FALLBACK_COVER];
}

function Gallery({ event }) {
  const gallery = heroImages(event);
  return (
    <div className="grid gap-2 md:grid-cols-[1.35fr_0.65fr]">
      <div className="relative min-h-[420px] overflow-hidden rounded-[1.35rem] border border-white/12 bg-background md:min-h-[620px]">
        <img src={gallery[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {/* The scrim makes any organizer photo on-brand (DESIGN.md). */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/74 via-black/16 to-black/8" />
        <div className="absolute bottom-5 left-5 right-5">
          <p className="text-xs text-white/60" style={{ fontFamily: MONO_STACK, letterSpacing: '0.1em' }}>
            {formatEventDate(event.startsAt)} · {(event.venue || '').toUpperCase()}
          </p>
          <h1 className="mt-3 max-w-4xl font-heading text-[4.8rem] uppercase leading-[0.82] text-white md:text-[8.6rem]">
            {event.name}
          </h1>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        {gallery.slice(1, 3).map((image) => (
          <div key={image} className="relative min-h-[180px] overflow-hidden rounded-[1.25rem] border border-white/12 bg-background md:min-h-0">
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/18" />
          </div>
        ))}
        {gallery.length === 1 ? (
          <div className="relative hidden min-h-[180px] overflow-hidden rounded-[1.25rem] border border-white/12 md:block" style={{ background: 'rgba(13,13,13,0.94)' }} />
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-foreground/[0.045]">
        <Icon className="h-4 w-4 text-foreground/62" strokeWidth={1.8} />
      </span>
      <span>
        <span className="block font-body text-[11px] font-semibold uppercase text-foreground/42">{label}</span>
        <span className="mt-1 block font-body text-sm font-semibold text-foreground">{value}</span>
      </span>
    </div>
  );
}

/* Clinicians as headliners (DESIGN.md signature move #3): names LOUD, the
   credential in mono like a catalog number. Rendered only with real data —
   a stock version of this module is worse than nothing. */
function Headliners({ clinicalLead, services }) {
  if (!clinicalLead?.name) return null;
  return (
    <section className="rounded-[1.35rem] border border-white/12 p-5 md:p-6" style={{ background: 'rgba(13,13,13,0.94)' }}>
      <p className="text-[10px] uppercase text-foreground/45" style={{ fontFamily: MONO_STACK, letterSpacing: '0.16em' }}>
        Your clinical team — the headliners
      </p>
      <h2 className="mt-3 font-heading text-4xl uppercase leading-none text-foreground md:text-5xl">
        {clinicalLead.name}{clinicalLead.role ? `, ${clinicalLead.role}` : ''}
      </h2>
      <p className="mt-3 text-[11px] text-foreground/55" style={{ fontFamily: MONO_STACK, letterSpacing: '0.08em' }}>
        {[clinicalLead.role && `${clinicalLead.role} · SUPERVISING`, ...(services || []).map((s) => `${s.name.toUpperCase()}${s.backOnFloorMinutes || s.back_on_floor_minutes ? ` · ${backOnFloorBadge(s.backOnFloorMinutes ?? s.back_on_floor_minutes)}` : ''}`)]
          .filter(Boolean)
          .join('   ·   ')}
      </p>
    </section>
  );
}

function DurationPills({ services }) {
  const pills = (services || [])
    .map((s) => {
      const badge = backOnFloorBadge(s.backOnFloorMinutes ?? s.back_on_floor_minutes);
      return badge ? `${s.name.toUpperCase()} · ${badge}` : null;
    })
    .filter(Boolean);
  if (!pills.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((label) => (
        <span
          key={label}
          className="inline-flex min-h-8 items-center rounded-full border border-white/14 px-3 text-[11px] text-foreground/70"
          style={{ fontFamily: MONO_STACK, letterSpacing: '0.06em' }}
        >
          {label}
        </span>
      ))}
    </div>
  );
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

function ReserveCard({ event }) {
  const openTier = (event.tiers || []).find((t) => !t.soldOut && !t.applicationGated) || event.tiers?.[0];
  const applicationOnly = Boolean(openTier?.applicationGated);
  const closed = event.status === 'closed';
  const priceFrom = (event.tiers || []).reduce(
    (min, t) => (t.priceCents > 0 && (min == null || t.priceCents < min) ? t.priceCents : min),
    null,
  );
  const chip = eventStateChip(event.status);
  const cta = closed ? 'See upcoming events' : applicationOnly ? 'Request to join' : 'Reserve';
  const ctaTarget = closed ? '/events' : `/presale/${event.slug}`;

  return (
    <aside className="md:sticky md:top-28">
      <div className="rounded-[1.35rem] border border-white/12 p-4 md:p-5" style={{ background: 'rgba(13,13,13,0.94)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-[11px] font-semibold uppercase text-foreground/42">Reserve</p>
            {/* Price is a number, never a table (DESIGN.md signature move #4). */}
            <p className="mt-2 font-heading text-5xl uppercase leading-none text-foreground">
              {priceFrom != null ? formatPriceCents(priceFrom) : applicationOnly ? 'Apply' : 'Free'}
            </p>
          </div>
          <span
            className="rounded-full border border-white/14 px-3 py-2 text-[11px]"
            style={{ fontFamily: MONO_STACK, color: chip.color, letterSpacing: '0.06em' }}
          >
            {chip.label}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          <DetailRow icon={Calendar} label="When" value={`${formatEventDate(event.startsAt)} · ${formatEventTime(event.startsAt, event.endsAt)}`} />
          <DetailRow icon={MapPin} label="Where" value={`${event.venue || 'San Francisco'} — exact address after you reserve`} />
          <DetailRow icon={Users} label="Going" value={event.attendeeCount ? `${event.attendeeCount} confirmed` : 'Be the first'} />
        </div>

        {openTier ? (
          <div className="mt-5 rounded-[1.2rem] border border-white/12 bg-foreground/[0.045] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-body text-sm font-semibold text-foreground">{openTier.name}</p>
              <p className="text-sm text-foreground" style={{ fontFamily: MONO_STACK }}>
                {openTier.priceCents > 0 ? formatPriceCents(openTier.priceCents) : 'FREE'}
              </p>
            </div>
            {openTier.description ? (
              <p className="mt-2 font-body text-xs leading-relaxed text-foreground/56">{openTier.description}</p>
            ) : null}
          </div>
        ) : null}

        <PremiumButton
          as={Link}
          to={ctaTarget}
          wrapperClassName="mt-5 w-full"
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-xs font-bold uppercase text-background transition hover:bg-foreground/90"
        >
          {cta} <Ticket className="h-4 w-4" strokeWidth={2} />
        </PremiumButton>

        <p className="mt-4 text-center font-body text-[11px] leading-relaxed text-foreground/50">
          First time? A 90-second health check from our clinical team clears you before the event.
        </p>
      </div>
    </aside>
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
      <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 pb-20 pt-32 md:px-8">
          <div className="min-h-[420px] animate-pulse rounded-[1.35rem] border border-white/12 bg-white/[0.04] md:min-h-[620px]" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="av-page-surface min-h-screen text-foreground">
        <Navbar />
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
  const cover = heroImages(event)[0];

  return (
    <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={cover} alt="" className="h-full w-full object-cover opacity-18" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/86 via-black/72 to-black" />
      </div>
      <Navbar />

      <main className="px-4 pb-20 pt-28 md:px-8 md:pt-36">
        <div className="mx-auto max-w-7xl">
          <Link to="/events" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 font-body text-[11px] font-semibold uppercase text-foreground/58 hover:text-foreground" style={{ background: 'rgba(13,13,13,0.7)' }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Events
          </Link>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
            <Gallery event={event} />
          </motion.div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-8">
              <section className="grid gap-4 rounded-[1.35rem] border border-white/12 p-5 md:grid-cols-[0.65fr_1.35fr] md:p-6" style={{ background: 'rgba(13,13,13,0.94)' }}>
                <div>
                  <p className="font-body text-xs font-semibold uppercase text-foreground/42">Hosted by</p>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-foreground/[0.05]">
                      <AvalonMark className="h-[18px] w-[12px] text-foreground" />
                    </span>
                    <div>
                      <p className="font-heading text-3xl uppercase leading-none text-foreground">{event.hostName || 'Avalon Vitality'}</p>
                      <p className="mt-1 text-[10px] uppercase text-foreground/48" style={{ fontFamily: MONO_STACK, letterSpacing: '0.14em' }}>We deliver care</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <DurationPills services={event.services} />
                  <DetailRow icon={MapPin} label="Neighborhood" value={event.venue} />
                </div>
              </section>

              <Headliners clinicalLead={event.clinicalLead} services={event.services} />

              {blocks.vibe || blocks.description ? (
                <section>
                  <p className="font-body text-xs font-semibold uppercase text-foreground/42">The room</p>
                  {blocks.vibe ? (
                    <h2 className="mt-3 max-w-3xl font-heading text-6xl uppercase leading-[0.86] text-foreground md:text-8xl">{blocks.vibe}</h2>
                  ) : null}
                  {blocks.description ? (
                    <p className="mt-5 max-w-3xl font-body text-lg leading-relaxed text-foreground/66">{blocks.description}</p>
                  ) : null}
                </section>
              ) : null}

              {blocks.included.length ? (
                <section className="space-y-4">
                  <div>
                    <p className="font-body text-xs font-semibold uppercase text-foreground/42">What's included</p>
                    <h2 className="mt-2 font-heading text-5xl uppercase leading-none text-foreground md:text-6xl">Before, during, after.</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {blocks.included.map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-[1.1rem] border border-white/12 bg-foreground/[0.035] p-4">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" strokeWidth={2} />
                        <p className="font-body text-sm leading-relaxed text-foreground/68">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {blocks.goodToKnow.length ? (
                <section className="rounded-[1.35rem] border border-white/12 bg-foreground/[0.045] p-5 md:p-6">
                  <p className="font-body text-xs font-semibold uppercase text-foreground/42">Good to know</p>
                  <div className="mt-4 grid gap-3">
                    {blocks.goodToKnow.map((item) => (
                      <p key={item} className="border-t border-foreground/[0.08] pt-3 font-body text-sm leading-relaxed text-foreground/64 first:border-t-0 first:pt-0">
                        {item}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <ReserveCard event={event} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
