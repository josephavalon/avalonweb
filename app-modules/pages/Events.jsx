import { Link } from 'react-router-dom';
import { Calendar, LockKeyhole, MapPin, Sparkles, Users } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE } from '@/lib/motion';
import { getActiveEvents, getPreviousEvents } from '@/data/events';

const stateStyles = {
  member_first: 'border-white/20 bg-white/10 text-white',
  open: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
  application: 'border-amber-200/25 bg-amber-200/10 text-amber-100',
  closed: 'border-white/12 bg-white/5 text-white/58',
};

function StateChip({ event }) {
  return (
    <span className={`inline-flex min-h-8 items-center rounded-full border px-3 font-body text-[11px] font-semibold uppercase ${stateStyles[event.state] || stateStyles.open}`}>
      {event.status}
    </span>
  );
}

function AvatarStack({ names }) {
  return (
    <div className="flex -space-x-2">
      {names.slice(0, 4).map((name) => (
        <span
          key={name}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-background bg-foreground text-background font-body text-[11px] font-bold"
          title={name}
        >
          {name.slice(0, 1)}
        </span>
      ))}
    </div>
  );
}

function EventCard({ event, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: EASE }}
      className="group relative min-h-[420px] overflow-hidden rounded-[1.5rem] border border-foreground/[0.10] bg-background shadow-[0_24px_90px_hsl(var(--foreground)/0.10)] md:min-h-[520px]"
    >
      <Link to={`/events/${event.slug}`} className="absolute inset-0 z-10" aria-label={`View ${event.title}`} />
      <img
        src={event.cover}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/48 to-black/12" />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <StateChip event={event} />
        <span className="rounded-full border border-white/14 bg-black/34 px-3 py-2 font-body text-[11px] font-semibold text-white/78 backdrop-blur-md">
          From {event.priceFrom ? `$${event.priceFrom}` : 'request'}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
        <p className="font-body text-xs font-semibold uppercase text-white/58">{event.date} / {event.neighborhood}</p>
        <h2 className="mt-3 max-w-xl font-heading text-[4.25rem] uppercase leading-[0.82] text-white md:text-[5.75rem]">
          {event.title}
        </h2>
        <p className="mt-4 max-w-lg font-body text-sm leading-relaxed text-white/68 md:text-base">{event.description}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AvatarStack names={event.attendees} />
            <span className="font-body text-xs font-semibold text-white/64">{event.attendeeCount || 'Private'} going</span>
          </div>
          <span className="relative z-20 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 font-body text-xs font-black uppercase text-black transition group-hover:bg-white/88">
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
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="font-body text-xs font-semibold uppercase text-foreground/42">Previously</p>
          <h2 className="mt-2 font-heading text-5xl uppercase leading-none text-foreground md:text-6xl">Past rooms</h2>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Link
            key={event.slug}
            to={`/events/${event.slug}`}
            className="group relative min-h-[240px] overflow-hidden rounded-[1.25rem] border border-foreground/[0.10] bg-background"
          >
            <img src={event.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-72 transition group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/28 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="font-body text-xs text-white/54">{event.date} / {event.neighborhood}</p>
              <h3 className="mt-2 font-heading text-4xl uppercase leading-none text-white">{event.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Events() {
  const activeEvents = getActiveEvents();
  const previousEvents = getPreviousEvents();

  useSeo({
    title: 'Avalon Events - Avalon Vitality',
    description: 'Reserve Avalon event recovery experiences with health-check status, wallet passes, and photo-led event pages.',
    path: '/events',
  });

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src="/beta-preview/hero-bg.jpg" alt="" className="h-full w-full object-cover opacity-48" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/82 via-black/70 to-black" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/52 to-transparent" />
      </div>
      <Navbar />

      <main>
        <section className="mx-auto grid min-h-[76svh] max-w-7xl items-end gap-10 px-4 pb-10 pt-32 md:grid-cols-[1.08fr_0.92fr] md:px-8 md:pb-14 md:pt-40">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <p className="font-body text-xs font-semibold uppercase text-foreground/54">Avalon events</p>
            <h1 className="mt-4 max-w-4xl font-heading text-[5.4rem] uppercase leading-[0.82] text-foreground md:text-[9.25rem]">
              Reserve the recovery room.
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
            className="rounded-[1.35rem] border border-foreground/[0.10] bg-background/46 p-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_24px_90px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl"
          >
            <p className="font-body text-base leading-relaxed text-foreground/68">
              Photo-led event pages, three-tap reserve, health-check status, wallet QR, and a day-of trip page. Built as a local preview with no live PHI, Stripe, Supabase, or Acuity calls.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                [Calendar, 'Presale'],
                [LockKeyhole, 'GFE status'],
                [Users, 'Door ready'],
              ].map(([Icon, label]) => (
                <span key={label} className="rounded-2xl border border-foreground/[0.10] bg-foreground/[0.045] p-3">
                  <Icon className="h-4 w-4 text-foreground/58" strokeWidth={1.7} />
                  <span className="mt-3 block font-body text-[11px] font-semibold uppercase text-foreground/58">{label}</span>
                </span>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 md:grid-cols-2 md:px-8">
          {activeEvents.map((event, index) => (
            <EventCard key={event.slug} event={event} index={index} />
          ))}
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
          <div className="grid gap-4 rounded-[1.5rem] border border-foreground/[0.10] bg-foreground/[0.045] p-5 backdrop-blur-2xl md:grid-cols-[0.8fr_1.2fr] md:p-7">
            <div>
              <p className="font-body text-xs font-semibold uppercase text-foreground/42">Why it matches beta</p>
              <h2 className="mt-2 font-heading text-5xl uppercase leading-none md:text-7xl">No red banners.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Photo first', 'Every event starts with place and atmosphere.'],
                ['Quiet scarcity', 'State chips do the work without pressure.'],
                ['Clinical trust', 'The health check is a concierge step, not a form wall.'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-[1.1rem] border border-foreground/[0.10] bg-background/46 p-4">
                  <p className="font-body text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-2 font-body text-xs leading-relaxed text-foreground/56">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PreviouslyStrip events={previousEvents} />
      </main>

      <Footer />
    </div>
  );
}
