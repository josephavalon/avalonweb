import { useLayoutEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Calendar, ChevronDown, MapPin, Users,
} from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { useSeo } from '@/lib/seo';

const GUEST_RANGES = ['4 – 10', '11 – 25', '26 – 50', '51 – 100', '100+'];

function formatEventDate(iso) {
  if (!iso) return 'Any date';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
        <section className="nd-events-hero" aria-labelledby="events-title">
          <div className="nd-events-hero__content">
            <div className="nd-events-hero__intro">
              <h1 id="events-title">Build your event</h1>
              <p>On-site IV therapy for parties, productions and private events.</p>
            </div>

            <EventPlanner />

          </div>
        </section>

      </main>

      <ConsumerFooter />
    </div>
  );
}
