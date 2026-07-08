import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import InlineStripeCheckout from '@/components/checkout/InlineStripeCheckout';
import { fetchEvent, reserveEvent } from '@/lib/eventsApi';
import { formatPriceCents } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

const inputClass = 'min-h-[48px] w-full rounded-xl border border-foreground/14 bg-background/60 px-4 font-body text-sm font-semibold text-foreground outline-none transition placeholder:text-foreground/36 focus:border-foreground/34';

function formatEventDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* Tier as a BuilderRow-style select row: name left, price right. */
function TierRow({ tier, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={tier.soldOut}
      aria-pressed={active}
      className={`av-treatment-card flex w-full items-center justify-between gap-3 overflow-hidden rounded-[1.05rem] border px-4 py-4 text-left transition-colors duration-base ease-editorial md:px-5 ${
        active ? 'is-open border-foreground/45' : tier.soldOut ? 'cursor-not-allowed opacity-45' : ''
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-lg uppercase leading-none tracking-normal text-foreground md:text-xl">{tier.name}</span>
        {tier.description ? (
          <span className="mt-1 font-body text-[12px] font-semibold text-foreground/45 md:text-[13px]">{tier.description}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-right font-body text-[13px] font-semibold text-foreground/64 md:text-sm">
        {tier.soldOut
          ? 'Sold out'
          : tier.applicationGated
            ? 'Apply'
            : tier.priceCents > 0
              ? formatPriceCents(tier.priceCents)
              : 'Free'}
        {!tier.soldOut && tier.remaining != null && tier.remaining <= 8 ? ` · ${tier.remaining} left` : ''}
      </span>
    </button>
  );
}

/* Custom pill stepper — native <select> wheels are banned from the reserve
   flow (eng review, repo scar tissue). */
function Stepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.045]"
        aria-label="Remove attendee"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-8 text-center font-heading text-2xl uppercase leading-none">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(8, value + 1))}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.045]"
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
      <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
        <header><Navbar /></header>
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-24 pt-[9rem]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-[1.05rem] border border-foreground/10 bg-foreground/[0.04]" />
          ))}
        </main>
        <Footer />
      </div>
    );
  }

  if (!event || !(event.tiers || []).length) {
    return (
      <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
        <header><Navbar /></header>
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
  // Inline-checkout state: set from /api/events/checkout `mode: 'inline'`
  // response. When present, we render <InlineStripeCheckout /> in place of
  // the reserve button so the user pays without leaving the page.
  const [checkout, setCheckout] = useState(null); // { clientSecret, returnUrl }

  const tier = useMemo(
    () => event.tiers.find((t) => t.id === tierId) || selectableTiers[0],
    [event, tierId, selectableTiers],
  );
  const applicationOnly = Boolean(tier?.applicationGated);

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
        mode: 'inline',
      });
      if (result.clientSecret) {
        // Inline: mount Stripe Elements below; Stripe redirects to returnUrl after confirm.
        setCheckout({ clientSecret: result.clientSecret, returnUrl: result.returnUrl });
        return;
      }
      if (result.url) {
        window.location.assign(result.url);       // Legacy hosted Checkout fallback.
        return;
      }
      navigate(`/trips/${result.orderId}`);        // free RSVP → straight to the trip page
    } catch (err) {
      setError(err.message || 'Reservation failed — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const ivCount = party.filter((g) => g.iv || !experienceTier).length;
  const expCount = party.length - ivCount;
  const ctaLabel = submitting
    ? 'Holding your spot…'
    : applicationOnly
      ? 'Request to join'
      : totalCents > 0
        ? `Continue to pay — ${formatPriceCents(totalCents)}`
        : 'Confirm RSVP';

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header><Navbar /></header>

      <main className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-24 pt-[5.25rem] md:pt-[5.75rem]">
        <div className="mb-8 pt-8 text-center md:mb-10 md:pt-12">
          <p className="font-body text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground/45">
            <Link to={`/events/${event.slug}`} className="hover:text-foreground/70">{event.name}</Link>
            {' · '}{formatEventDate(event.startsAt)}
          </p>
          <h1 className="mt-3 font-heading text-[3rem] uppercase leading-[0.86] tracking-normal text-foreground md:text-[4.4rem]">
            {applicationOnly ? 'Request' : 'Reserve'}
          </h1>
          <p className="mt-3 font-body text-[15px] font-semibold text-foreground/60">
            {applicationOnly
              ? "Four fields. We'll get back within 24 hours."
              : 'Tier, party, pay. Back on the floor in ~30.'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {selectableTiers.map((item) => (
            <TierRow key={item.id} tier={item} active={item.id === tier?.id} onClick={() => setTierId(item.id)} />
          ))}

          <div className="av-treatment-card overflow-hidden rounded-[1.05rem] border">
            <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-5">
              <span className="flex min-w-0 flex-col">
                <span className="font-heading text-lg uppercase leading-none tracking-normal text-foreground md:text-xl">Party</span>
                <span className="mt-1 font-body text-[12px] font-semibold text-foreground/45 md:text-[13px]">
                  Every IV guest gets their own health-check link.
                </span>
              </span>
              <Stepper value={party.length} onChange={updateCount} />
            </div>
            {party.length > 1 || experienceTier ? (
              <div className="grid gap-3 border-t border-foreground/[0.08] px-4 pb-4 pt-3.5 md:px-5">
                {party.map((guest, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      className={inputClass}
                      value={guest.name}
                      onChange={(e) => updateGuest(index, { name: e.target.value })}
                      placeholder={`Guest ${index + 1} name`}
                      aria-label={`Guest ${index + 1} name`}
                      autoComplete="off"
                    />
                    <input
                      className={inputClass}
                      type="email"
                      value={guest.email}
                      onChange={(e) => updateGuest(index, { email: e.target.value })}
                      placeholder={index === 0 ? 'Uses your email' : 'guest@email.com'}
                      aria-label={`Guest ${index + 1} email`}
                      autoComplete="off"
                    />
                    {experienceTier ? (
                      <button
                        type="button"
                        onClick={() => updateGuest(index, { iv: !guest.iv })}
                        className={`min-h-[48px] rounded-xl border px-4 font-body text-xs font-bold uppercase transition ${
                          guest.iv
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-foreground/14 bg-foreground/[0.045] text-foreground/58'
                        }`}
                      >
                        {guest.iv ? tier?.name || 'IV' : experienceTier.name}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="av-treatment-card flex flex-col gap-3 overflow-hidden rounded-[1.05rem] border px-4 py-4 md:px-5">
            <span className="font-heading text-lg uppercase leading-none tracking-normal text-foreground md:text-xl">
              Your email
            </span>
            <input
              className={inputClass}
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="you@email.com"
              aria-label="Your email"
              autoComplete="email"
            />
          </div>

          {!applicationOnly && expCount > 0 && experienceTier ? (
            <div className="av-treatment-card flex items-center justify-between gap-3 rounded-[1.05rem] border px-4 py-3.5 md:px-5">
              <span className="font-body text-[13px] font-semibold text-foreground/60">
                {tier.name} × {ivCount} · {experienceTier.name} × {expCount}
              </span>
              <span className="font-body text-[13px] font-semibold text-foreground/64">{formatPriceCents(totalCents)}</span>
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-center font-body text-sm font-semibold text-foreground/80">{error}</p>
        ) : null}

        {checkout ? (
          <div className="mt-5 rounded-[1.35rem] border border-foreground/12 bg-background/40 p-4 md:p-5">
            <p className="mb-3 font-body text-[11px] uppercase tracking-[0.22em] text-foreground/45">Card details</p>
            <InlineStripeCheckout
              clientSecret={checkout.clientSecret}
              returnUrl={checkout.returnUrl}
              submitLabel={totalCents > 0 ? `Pay ${formatPriceCents(totalCents)}` : 'Confirm reservation'}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={confirmReserve}
            disabled={submitting}
            className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-full bg-white px-5 font-heading text-lg uppercase leading-none tracking-[0.08em] text-black transition-transform hover:bg-white/95 active:scale-[0.99] disabled:opacity-60"
          >
            {ctaLabel}
          </button>
        )}
        <p className="mt-2 text-center font-body text-[12px] font-semibold text-foreground/50">
          {applicationOnly
            ? "We'll reply within 24 hours."
            : 'Secure Stripe checkout · Seat held 15 minutes. Full refund 7+ days out.'}
        </p>
        <p className="mt-1 text-center font-body text-[12px] font-semibold text-foreground/50">
          First time? A 90-second health check clears you before the event. Your health details never live on this page.
        </p>
      </main>

      <Footer />
    </div>
  );
}
