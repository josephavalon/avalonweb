import { useLayoutEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BriefcaseMedical, Calendar, ChevronDown, MapPin,
  ShieldCheck, Users, UsersRound,
} from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { useSeo } from '@/lib/seo';

const GUEST_RANGES = ['4 – 10', '11 – 25', '26 – 50', '51 – 100', '100+'];

const UPCOMING_EVENTS = [
  {
    name: 'Private Birthday Celebration',
    date: '2026-09-12T18:00:00-07:00',
    location: 'Los Angeles, CA',
    guests: 40,
    status: 'Confirmed',
    image: '/social/ig-5.jpg',
    imageAlt: 'Avalon nurse preparing a guest for wellness care at a private event',
  },
  {
    name: 'Brand Activation Event',
    date: '2026-09-26T17:00:00-07:00',
    location: 'Miami, FL',
    guests: 75,
    status: 'Pending',
    image: '/images/avalon-events-hero.jpg',
    imageAlt: 'Avalon nurse setting up IV hydration at an event',
  },
  {
    name: 'Film Production Shoot',
    date: '2026-10-10T08:00:00-07:00',
    location: 'Santa Barbara, CA',
    guests: 25,
    status: 'Confirmed',
    image: '/social/ig-3.jpg',
    imageAlt: 'Wellness production activation above a city',
  },
];

const PAST_EVENTS = [
  {
    name: 'Corporate Retreat',
    date: '2026-07-18T10:00:00-07:00',
    location: 'Napa, CA',
    guests: 60,
    status: 'Completed',
    image: '/social/ig-4.jpg',
    imageAlt: 'Avalon recovery lounge at an evening event',
  },
  {
    name: 'Product Launch Party',
    date: '2026-06-26T18:00:00-07:00',
    location: 'San Francisco, CA',
    guests: 120,
    status: 'Completed',
    image: '/social/ig-6.jpg',
    imageAlt: 'Avalon nurse welcoming guests at a waterfront event',
  },
  {
    name: 'Maxim Super Bowl Party',
    date: '2026-02-07T19:00:00-08:00',
    location: 'Santa Clara, CA',
    guests: 90,
    status: 'Completed',
    image: '/social/ig-5.jpg',
    imageAlt: 'Avalon nurse delivering wellness care at a private event',
  },
];

