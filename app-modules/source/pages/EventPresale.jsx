import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, Ticket, UserRound } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PremiumButton from '@/components/ui/PremiumButton';
import { fetchEvent, reserveEvent } from '@/lib/eventsApi';
import { formatPriceCents, MONO_STACK } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];
const FALLBACK_COVER = '/backgrounds/iv-vitamins-hero.webp';
const inputClass = 'min-h-[52px] w-full rounded-2xl border border-white/12 px-4 font-body text-sm font-semibold text-foreground outline-none transition placeholder:text-foreground/36 focus:border-foreground/34';
const inputStyle = { background: 'rgba(13,13,13,0.7)' };

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

/* Price is a number, never a table (DESIGN.md): each tier is one price and
   one sentence. */
function TierRow({ tier, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={tier.soldOut}
      className={`w-full rounded-[1.25rem] border p-4 text-left transition ${
        active
          ? 'border-foreground bg-foreground text-background'
          : tier.soldOut
            ? 'cursor-not-allowed border-white/8 bg-foreground/[0.02] text-foreground/35'
            : 'border-white/12 bg-foreground/[0.04] text-foreground hover:border-foreground/24'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-sm font-bold">{tier.name}</p>
          {tier.description ? (
            <p className={`mt-2 max-w-md font-body text-xs leading-relaxed ${active ? 'text-background/66' : 'text-foreground/56'}`}>
              {tier.description}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-3xl uppercase leading-none">
            {tier.applicationGated ? 'Apply' : tier.priceCents > 0 ? formatPriceCents(tier.priceCents) : 'Free'}
          </p>
          <p className={`mt-1 text-[10px] uppercase ${active ? 'text-background/54' : 'text-foreground/42'}`} style={{ fontFamily: MONO_STACK, letterSpacing: '0.08em' }}>
            {tier.soldOut ? "THIS ONE'S FULL" : tier.remaining != null && tier.remaining <= 8 ? `${tier.remaining} LEFT` : 'OPEN'}
          </p>
        </div>
      </div>
    </button>
  );
}

/* Custom pill stepper — native <select> wheels are banned from the reserve
   flow (eng review, repo scar tissue). */
function Stepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-foreground/[0.045]"
        aria-label="Remove attendee"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-10 text-center font-heading text-4xl uppercase leading-none">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(8, value + 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-foreground/[0.045]"
        aria-label="Add attendee"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function buildItems({ tier, experienceTier, party }) {
  const primary = party.filter((g) => g.iv || !experienceTier);
  const experience = experienceTier ? party.filter((g) => !g.iv) : [];
  const items = [];
  if (primary.length) items.push({ tierId: tier.id, attendees: primary.map(({ name, email }) => ({ name, email })) });
  if (experience.length) items.push({ tierId: experienceTier.id, attendees: experience.map(({ name, email }) => ({ name, email })) });
  return items;
}

function MiniSummary({ event, tier, experienceTier, party, totalCents, error }) {
  const ivCount = party.filter((g) => g.iv || !experienceTier).length;
  const expCount = party.length - ivCount;
  return (
    <div className="rounded-[1.35rem] border border-white/12 p-4" style={{ background: 'rgba(13,13,13,0.94)' }}>
      <p className="font-body text-[11px] font-semibold uppercase text-foreground/42">Reserve summary</p>
      <h2 className="mt-2 font-heading text-4xl uppercase leading-none">{event.name}</h2>
      <div className="mt-5 space-y-3">
        {ivCount > 0 && (
          <div className="flex justify-between gap-4 font-body text-sm text-foreground/68">
            <span>{tier.name} × {ivCount}</span>
            <span style={{ fontFamily: MONO_STACK }}>{formatPriceCents(tier.priceCents * ivCount)}</span>
          </div>
        )}
        {expCount > 0 && experienceTier && (
          <div className="flex justify-between gap-4 font-body text-sm text-foreground/68">
            <span>{experienceTier.name} × {expCount}</span>
            <span style={{ fontFamily: MONO_STACK }}>{formatPriceCents(experienceTier.priceCents * expCount)}</span>
          </div>
        )}
        <div className="border-t border-foreground/[0.10] pt-3">
          <div className="flex items-end justify-between gap-4">
            <span className="font-body text-xs font-semibold uppercase text-foreground/42">Total</span>
            {/* Price at rest is carved in stone: mono, no animation. */}
            <span className="font-heading text-5xl uppercase leading-none">{totalCents > 0 ? formatPriceCents(totalCents) : 'Free'}</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-[10px] uppercase leading-relaxed text-foreground/45" style={{ fontFamily: MONO_STACK, letterSpacing: '0.08em' }}>
        SEAT HELD 15:00 AT CHECKOUT · FULL REFUND ≥7 DAYS
      </p>
      {error ? (
        <p className="mt-3 font-body text-sm text-foreground/80">{error}</p>
      ) : null}
    </div>
  );
}

export default function EventPresale() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchEvent(eventId)
      .then((data) => { if (alive) setEvent(data); })
      .catch(() => { if (alive) setEvent(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [eventId]);

  useSeo({
    title: event ? `Reserve ${event.name} - Avalon Events` : 'Reserve - Avalon Events',
    description: 'Three taps: tier, party, pay. Back on the floor in ~30.',
    path: `/presale/${eventId}`,
  });

  if (loading) {
    return (
      <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 pb-20 pt-32 md:px-8">
          <div className="min-h-[460px] animate-pulse rounded-[1.35rem] border border-white/12 bg-white/[0.04]" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!event || !(event.tiers || []).length) {
    return (
      <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="mx-auto flex min-h-[70svh] max-w-xl flex-col items-center justify-center px-5 text-center">
          <h1 className="font-heading text-6xl uppercase leading-none">Presale unavailable</h1>
          <p className="mt-4 font-body text-sm text-foreground/60">This event isn't open for reservations right now.</p>
          <Link to="/events" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/16 px-5 font-body text-xs font-semibold uppercase text-foreground/70">
            <ArrowLeft className="h-4 w-4" /> Back to events
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return <EventPresaleFlow event={event} />;
}

function EventPresaleFlow({ event }) {
  const navigate = useNavigate();
  const selectableTiers = event.tiers.filter((t) => !t.experienceOnly);
  const experienceTier = event.tiers.find((t) => t.experienceOnly && !t.soldOut) || null;
  const [tierId, setTierId] = useState((selectableTiers.find((t) => !t.soldOut) || selectableTiers[0])?.id || '');
  const [party, setParty] = useState([{ name: '', email: '', iv: true }]);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const tier = useMemo(
    () => event.tiers.find((t) => t.id === tierId) || selectableTiers[0],
    [event, tierId, selectableTiers],
  );
  const applicationOnly = Boolean(tier?.applicationGated);
  const cover = (event.assets || []).map((a) => a.renditions?.hero_1920 || a.storage_path).filter(Boolean)[0] || FALLBACK_COVER;

  const totalCents = useMemo(() => {
    if (applicationOnly) return 0;
    const ivCount = party.filter((g) => g.iv || !experienceTier).length;
    const expCount = party.length - ivCount;
    return ivCount * (tier?.priceCents || 0) + expCount * (experienceTier?.priceCents || 0);
  }, [applicationOnly, party, tier, experienceTier]);

  function updateCount(nextCount) {
    setParty((current) => {
      if (nextCount > current.length) {
        return [...current, ...Array.from({ length: nextCount - current.length }, () => ({ name: '', email: '', iv: true }))];
      }
      return current.slice(0, nextCount);
    });
  }

  function updateGuest(index, patch) {
    setParty((current) => current.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  async function confirmReserve() {
    setError('');
    const email = buyerEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Add your email — your reservation and health-check link land there.');
      return;
    }
    const namedParty = party.map((g, i) => ({
      ...g,
      name: g.name.trim() || `Guest ${i + 1}`,
      email: (g.email || (i === 0 ? email : '')).trim(),
    }));
    const missingIvEmail = namedParty.find((g) => (g.iv || !experienceTier) && !g.email);
    if (missingIvEmail) {
      setError(`${missingIvEmail.name} needs an email — every IV guest gets their own health-check link.`);
      return;
    }
    setSubmitting(true);
    try {
      if (applicationOnly) {
        const res = await fetch('/api/events/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: event.slug, tierId: tier.id, name: namedParty[0].name, email }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.ok === false) throw new Error(body.error || 'Request failed.');
        navigate(`/events/${event.slug}?requested=1`);
        return;
      }
      const result = await reserveEvent({
        slug: event.slug,
        items: buildItems({ tier, experienceTier, party: namedParty }),
        buyer: { email },
      });
      if (result.url) {
        window.location.assign(result.url);       // Stripe Checkout (Apple Pay first)
        return;
      }
      navigate(`/trips/${result.orderId}`);        // free RSVP → straight to the trip page
    } catch (err) {
      setError(err.message || 'Reservation failed — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={cover} alt="" className="h-full w-full object-cover opacity-24" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/84 via-black/72 to-black" />
      </div>
      <Navbar />

      <main className="px-4 pb-20 pt-28 md:px-8 md:pt-36">
        <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_380px]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="rounded-[1.35rem] border border-white/12 p-4 md:p-6"
            style={{ background: 'rgba(13,13,13,0.94)' }}
          >
            <Link to={`/events/${event.slug}`} className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 font-body text-[11px] font-semibold uppercase text-foreground/58">
              <ArrowLeft className="h-3.5 w-3.5" /> Event page
            </Link>

            <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
              <div className="relative min-h-[460px] overflow-hidden rounded-[1.35rem] border border-white/12 bg-background">
                <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/84 via-black/34 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="text-xs text-white/60" style={{ fontFamily: MONO_STACK, letterSpacing: '0.1em' }}>
                    {formatEventDate(event.startsAt)} · {(event.venue || '').toUpperCase()}
                  </p>
                  <h1 className="mt-3 break-normal font-heading text-6xl uppercase leading-[0.85] text-white md:text-8xl">
                    {applicationOnly ? 'Request' : 'Reserve'}
                  </h1>
                  <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-white/68">
                    {applicationOnly
                      ? "Four fields. We'll get back within 24 hours."
                      : 'Three taps: tier, party, pay. Then the trip page becomes your pre-event home.'}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-foreground/48" />
                    <p className="font-body text-xs font-semibold uppercase text-foreground/42">Tap 1 · Tier</p>
                  </div>
                  <div className="space-y-3">
                    {selectableTiers.map((item) => (
                      <TierRow key={item.id} tier={item} active={item.id === tier?.id} onClick={() => setTierId(item.id)} />
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.35rem] border border-white/12 bg-foreground/[0.035] p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-body text-xs font-semibold uppercase text-foreground/42">Tap 2 · Your party</p>
                      <p className="mt-1 font-body text-sm text-foreground/62">
                        Every IV guest gets their own health-check link at their own email.
                      </p>
                    </div>
                    <Stepper value={party.length} onChange={updateCount} />
                  </div>
                  <div className="grid gap-3">
                    {party.map((guest, index) => (
                      <div key={index} className="grid gap-3 rounded-[1.1rem] border border-white/12 p-3 sm:grid-cols-[1fr_1fr_auto]" style={{ background: 'rgba(13,13,13,0.6)' }}>
                        <label className="block">
                          <span className="mb-2 flex items-center gap-2 font-body text-[11px] font-semibold uppercase text-foreground/42">
                            <UserRound className="h-3.5 w-3.5" /> Attendee {index + 1}
                          </span>
                          <input
                            className={inputClass}
                            style={inputStyle}
                            value={guest.name}
                            onChange={(e) => updateGuest(index, { name: e.target.value })}
                            placeholder="Guest name"
                            autoComplete="off"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block font-body text-[11px] font-semibold uppercase text-foreground/42">Email {index === 0 ? '(yours below works)' : ''}</span>
                          <input
                            className={inputClass}
                            style={inputStyle}
                            type="email"
                            value={guest.email}
                            onChange={(e) => updateGuest(index, { email: e.target.value })}
                            placeholder={index === 0 ? 'Uses your email' : 'guest@email.com'}
                            autoComplete="off"
                          />
                        </label>
                        {experienceTier ? (
                          <button
                            type="button"
                            onClick={() => updateGuest(index, { iv: !guest.iv })}
                            className={`min-h-[52px] self-end rounded-2xl border px-4 font-body text-xs font-bold uppercase transition ${
                              guest.iv
                                ? 'border-foreground bg-foreground text-background'
                                : 'border-white/12 bg-foreground/[0.045] text-foreground/58'
                            }`}
                          >
                            {guest.iv ? tier?.name || 'IV' : experienceTier.name}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.35rem] border border-white/12 bg-foreground/[0.035] p-4">
                  <p className="font-body text-xs font-semibold uppercase text-foreground/42">
                    Tap 3 · {applicationOnly ? 'Request' : 'Pay'}
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-2 block font-body text-[11px] font-semibold uppercase text-foreground/42">Your email</span>
                    <input
                      className={inputClass}
                      style={inputStyle}
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                    />
                  </label>
                  {!applicationOnly && totalCents > 0 ? (
                    <p className="mt-3 text-[10px] uppercase text-foreground/45" style={{ fontFamily: MONO_STACK, letterSpacing: '0.08em' }}>
                      APPLE PAY · CARD — SECURE STRIPE CHECKOUT
                    </p>
                  ) : null}
                </section>
              </div>
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: EASE }}
            className="lg:sticky lg:top-28 lg:self-start"
          >
            <MiniSummary event={event} tier={tier} experienceTier={experienceTier} party={party} totalCents={totalCents} error={error} />
            <div className="mt-4 rounded-[1.35rem] border border-white/12 p-4" style={{ background: 'rgba(13,13,13,0.94)' }}>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-foreground/70" />
                <p className="font-body text-sm leading-relaxed text-foreground/62">
                  First time? A 90-second health check from our clinical team clears you before the event. Your health details live with our clinical partners — never on this page.
                </p>
              </div>
              <PremiumButton
                as="button"
                type="button"
                onClick={confirmReserve}
                disabled={submitting}
                wrapperClassName="mt-4 w-full"
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-xs font-bold uppercase text-background transition hover:bg-foreground/90 disabled:opacity-60"
              >
                {submitting ? 'Holding your spot…' : applicationOnly ? 'Request to join' : totalCents > 0 ? 'Continue to pay' : 'Confirm RSVP'}
                <Check className="h-4 w-4" strokeWidth={2} />
              </PremiumButton>
            </div>
          </motion.aside>
        </section>
      </main>

      <Footer />
    </div>
  );
}
