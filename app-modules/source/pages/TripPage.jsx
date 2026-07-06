import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Check, Clock, MapPin, MessageCircle, QrCode, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PremiumButton from '@/components/ui/PremiumButton';
import { findEventBySlug, readMockVisit } from '@/data/events';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

function MiniQr({ value }) {
  const blocks = Array.from({ length: 81 }, (_, index) => {
    const char = value.charCodeAt(index % Math.max(1, value.length)) || index;
    return (char + index * 7) % 4 !== 0;
  });
  return (
    <div className="grid h-44 w-44 grid-cols-9 gap-1 rounded-[1.35rem] border border-foreground/[0.12] bg-foreground p-4 shadow-[0_20px_80px_hsl(var(--foreground)/0.14)]">
      {blocks.map((on, index) => (
        <span key={index} className={`rounded-[3px] ${on ? 'bg-background' : 'bg-transparent'}`} />
      ))}
    </div>
  );
}

function StatusPill({ status }) {
  const copy = {
    cleared: 'Cleared',
    invited: 'Health check sent',
    scheduled: 'Scheduled',
    not_required: 'No IV',
  }[status] || status;
  const tone = status === 'cleared' || status === 'not_required'
    ? 'border-emerald-200/22 bg-emerald-200/10 text-emerald-100'
    : 'border-amber-200/22 bg-amber-200/10 text-amber-100';
  return <span className={`rounded-full border px-3 py-1.5 font-body text-[11px] font-semibold uppercase ${tone}`}>{copy}</span>;
}

function Checklist({ event, visit }) {
  const items = [
    ['Health check', visit.gfeStatus === 'not_required' ? 'Not required' : visit.gfeStatus === 'scheduled' ? 'Scheduled' : 'Sent'],
    ['Add to wallet', visit.walletStatus === 'ready' ? 'Ready' : 'Pending'],
    ['Arrival window', visit.arrivalWindow],
    ['Hydration tips', 'Read before arrival'],
  ];
  return (
    <div className="rounded-[1.5rem] border border-foreground/[0.10] bg-foreground/[0.045] p-5">
      <p className="font-body text-xs font-semibold uppercase text-foreground/42">Before you go</p>
      <div className="mt-4 grid gap-3">
        {items.map(([label, value], index) => (
          <div key={label} className="flex items-center gap-3 rounded-[1.1rem] border border-foreground/[0.10] bg-background/48 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-body text-xs font-bold">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-body text-sm font-semibold text-foreground">{label}</span>
              <span className="mt-0.5 block truncate font-body text-xs text-foreground/48">{value}</span>
            </span>
            <Check className="h-4 w-4 text-emerald-200" strokeWidth={2} />
          </div>
        ))}
      </div>
      <p className="mt-4 font-body text-xs leading-relaxed text-foreground/45">
        {event.goodToKnow?.[0] || 'Your trip page keeps the event essentials in one place.'}
      </p>
    </div>
  );
}

