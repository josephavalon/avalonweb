import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Apple, Check, CreditCard, Minus, Plus, ShieldCheck, Ticket, UserRound } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PremiumButton from '@/components/ui/PremiumButton';
import { createMockVisit, events, findEventBySlug } from '@/data/events';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];
const inputClass = 'min-h-[52px] w-full rounded-2xl border border-foreground/[0.12] bg-background/62 px-4 font-body text-sm font-semibold text-foreground outline-none transition placeholder:text-foreground/36 focus:border-foreground/34';

function currency(cents) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function getEventDateLabel(event) {
  if (!event.dateYear || event.date?.includes(event.dateYear)) return event.dateDisplay || event.date;
  return event.dateDisplay || [event.date, event.dateYear].filter(Boolean).join(', ');
}

function isRequestTier(event, tier) {
  return event.state === 'application' || tier?.serviceType === 'request';
}

function tierAllowsIv(event, tier) {
  return !isRequestTier(event, tier) && tier?.serviceType !== 'experience_only';
}

function TierRow({ tier, active, onClick }) {
  const priceLabel = tier.serviceType === 'request' ? 'Request' : tier.price ? `$${tier.price}` : 'Apply';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[1.25rem] border p-4 text-left transition ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-foreground/[0.10] bg-foreground/[0.04] text-foreground hover:border-foreground/24'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-sm font-bold">{tier.name}</p>
          <p className={`mt-2 max-w-md font-body text-xs leading-relaxed ${active ? 'text-background/66' : 'text-foreground/56'}`}>
            {tier.detail}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-3xl uppercase leading-none">{priceLabel}</p>
          <p className={`mt-1 font-body text-[11px] font-semibold uppercase ${active ? 'text-background/54' : 'text-foreground/42'}`}>{tier.state}</p>
        </div>
      </div>
    </button>
  );
}

function Stepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.045]"
        aria-label="Remove attendee"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-10 text-center font-heading text-4xl uppercase leading-none">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(8, value + 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.045]"
        aria-label="Add attendee"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function MiniSummary({ event, tier, party }) {
  const requestOnly = isRequestTier(event, tier);
  const allowsIv = tierAllowsIv(event, tier);
  const ivCount = allowsIv ? party.filter((guest) => guest.iv).length : 0;
  const experienceCount = party.length - ivCount;
  const ivTotal = (tier?.price || 0) * ivCount * 100;
  const experienceUnitCents = allowsIv ? 3500 : (tier?.price || 0) * 100;
  const experienceTotal = Math.max(0, experienceCount) * experienceUnitCents;
  const total = requestOnly ? 0 : ivTotal + experienceTotal;

  return (
    <div className="rounded-[1.35rem] border border-foreground/[0.10] bg-background/62 p-4 backdrop-blur-2xl">
      <p className="font-body text-[11px] font-semibold uppercase text-foreground/42">{requestOnly ? 'Request summary' : 'Reserve summary'}</p>
      <h2 className="mt-2 font-heading text-4xl uppercase leading-none">{event.title}</h2>
      <div className="mt-5 space-y-3">
        {requestOnly && (
          <div className="flex justify-between gap-4 font-body text-sm text-foreground/68">
            <span>Request to join x {party.length}</span>
            <span>No checkout</span>
          </div>
        )}
        {ivCount > 0 && (
          <div className="flex justify-between gap-4 font-body text-sm text-foreground/68">
            <span>{tier.name} x {ivCount}</span>
            <span>{currency(ivTotal)}</span>
          </div>
        )}
        {experienceCount > 0 && (
          <div className="flex justify-between gap-4 font-body text-sm text-foreground/68">
            <span>Experience access x {experienceCount}</span>
            <span>{currency(experienceTotal)}</span>
          </div>
        )}
        <div className="border-t border-foreground/[0.10] pt-3">
          <div className="flex items-end justify-between gap-4">
            <span className="font-body text-xs font-semibold uppercase text-foreground/42">{requestOnly ? 'Status' : 'Total'}</span>
            <span className="font-heading text-5xl uppercase leading-none">{requestOnly ? 'Request' : currency(total)}</span>
          </div>
        </div>
      </div>
      <p className="mt-4 font-body text-[11px] leading-relaxed text-foreground/45">
        {requestOnly ? 'Mocked local request. No lead, payment, or live API call is created.' : 'Mocked checkout. No Stripe session is created.'}
      </p>
    </div>
  );
}

export default function EventPresale() {
  const { eventId = '' } = useParams();
  const event = findEventBySlug(eventId) || events.find((item) => item.presaleId === eventId);

  if (!event?.tiers?.length) {
    return <EventPresaleNotFound eventId={eventId} />;
  }

  return <EventPresaleFlow event={event} />;
}

