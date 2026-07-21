import { Link } from 'react-router-dom';
import { CircleDollarSign, MapPin, ShieldPlus, Zap } from 'lucide-react';
import AvalonStaticBackdrop from '@/components/AvalonStaticBackdrop';
import { ACUITY_URL, isCareHost } from '@/components/CareAcuityForward';

const BOOK_URL = '/book';
const PROOF_POINTS = [
  { label: 'Same Day', icon: Zap },
  { label: 'Registered Nurses', icon: ShieldPlus },
  { label: 'SF Bay Area', icon: MapPin },
  { label: 'No Hidden Fees', icon: CircleDollarSign },
];

function HeroLink({ to, external = false, className, children, ariaLabel }) {
  if (external) {
    return (
      <a href={to} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

export default function Hero() {
  const care = isCareHost();
  const bookHref = care ? ACUITY_URL : BOOK_URL;

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      {/* Use the original viewport-fixed, centered backdrop rather than a
          hero-specific positioned mark. */}
      <AvalonStaticBackdrop />

      <div className="home-hero__content">
        <p className="home-hero__eyebrow">Avalon Vitality</p>

        <h1 id="home-hero-title" className="home-hero__title">
          Mobile
          <br />
          Recovery
        </h1>

        <ul className="home-hero__proof" aria-label="Avalon service benefits">
          {PROOF_POINTS.map(({ label, icon: Icon }) => (
            <li key={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <div className="home-hero__actions">
          <HeroLink
            to={bookHref}
            external={care}
            className="home-hero__book"
            ariaLabel="Book mobile recovery"
          >
            <span>Book Now</span>
          </HeroLink>

          <div className="home-hero__secondary-actions">
            <Link to="/protocols" className="home-hero__text-link">
              <span>View Menu</span>
            </Link>
            <Link to="/events" className="home-hero__text-link">
              <span>Private Events</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
