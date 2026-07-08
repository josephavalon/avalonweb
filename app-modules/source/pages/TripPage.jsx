import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, MessageCircle, ShieldCheck, UserRound } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { fetchTrip } from '@/lib/eventsApi';
import { gfeStatusChip, visitStatusChip, backOnFloorLabel, MONO_STACK } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

/* Trip-page QR placeholder: renders the visit reference as a visual mark.
   The REAL door credential (signed JWT QR + offline manifest) lands with the
   serve scanner (ET5) — until then the door flow is manifest-by-name. */
function MiniQr({ value }) {
  const seed = String(value || 'avalon');
  const blocks = Array.from({ length: 81 }, (_, index) => {
    const char = seed.charCodeAt(index % Math.max(1, seed.length)) || index;
    return (char + index * 7) % 4 !== 0;
  });
  return (
    <div className="grid h-44 w-44 grid-cols-9 gap-1 rounded-[1.35rem] border border-white/12 bg-foreground p-4">
      {blocks.map((on, index) => (
        <span key={index} className={`rounded-[3px] ${on ? 'bg-background' : 'bg-transparent'}`} />
      ))}
    </div>
  );
}

/* All status chips come from the ONE shared module (eng review 11A):
   mono voice, live-green only for cleared, red only for clinical stops. */
function MonoChip({ chip }) {
  return (
    <span
      className="rounded-full border border-white/14 px-3 py-1.5 text-[11px]"
      style={{ fontFamily: MONO_STACK, color: chip.color, letterSpacing: '0.06em' }}
    >
      {chip.label}
    </span>
  );
}

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

function Countdown({ startsAt }) {
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!startsAt) return null;
  const ms = new Date(startsAt).getTime() - nowTs;
  if (ms <= 0) return <span style={{ fontFamily: MONO_STACK }}>DOORS ARE OPEN</span>;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return <span style={{ fontFamily: MONO_STACK }}>{`T−${d}D ${String(h).padStart(2, '0')}H ${String(m).padStart(2, '0')}M`}</span>;
}

function GuestRow({ visit }) {
  const gfe = visit.gfeRequired ? gfeStatusChip(visit.gfeStatus) : null;
  const status = visitStatusChip(visit.status);
  const floor = backOnFloorLabel(visit.backOnFloorMinutes);
  return (
    <div className="flex items-center gap-3 rounded-[1.1rem] border border-white/12 bg-foreground/[0.04] p-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12" style={{ background: 'rgba(13,13,13,0.6)' }}>
        <UserRound className="h-4 w-4 text-foreground/54" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm font-semibold text-foreground">{visit.attendeeName || 'Guest'}</span>
        <span className="mt-0.5 block text-[11px] text-foreground/46" style={{ fontFamily: MONO_STACK }}>
          {[visit.serviceName?.toUpperCase(), floor].filter(Boolean).join(' · ') || 'EXPERIENCE'}
        </span>
      </span>
      <MonoChip chip={gfe || status} />
    </div>
  );
}