function EventPresaleNotFound({ eventId }) {
  const requestEvent = events.find((item) => item.state === 'application');

  useSeo({
    title: 'Presale not found - Avalon Events',
    description: 'Request access to an Avalon private event when a presale link is unavailable.',
    path: `/presale/${eventId}`,
  });

  return (
    <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black/88 via-black/76 to-black" />
      </div>
      <Navbar />

      <main className="px-4 pb-20 pt-28 md:px-8 md:pt-36">
        <section className="mx-auto max-w-3xl rounded-[1.75rem] border border-foreground/[0.10] bg-background/68 p-6 shadow-[0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-8">
          <Link to="/events" className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 font-body text-[11px] font-semibold uppercase text-foreground/58">
            <ArrowLeft className="h-3.5 w-3.5" /> Events
          </Link>
          <p className="font-body text-xs font-semibold uppercase text-foreground/42">Presale unavailable</p>
          <h1 className="mt-3 font-heading text-[4.5rem] uppercase leading-[0.82] md:text-[6rem]">Request access</h1>
          <p className="mt-5 max-w-xl font-body text-sm leading-relaxed text-foreground/62">
            We could not find a local mocked event for this presale link. You can return to events or open the private group request flow instead.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {requestEvent && (
              <PremiumButton
                as={Link}
                to={`/presale/${requestEvent.slug}`}
                wrapperClassName="inline-flex"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-foreground px-6 font-body text-xs font-black uppercase text-background transition hover:bg-foreground/90"
              >
                Request to join
              </PremiumButton>
            )}
            <Link to="/events" className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-foreground/[0.14] px-6 font-body text-xs font-bold uppercase text-foreground/68">
              View events
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function EventPresaleFlow({ event }) {
  const navigate = useNavigate();
  const initialTier = event.tiers?.[0];
  const [tierId, setTierId] = useState(event.tiers?.[0]?.id || '');
  const [count, setCount] = useState(isRequestTier(event, initialTier) ? 1 : 2);
  const [party, setParty] = useState([
    { name: isRequestTier(event, initialTier) ? 'Host contact' : 'Jordan Lee', iv: tierAllowsIv(event, initialTier) },
    ...(isRequestTier(event, initialTier) ? [] : [{ name: 'Maya Chen', iv: false }]),
  ]);

  const tier = useMemo(() => event.tiers.find((item) => item.id === tierId) || event.tiers[0], [event, tierId]);
  const requestOnly = isRequestTier(event, tier);
  const allowsIv = tierAllowsIv(event, tier);
  const eventDateLabel = getEventDateLabel(event);
  const totalCents = useMemo(() => {
    if (requestOnly) return 0;
    const ivCount = allowsIv ? party.filter((guest) => guest.iv).length : 0;
    const experienceCount = party.length - ivCount;
    const experienceUnitCents = allowsIv ? 3500 : (tier?.price || 0) * 100;
    return ivCount * (tier?.price || 0) * 100 + experienceCount * experienceUnitCents;
  }, [allowsIv, party, requestOnly, tier]);

  useSeo({
    title: `${requestOnly ? 'Request' : 'Reserve'} ${event.title} - Avalon Events`,
    description: 'Mocked Avalon event flow with tier, party, and wallet-ready trip page.',
    path: `/presale/${event.slug}`,
  });

  function selectTier(nextTier) {
    setTierId(nextTier.id);
    if (!tierAllowsIv(event, nextTier)) {
      setParty((current) => current.map((guest) => ({ ...guest, iv: false })));
    }
  }

  function updateCount(nextCount) {
    setCount(nextCount);
    setParty((current) => {
      if (nextCount > current.length) {
        return [
          ...current,
          ...Array.from({ length: nextCount - current.length }, (_, index) => ({ name: `Guest ${current.length + index + 1}`, iv: allowsIv })),
        ];
      }
      return current.slice(0, nextCount);
    });
  }

  function updateGuest(index, patch) {
    const normalizedPatch = !allowsIv && Object.prototype.hasOwnProperty.call(patch, 'iv') ? { ...patch, iv: false } : patch;
    setParty((current) => current.map((guest, guestIndex) => (guestIndex === index ? { ...guest, ...normalizedPatch } : guest)));
  }

  function confirmReserve() {
    const visit = createMockVisit({
      eventSlug: event.slug,
      tierId: tier.id,
      party,
      totalCents,
    });
    navigate(`/trips/${visit.id}`);
  }

  return (
    <div className="app-shell relative isolate min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={event.cover} alt="" className="h-full w-full object-cover opacity-24" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/84 via-black/72 to-black" />
      </div>
      <Navbar />

      <main className="px-4 pb-20 pt-28 md:px-8 md:pt-36">
        <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_380px]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="rounded-[1.75rem] border border-foreground/[0.10] bg-background/62 p-4 shadow-[0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-6"
          >
            <Link to={`/events/${event.slug}`} className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 font-body text-[11px] font-semibold uppercase text-foreground/58">
              <ArrowLeft className="h-3.5 w-3.5" /> Event page
            </Link>

            <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
              <div className="relative min-h-[460px] overflow-hidden rounded-[1.35rem] border border-foreground/[0.10] bg-background">
                <img src={event.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/84 via-black/34 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="font-body text-xs font-semibold uppercase text-white/58">{eventDateLabel} / {event.neighborhood}</p>
                  <h1 className="mt-3 font-heading text-[4.75rem] uppercase leading-[0.82] text-white md:text-[6.8rem]">{requestOnly ? 'Request' : 'Reserve'}</h1>
                  <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-white/68">
                    {requestOnly ? 'Share a local mocked request. No payment, live lead, or health intake is submitted.' : 'Three taps: tier, party, confirm. Then the trip page becomes the pre-event home.'}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-foreground/48" />
                    <p className="font-body text-xs font-semibold uppercase text-foreground/42">Tap 1 / {requestOnly ? 'Request' : 'Tier'}</p>
                  </div>
                  <div className="space-y-3">
                    {event.tiers.map((item) => (
                      <TierRow key={item.id} tier={item} active={item.id === tier.id} onClick={() => selectTier(item)} />
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.035] p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-body text-xs font-semibold uppercase text-foreground/42">Tap 2 / Party</p>
                      <p className="mt-1 font-body text-sm text-foreground/62">
                        {requestOnly
                          ? 'Add the host or group contacts for this local request.'
                          : allowsIv
                            ? 'Each IV guest gets their own health-check status.'
                            : 'This tier is experience-only. IV appointments are disabled for every attendee.'}
                      </p>
                    </div>
                    <Stepper value={count} onChange={updateCount} />
                  </div>
                  <div className="grid gap-3">
                    {party.map((guest, index) => (
                      <div key={index} className="grid gap-3 rounded-[1.1rem] border border-foreground/[0.10] bg-background/54 p-3 sm:grid-cols-[1fr_auto]">
                        <label className="block">
                          <span className="mb-2 flex items-center gap-2 font-body text-[11px] font-semibold uppercase text-foreground/42">
                            <UserRound className="h-3.5 w-3.5" /> Attendee {index + 1}
                          </span>
                          <input
                            className={inputClass}
                            value={guest.name}
                            onChange={(change) => updateGuest(index, { name: change.target.value })}
                            placeholder="Guest name"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (allowsIv) updateGuest(index, { iv: !guest.iv });
                          }}
                          disabled={!allowsIv}
                          className={`min-h-[52px] self-end rounded-2xl border px-4 font-body text-xs font-bold uppercase transition ${
                            guest.iv
                              ? 'border-emerald-200/24 bg-emerald-200/10 text-emerald-100'
                              : 'border-foreground/[0.12] bg-foreground/[0.045] text-foreground/58'
                          }`}
                        >
                          {requestOnly ? 'Request to join' : guest.iv ? 'IV appointment' : 'Experience only'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.035] p-4">
                  <p className="font-body text-xs font-semibold uppercase text-foreground/42">Tap 3 / {requestOnly ? 'Request' : 'Apple Pay'}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {requestOnly ? (
                      <div className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-foreground/[0.10] bg-background/52 p-4 sm:col-span-2">
                        <ShieldCheck className="h-5 w-5" />
                        <span>
                          <span className="block font-body text-sm font-semibold">Local request</span>
                          <span className="block font-body text-xs text-foreground/45">Stored only as mocked trip state in this browser</span>
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-foreground/[0.10] bg-background/52 p-4">
                          <Apple className="h-5 w-5" />
                          <span>
                            <span className="block font-body text-sm font-semibold">Apple Pay</span>
                            <span className="block font-body text-xs text-foreground/45">Mocked for local preview</span>
                          </span>
                        </div>
                        <div className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-foreground/[0.10] bg-background/52 p-4">
                          <CreditCard className="h-5 w-5" />
                          <span>
                            <span className="block font-body text-sm font-semibold">Stripe hosted</span>
                            <span className="block font-body text-xs text-foreground/45">Production path only</span>
                          </span>
                        </div>
                      </>
                    )}
                  </div>
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
            <MiniSummary event={event} tier={tier} party={party} />
            <div className="mt-4 rounded-[1.35rem] border border-foreground/[0.10] bg-background/62 p-4 backdrop-blur-2xl">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-200" />
                <p className="font-body text-sm leading-relaxed text-foreground/62">
                  {requestOnly ? 'This preview stores a mocked request record only. No live lead or payment service is called.' : 'Health content stays out of this preview. The trip page stores only status labels and mocked QR data.'}
                </p>
              </div>
              <PremiumButton
                as="button"
                type="button"
                onClick={confirmReserve}
                wrapperClassName="mt-4 w-full"
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-xs font-black uppercase text-background transition hover:bg-foreground/90"
              >
                {requestOnly ? 'Submit request' : 'Confirm reserve'} <Check className="h-4 w-4" strokeWidth={2} />
              </PremiumButton>
            </div>
          </motion.aside>
        </section>
      </main>

      <Footer />
    </div>
  );
}
