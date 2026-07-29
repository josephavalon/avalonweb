import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Mail, MapPin, Phone } from 'lucide-react';
import {
  FaFacebookF,
  FaGoogle,
  FaInstagram,
  FaYelp,
} from 'react-icons/fa6';
import AvalonMark from '@/components/AvalonMark';

const GROUPS = [
  {
    label: 'Services',
    links: [
      { label: 'Start', to: '/start' },
      { label: 'Menu', to: '/protocols' },
      { label: 'Events', to: '/events' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'Story', to: '/our-story' },
      { label: 'Safety', to: '/safety' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Support', to: '/support' },
    ],
  },
  {
    label: 'Legal',
    links: [
      { label: 'Terms', to: '/terms-of-service' },
      { label: 'Privacy', to: '/privacy-policy' },
      { label: 'HIPAA Notice', to: '/notice-of-privacy-practices' },
      { label: 'Waiver', to: '/waiver' },
    ],
  },
];

const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/avalon_vitality/', icon: FaInstagram },
  { label: 'Facebook', href: 'https://www.facebook.com/avalon.vitality/', icon: FaFacebookF },
  { label: 'Google', href: 'https://www.google.com/maps/search/?api=1&query=Avalon+Vitality+San+Francisco', icon: FaGoogle },
  { label: 'Yelp', href: 'https://www.yelp.com/biz/avalon-vitality-san-francisco', icon: FaYelp },
];

function FooterLink({ link }) {
  return <Link to={link.to}>{link.label}</Link>;
}

export default function ConsumerFooter() {
  return (
    <footer className="nd-footer" aria-label="Avalon Vitality">
      <div className="nd-footer__main">
        <div className="nd-footer__intro">
          <Link to="/" className="nd-footer__brand" aria-label="Avalon Vitality home">
            <AvalonMark className="nd-footer__brand-mark" />
            <span>
              <strong>Avalon</strong>
              <small>Vitality</small>
            </span>
          </Link>
        </div>

        {GROUPS.map((group) => (
          <Fragment key={group.label}>
            <section
              className="nd-footer__group nd-footer__group--desktop"
              aria-labelledby={`footer-${group.label.toLowerCase()}-desktop`}
            >
              <h2 id={`footer-${group.label.toLowerCase()}-desktop`}>{group.label}</h2>
              <nav aria-label={group.label}>
                {group.links.map((link) => <FooterLink key={link.label} link={link} />)}
              </nav>
            </section>

            <details className="nd-footer__group nd-footer__group--mobile">
              <summary>
                <span>{group.label}</span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <nav aria-label={group.label}>
                {group.links.map((link) => <FooterLink key={link.label} link={link} />)}
              </nav>
            </details>
          </Fragment>
        ))}

        <section className="nd-footer__group nd-footer__contact" aria-labelledby="footer-contact">
          <h2 id="footer-contact">Contact</h2>
          <a href="mailto:support@avalonvitality.co">
            <Mail aria-hidden="true" />
            <span>support@avalonvitality.co</span>
          </a>
          <a href="tel:+14159807708">
            <Phone aria-hidden="true" />
            <span>(415) 980-7708</span>
          </a>
          <p><MapPin aria-hidden="true" /> SF Bay Area</p>
          <p>Daily · 8AM–8PM</p>
          <div className="nd-footer__social" aria-label="Avalon on social media">
            {SOCIALS.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                title={label}
              >
                <Icon aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      </div>

      <aside className="nd-footer__notice" aria-labelledby="footer-wellness-notice">
        <h2 id="footer-wellness-notice" className="sr-only">Wellness notice</h2>
        <p className="nd-footer__copyright">© 2026 Avalon Vitality. All rights reserved.</p>
        <p>
          General wellness services only. Not emergency care or a substitute for medical advice,
          diagnosis, or treatment. Services are not intended to diagnose, treat, cure, or prevent
          disease. Results vary.
        </p>
      </aside>
    </footer>
  );
}