export default function TripPage() {
  const { visitId = '' } = useParams();
  const location = useLocation();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = {};
    // Stripe success redirect: /trips/{CHECKOUT_SESSION_ID}?order=<id>
    if (params.get('order')) query.order = params.get('order');
    else if (visitId.startsWith('cs_')) query.session = visitId;
    else query.order = visitId; // free-RSVP flow navigates with the order id
    let alive = true;
    let attempts = 0;
    function load() {
      fetchTrip(query)
        .then((data) => { if (alive) { setTrip(data); setLoading(false); } })
        .catch((err) => {
          // Webhook fulfillment can lag the redirect by a beat — retry briefly.
          if (alive && attempts < 4 && err.status === 404) {
            attempts += 1;
            setTimeout(load, 1500);
          } else if (alive) {
            setError(err.message || 'Trip unavailable.');
            setLoading(false);
          }
        });
    }
    load();
    return () => { alive = false; };
  }, [visitId, location.search]);

  useSeo({
    title: trip ? `${trip.event.name} Trip - Avalon Vitality` : 'Your Trip - Avalon Vitality',
    description: 'Your Avalon event trip page: countdown, credential, health-check status, and your party.',
    path: `/trips/${visitId}`,
    robots: 'noindex,nofollow',
  });

  if (loading || error || !trip) {
    return (
      <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="mx-auto flex min-h-[70svh] max-w-xl flex-col items-center justify-center px-5 text-center">
          {loading ? (
            <>
              <h1 className="font-heading text-5xl uppercase leading-none">Setting up your trip…</h1>
              <p className="mt-4 text-[11px] uppercase text-foreground/50" style={{ fontFamily: MONO_STACK, letterSpacing: '0.1em' }}>Confirming your reservation</p>
            </>
          ) : (
            <>
              <h1 className="font-heading text-5xl uppercase leading-none">Trip not found</h1>
              <p className="mt-4 font-body text-sm text-foreground/60">{error || 'Check the link from your confirmation email.'}</p>
              <Link to="/events" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/16 px-5 font-body text-xs font-semibold uppercase text-foreground/70">
                <ArrowLeft className="h-4 w-4" /> Back to events
              </Link>
            </>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  const { event, visits, order } = trip;
  const primary = visits[0];
  const cleared = visits.every((v) => !v.gfeRequired || v.gfeStatus === 'cleared');

  return (
    <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src="/recovery-lounge-hero.jpg" alt="" className="h-full w-full object-cover opacity-22" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/82 via-black/72 to-black" />
      </div>
      <Navbar />

      <main className="px-4 pb-20 pt-28 md:px-8 md:pt-36">
        <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="rounded-[1.35rem] border border-white/12 p-5 md:p-6"
            style={{ background: 'rgba(13,13,13,0.94)' }}
          >
            <Link to={`/events/${event.slug}`} className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/12 px-4 font-body text-[11px] font-semibold uppercase text-foreground/58">
              <ArrowLeft className="h-3.5 w-3.5" /> Event
            </Link>
            <p className="font-body text-xs font-semibold uppercase text-foreground/42">Your trip</p>
            <h1 className="mt-3 font-heading text-[5.4rem] uppercase leading-[0.82] md:text-[8rem]">{event.name}</h1>

            {/* Boarding-pass strip: date + countdown, dashed rule, mono truth. */}
            <div className="mt-6 flex items-baseline justify-between gap-4 border-b border-dashed border-white/14 pb-4">
              <span className="font-heading text-3xl uppercase leading-none">{formatEventDate(event.startsAt)}</span>
              <span className="text-sm text-foreground/70"><Countdown startsAt={event.startsAt} /></span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.15rem] border border-white/12 bg-foreground/[0.04] p-4">
                <MapPin className="h-4 w-4 text-foreground/48" strokeWidth={1.8} />
                <p className="mt-3 font-body text-[11px] font-semibold uppercase text-foreground/42">Where</p>
                <p className="mt-1 font-body text-sm font-semibold text-foreground">
                  {event.exactAddress || `${event.venue || 'San Francisco'} — address unlocks when you're confirmed`}
                </p>
                {event.arrivalNotes ? (
                  <p className="mt-1 font-body text-xs text-foreground/50">{event.arrivalNotes}</p>
                ) : null}
              </div>
              <div className="rounded-[1.15rem] border border-white/12 bg-foreground/[0.04] p-4">
                <Clock className="h-4 w-4 text-foreground/48" strokeWidth={1.8} />
                <p className="mt-3 font-body text-[11px] font-semibold uppercase text-foreground/42">Reservation</p>
                <p className="mt-1 text-sm" style={{ fontFamily: MONO_STACK, color: visitStatusChip(primary.status).color }}>
                  {visitStatusChip(primary.status).label}
                </p>
                {order?.refundStatus ? (
                  <p className="mt-1 text-xs text-foreground/50" style={{ fontFamily: MONO_STACK }}>REFUND: {String(order.refundStatus).toUpperCase()}</p>
                ) : null}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: EASE }}
            className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"
          >
            <div className="rounded-[1.35rem] border border-white/12 p-5 md:p-6" style={{ background: 'rgba(13,13,13,0.94)' }}>
              <div className="flex flex-col items-center text-center">
                <MiniQr value={primary.id} />
                <p className="mt-5 font-body text-xs font-semibold uppercase text-foreground/42">Door credential</p>
                <p className="mt-2 text-[11px] text-foreground/55" style={{ fontFamily: MONO_STACK, letterSpacing: '0.08em' }}>
                  REF {String(primary.id).slice(0, 8).toUpperCase()}
                </p>
                <p className="mt-3 max-w-xs font-body text-sm leading-relaxed text-foreground/56">
                  Show this at check-in. Your name is on the door list either way.
                </p>
              </div>
              {cleared ? (
                <div className="mt-6 rounded-[1.15rem] border border-white/12 p-4">
                  <p className="text-xs" style={{ fontFamily: MONO_STACK, color: gfeStatusChip('cleared').color, letterSpacing: '0.06em' }}>
                    CLEARED ✓ — NOTHING TO THINK ABOUT AT THE DOOR
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.35rem] border border-white/12 bg-foreground/[0.045] p-5">
                <p className="font-body text-xs font-semibold uppercase text-foreground/42">Before you go</p>
                <div className="mt-4 space-y-3">
                  {visits.filter((v) => v.gfeRequired).map((v) => {
                    const chip = gfeStatusChip(v.gfeStatus);
                    return (
                      <div key={v.id} className="flex items-center gap-3 rounded-[1.1rem] border border-white/12 p-4" style={{ background: 'rgba(13,13,13,0.6)' }}>
                        <ShieldCheck className="h-4 w-4 shrink-0 text-foreground/55" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-body text-sm font-semibold text-foreground">
                            Health check — {v.attendeeName || 'Guest'}
                          </span>
                          <span className="mt-0.5 block font-body text-xs text-foreground/50">
                            90 seconds with our clinical team. Their link goes to their email.
                          </span>
                        </span>
                        <MonoChip chip={chip} />
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3 rounded-[1.1rem] border border-white/12 p-4" style={{ background: 'rgba(13,13,13,0.6)' }}>
                    <Clock className="h-4 w-4 shrink-0 text-foreground/55" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-body text-sm font-semibold text-foreground">Hydrate before you arrive</span>
                      <span className="mt-0.5 block font-body text-xs text-foreground/50">Water before, electrolytes after. You'll thank yourself on the floor.</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/12 p-5" style={{ background: 'rgba(13,13,13,0.94)' }}>
                <p className="font-body text-xs font-semibold uppercase text-foreground/42">Your party</p>
                <div className="mt-4 space-y-3">
                  {visits.map((v) => <GuestRow key={v.id} visit={v} />)}
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/12 bg-foreground/[0.04] p-5">
                <div className="flex items-start gap-3">
                  <MessageCircle className="mt-1 h-5 w-5 shrink-0 text-foreground/48" />
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">Questions before the event?</p>
                    <p className="mt-1 font-body text-xs leading-relaxed text-foreground/52">
                      <a className="underline decoration-foreground/30 underline-offset-2" href="/support">Message the concierge</a> — we answer fast.
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