export default function TripPage() {
  const { visitId = 'local-preview' } = useParams();
  const visit = readMockVisit(visitId) || readMockVisit('local-preview');
  const event = findEventBySlug(visit.eventSlug);

  useSeo({
    title: `${event?.title || 'Avalon Event'} Trip - Avalon Vitality`,
    description: 'Mocked Avalon trip page with QR, health-check status, wallet card, and day-of essentials.',
    path: `/trips/${visitId}`,
    robots: 'noindex,nofollow',
  });

  return (
    <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={event?.cover || '/recovery-lounge-hero.jpg'} alt="" className="h-full w-full object-cover opacity-22" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/82 via-black/72 to-black" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/36 to-transparent" />
      </div>
      <Navbar />

      <main className="px-4 pb-20 pt-28 md:px-8 md:pt-36">
        <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="rounded-[1.75rem] border border-foreground/[0.10] bg-background/64 p-5 shadow-[0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-6"
          >
            <Link to={`/events/${event?.slug || 'festival-recovery-presale'}`} className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/[0.12] px-4 font-body text-[11px] font-semibold uppercase text-foreground/58">
              <ArrowLeft className="h-3.5 w-3.5" /> Event
            </Link>
            <p className="font-body text-xs font-semibold uppercase text-foreground/42">Your trip</p>
            <h1 className="mt-3 font-heading text-[5.4rem] uppercase leading-[0.82] md:text-[8rem]">
              {event?.title || 'Avalon event'}
            </h1>
            <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-foreground/64">
              Countdown, QR, venue, health-check status, and your party live here. Day-of, this page collapses to the essentials.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                [Clock, 'Arrival', visit.arrivalWindow],
                [MapPin, 'Venue', event?.exactAddress || event?.venue],
                [ShieldCheck, 'Health check', visit.gfeStatus],
                [QrCode, 'Credential', visit.qrToken],
              ].map(([Icon, label, value]) => (
                <div key={label} className="rounded-[1.15rem] border border-foreground/[0.10] bg-foreground/[0.04] p-4">
                  <Icon className="h-4 w-4 text-foreground/48" strokeWidth={1.8} />
                  <p className="mt-3 font-body text-[11px] font-semibold uppercase text-foreground/42">{label}</p>
                  <p className="mt-1 truncate font-body text-sm font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <PremiumButton
                as="button"
                wrapperClassName="sm:col-span-2"
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-xs font-black uppercase text-background"
              >
                <Smartphone className="h-4 w-4" /> Add to wallet
              </PremiumButton>
              <PremiumButton
                as="button"
                wrapperClassName="w-full"
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full border border-foreground/[0.16] px-5 font-body text-xs font-bold uppercase text-foreground/72"
              >
                <CalendarPlus className="h-4 w-4" /> Calendar
              </PremiumButton>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: EASE }}
            className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"
          >
            <div className="rounded-[1.75rem] border border-foreground/[0.10] bg-background/64 p-5 backdrop-blur-2xl md:p-6">
              <div className="flex flex-col items-center text-center">
                <MiniQr value={visit.qrToken} />
                <p className="mt-5 font-body text-xs font-semibold uppercase text-foreground/42">Wallet pass</p>
                <h2 className="mt-2 font-heading text-5xl uppercase leading-none">{visit.qrToken}</h2>
                <p className="mt-3 max-w-xs font-body text-sm leading-relaxed text-foreground/56">
                  Show this at the door. The mocked manifest reads status only.
                </p>
              </div>
              <div className="mt-6 rounded-[1.15rem] border border-emerald-200/18 bg-emerald-200/10 p-4 text-emerald-100">
                <p className="font-body text-xs font-bold uppercase">Cleared on pass means nothing to think about at the door.</p>
              </div>
            </div>

            <div className="space-y-6">
              <Checklist event={event || {}} visit={visit} />

              <div className="rounded-[1.5rem] border border-foreground/[0.10] bg-background/64 p-5 backdrop-blur-2xl">
                <p className="font-body text-xs font-semibold uppercase text-foreground/42">Your party</p>
                <div className="mt-4 space-y-3">
                  {visit.party.map((guest) => (
                    <div key={guest.id} className="flex items-center gap-3 rounded-[1.1rem] border border-foreground/[0.10] bg-foreground/[0.04] p-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/[0.10] bg-background/52">
                        <UserRound className="h-4 w-4 text-foreground/54" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body text-sm font-semibold text-foreground">{guest.name}</span>
                        <span className="mt-0.5 block font-body text-xs text-foreground/46">{guest.service}</span>
                      </span>
                      <StatusPill status={guest.gfeStatus} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-foreground/[0.10] bg-foreground/[0.04] p-5">
                <div className="flex items-start gap-3">
                  <MessageCircle className="mt-1 h-5 w-5 shrink-0 text-foreground/48" />
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">Text the concierge</p>
                    <p className="mt-1 font-body text-xs leading-relaxed text-foreground/52">
                      In production this opens support. In local preview it is intentionally inert.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
