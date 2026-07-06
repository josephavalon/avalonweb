import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, HeartPulse, MapPin, ShieldCheck, Ticket, Users } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PremiumButton from '@/components/ui/PremiumButton';
import { findEventBySlug } from '@/data/events';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

function Gallery({ event }) {
  const gallery = event.gallery?.length ? event.gallery : [event.cover];
  return (
    <div className="grid gap-2 md:grid-cols-[1.35fr_0.65fr]">
      <div className="relative min-h-[420px] overflow-hidden rounded-[1.5rem] border border-foreground/[0.10] bg-background md:min-h-[620px]">
        <img src={gallery[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/74 via-black/16 to-black/8" />
        <div className="absolute bottom-5 left-5 right-5">
          <p className="font-body text-xs font-semibold uppercase text-white/58">{event.date} / {event.neighborhood}</p>
          <h1 className="mt-3 max-w-4xl font-heading text-[4.8rem] uppercase leading-[0.82] text-white md:text-[8.6rem]">
            {event.title}
          </h1>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        {gallery.slice(1, 3).map((image, index) => (
          <div key={image} className="relative min-h-[180px] overflow-hidden rounded-[1.25rem] border border-foreground/[0.10] bg-background md:min-h-0">
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/18" />
            {index === 1 && (
              <span className="absolute bottom-4 left-4 rounded-full border border-white/14 bg-black/42 px-3 py-2 font-body text-[11px] font-semibold uppercase text-white/76 backdrop-blur-md">
                View gallery
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-foreground/[0.10] bg-foreground/[0.045]">
        <Icon className="h-4 w-4 text-foreground/62" strokeWidth={1.8} />
      </span>
      <span>
        <span className="block font-body text-[11px] font-semibold uppercase text-foreground/42">{label}</span>
        <span className="mt-1 block font-body text-sm font-semibold text-foreground">{value}</span>
      </span>
    </div>
  );
}

function IncludedList({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3 rounded-[1.1rem] border border-foreground/[0.10] bg-foreground/[0.035] p-4">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" strokeWidth={2} />
          <p className="font-body text-sm leading-relaxed text-foreground/68">{item}</p>
        </div>
      ))}
    </div>
  );
}

function ReserveCard({ event }) {
  const firstTier = event.tiers?.[0];
  const cta = event.state === 'application' ? 'Request to join' : event.state === 'closed' ? 'View trip proof' : 'Reserve';
  const ctaTarget = event.state === 'closed' ? '/events' : `/presale/${event.slug}`;

  return (
    <aside className="md:sticky md:top-28">
      <div className="rounded-[1.5rem] border border-foreground/[0.12] bg-background/68 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-[11px] font-semibold uppercase text-foreground/42">Reserve</p>
            <p className="mt-2 font-heading text-5xl uppercase leading-none text-foreground">
              {event.priceFrom ? `$${event.priceFrom}` : 'Apply'}
            </p>
          </div>
          <span className="rounded-full border border-foreground/[0.12] bg-foreground/[0.045] px-3 py-2 font-body text-[11px] font-semibold uppercase text-foreground/62">
            {event.status}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          <DetailRow icon={Calendar} label="When" value={`${event.date} / ${event.time}`} />
          <DetailRow icon={MapPin} label="Where" value={event.venue} />
          <DetailRow icon={Users} label="Capacity" value={event.capacity} />
          <DetailRow icon={ShieldCheck} label="Clinical" value={event.clinicalLead} />
        </div>

        {firstTier && (
          <div className="mt-5 rounded-[1.2rem] border border-foreground/[0.10] bg-foreground/[0.045] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-body text-sm font-semibold text-foreground">{firstTier.name}</p>
              <p className="font-body text-sm font-bold text-foreground">${firstTier.price}</p>
            </div>
            <p className="mt-2 font-body text-xs leading-relaxed text-foreground/56">{firstTier.detail}</p>
          </div>
        )}

        <PremiumButton
          as={Link}
          to={ctaTarget}
          wrapperClassName="mt-5 w-full"
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-xs font-black uppercase text-background transition hover:bg-foreground/90"
        >
          {cta} <Ticket className="h-4 w-4" strokeWidth={2} />
        </PremiumButton>

        <p className="mt-4 text-center font-body text-[11px] leading-relaxed text-foreground/45">
          Local preview only. No payment, health intake, or vendor API calls.
        </p>
      </div>
    </aside>
  );
}

export default function EventPage() {
  const { slug } = useParams();
  const event = findEventBySlug(slug);

  useSeo({
    title: event ? `${event.title} - Avalon Events` : 'Event Not Found - Avalon Vitality',
    description: event?.description || 'Avalon event recovery preview.',
    path: event ? `/events/${event.slug}` : '/events',
  });

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

  return (
    <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={event.cover} alt="" className="h-full w-full object-cover opacity-18" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/86 via-black/72 to-black" />
      </div>
      <Navbar />

      <main className="px-4 pb-20 pt-28 md:px-8 md:pt-36">
        <div className="mx-auto max-w-7xl">
          <Link to="/events" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[11px] font-semibold uppercase text-foreground/58 backdrop-blur-xl hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Events
          </Link>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
            <Gallery event={event} />
          </motion.div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-8">
              <section className="grid gap-4 rounded-[1.5rem] border border-foreground/[0.10] bg-background/58 p-5 backdrop-blur-2xl md:grid-cols-[0.65fr_1.35fr] md:p-6">
                <div>
                  <p className="font-body text-xs font-semibold uppercase text-foreground/42">Hosted by</p>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.05]">
                      <AvalonMark className="h-[18px] w-[12px] text-foreground" />
                    </span>
                    <div>
                      <p className="font-heading text-3xl uppercase leading-none text-foreground">{event.hostName}</p>
                      <p className="mt-1 font-body text-xs font-semibold uppercase text-foreground/48">{event.hostRole}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow icon={HeartPulse} label={event.clinicalRole} value={event.clinicalLead} />
                  <DetailRow icon={MapPin} label="Neighborhood" value={event.location} />
                </div>
              </section>

              <section>
                <p className="font-body text-xs font-semibold uppercase text-foreground/42">The room</p>
                <h2 className="mt-3 max-w-3xl font-heading text-6xl uppercase leading-[0.86] text-foreground md:text-8xl">
                  {event.vibe}
                </h2>
                <p className="mt-5 max-w-3xl font-body text-lg leading-relaxed text-foreground/66">{event.description}</p>
              </section>

              <section className="space-y-4">
                <div>
                  <p className="font-body text-xs font-semibold uppercase text-foreground/42">What's included</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase leading-none text-foreground md:text-6xl">Before, during, after.</h2>
                </div>
                <IncludedList items={event.included} />
              </section>

              <section className="rounded-[1.5rem] border border-foreground/[0.10] bg-foreground/[0.045] p-5 md:p-6">
                <p className="font-body text-xs font-semibold uppercase text-foreground/42">Good to know</p>
                <div className="mt-4 grid gap-3">
                  {event.goodToKnow.map((item) => (
                    <p key={item} className="border-t border-foreground/[0.08] pt-3 font-body text-sm leading-relaxed text-foreground/64 first:border-t-0 first:pt-0">
                      {item}
                    </p>
                  ))}
                </div>
              </section>
            </div>

            <ReserveCard event={event} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