function formatEventDate(iso) {
  if (!iso) return 'Any date';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function listingDateParts(iso) {
  const date = new Date(iso);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.toLocaleDateString('en-US', { day: '2-digit' }),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

function EventList({ id, title, events, past = false }) {
  return (
    <section id={id} className="nd-events-list" aria-labelledby={`${id}-title`}>
      <div className="nd-events-list__heading">
        <h2 id={`${id}-title`} className="nd-events-list__title">{title}</h2>
        <a className="nd-events-list__view" href={`#${id}-items`}>
          View all <ArrowRight aria-hidden="true" />
        </a>
      </div>
      <div id={`${id}-items`} className="nd-events-list__cards">
        {events.map((event) => {
          const date = listingDateParts(event.date);
          return (
            <article key={`${event.name}-${event.date}`} className={`nd-events-list__card${past ? ' nd-events-list__card--past' : ''}`}>
              <img className="nd-events-list__image" src={event.image} alt={event.imageAlt} loading="lazy" />
              <time className="nd-events-list__date" dateTime={event.date}>
                <span>{date.month}</span>
                <strong>{date.day}</strong>
                <small>{date.weekday}</small>
              </time>
              <div className="nd-events-list__details">
                <h3 className="nd-events-list__name">{event.name}</h3>
                <p><MapPin aria-hidden="true" /> {event.location}</p>
                <p><Users aria-hidden="true" /> {event.guests} guests</p>
              </div>
              <span className={`nd-events-list__status nd-events-list__status--${event.status.toLowerCase()}`}>
                {event.status}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const EVENT_PROMISES = [
  {
    title: 'Experienced team',
    copy: 'Licensed professionals at your service.',
    icon: UsersRound,
  },
  {
    title: 'Customized care',
    copy: 'Tailored IV menus for your guests.',
    icon: BriefcaseMedical,
  },
  {
    title: 'Safe & reliable',
    copy: 'Hospital-grade supplies and protocols.',
    icon: ShieldCheck,
  },
];

function EventPromise({ title, copy, icon: Icon }) {
  return (
    <div className="nd-events-promise">
      <Icon aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function EventPlanner() {
  const [where, setWhere] = useState('');
  const [date, setDate] = useState('');
  const [guestRange, setGuestRange] = useState('');
  const [active, setActive] = useState('');
  const [stage, setStage] = useState('event');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const rows = [
    { key: 'where', label: 'Where', value: where || 'Anywhere', icon: MapPin },
    { key: 'when', label: 'When', value: formatEventDate(date), icon: Calendar },
    { key: 'guests', label: 'How many guests', value: guestRange || 'Any size', icon: Users },
  ];

  async function submit() {
    setError('');
    const contactName = name.trim();
    const contactEmail = email.trim();
    const contactPhone = phone.trim();

    if (!contactName) {
      setError('Add your name.');
      return;
    }
    if (!contactEmail && !contactPhone) {
      setError('Add an email or mobile number.');
      return;
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError('Check your email address.');
      return;
    }
    if (contactPhone && contactPhone.replace(/\D/g, '').length < 7) {
      setError('Check your mobile number.');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/events/host-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          where,
          date,
          guestRange,
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        throw new Error(body.error || 'Something went wrong — try again.');
      }
      setSent(true);
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong — try again.');
    } finally {
      setSending(false);
    }
  }

  const editor = {
    where: (
      <div className="nd-events-quote__editor">
        <label htmlFor="event-location">Where is your event?</label>
        <input
          id="event-location"
          autoFocus
          value={where}
          onChange={(event) => setWhere(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              setActive('');
            }
          }}
          placeholder="City, venue, or address"
          autoComplete="off"
        />
      </div>
    ),
    when: (
      <div className="nd-events-quote__editor">
        <label htmlFor="event-date">When is your event?</label>
        <input
          id="event-date"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setActive('');
          }}
        />
      </div>
    ),
    guests: (
      <div className="nd-events-quote__editor">
        <span>How many guests?</span>
        <div className="nd-events-quote__guest-options">
          {GUEST_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={guestRange === range}
              onClick={() => {
                setGuestRange(range);
                setActive('');
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
    ),
  };

  if (sent) {
    return (
      <div className="nd-events-quote nd-events-quote--success" role="status">
        <h2>Request received</h2>
        <p>We’ll follow up within 24 hours using the contact details you provided.</p>
      </div>
    );
  }

  return (
    <form
      id="event-quote"
      className={`nd-events-quote${stage === 'contact' ? ' nd-events-quote--contact' : ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (stage === 'event') {
          setActive('');
          setStage('contact');
          return;
        }
        submit();
      }}
      noValidate
    >
      {stage === 'event' ? (
        <>
          <h2>Get a quote</h2>
          <div className="nd-events-quote__rows">
            {rows.map(({ key, label, value, icon: Icon }) => (
              <div key={key}>
                <button
                  type="button"
                  className="nd-events-quote__row"
                  aria-expanded={active === key}
                  onClick={() => setActive(active === key ? '' : key)}
                >
                  <span className="nd-events-quote__row-label">
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </span>
                  <span className="nd-events-quote__row-value">
                    {value}
                    <ChevronDown aria-hidden="true" />
                  </span>
                </button>
                {active === key ? editor[key] : null}
              </div>
            ))}
          </div>
          <button type="submit" className="nd-events-quote__submit">
            Get a quote <ArrowRight aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="nd-events-quote__back"
            onClick={() => {
              setError('');
              setStage('event');
            }}
          >
            <ArrowLeft aria-hidden="true" /> Event details
          </button>
          <h2>Your details</h2>
          <div className="nd-events-quote__contact-fields">
            <label>
              <span>Name</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              <span>Mobile</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
            </label>
          </div>
          <p className="nd-events-quote__requirement">Name required. Add email or mobile.</p>
          {error ? <p className="nd-events-quote__error" role="alert">{error}</p> : null}
          <button type="submit" className="nd-events-quote__submit" disabled={sending}>
            {sending ? 'Sending…' : 'Request quote'} <ArrowRight aria-hidden="true" />
          </button>
        </>
      )}
      <p className="nd-events-quote__privacy">
        Transparent pricing. Nothing medical is asked here.
      </p>
    </form>
  );
}

export default function Events() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useSeo({
    title: 'Wellness For Your Event — Avalon Vitality',
    description: 'On-site IV therapy for parties, productions and private events. Request a transparent quote from Avalon Vitality.',
    path: '/events',
  });

  return (
    <div className="nd-events-page nd-events-page--editorial">
      <main>
        <div className="nd-events-shell">
          <section className="nd-events-hero" aria-labelledby="events-title">
            <div className="nd-events-hero__content">
            <div className="nd-events-hero__intro">
              <h1 id="events-title">Build your event</h1>
              <p>On-site IV therapy for parties, productions and private events.</p>
            </div>
              <div className="nd-events-promises">
                {EVENT_PROMISES.map((promise) => <EventPromise key={promise.title} {...promise} />)}
              </div>
            </div>
            <img
              className="nd-events-hero__image"
              src="/images/events/avalon-events-editorial-hero.jpg"
              alt="Elegant private event with an Avalon hydration setup"
            />
          </section>

          <EventPlanner />

          <div className="nd-events-listings">
            <EventList id="upcoming-events" title="Upcoming Events" events={UPCOMING_EVENTS} />
            <EventList id="past-events" title="Past Events" events={PAST_EVENTS} past />
          </div>
        </div>
      </main>

      <ConsumerFooter />
    </div>
  );
}
