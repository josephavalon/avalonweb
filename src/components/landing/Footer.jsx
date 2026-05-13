import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Clock, ChevronDown } from 'lucide-react';

const LEGAL = [
  { label: 'Terms of Service', to: '/terms-and-conditions' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'More Disclosures', to: '/notice-of-privacy-practices' },
];

const ABOUT = [
  { label: 'Our Story', to: '/our-story' },
  { label: 'Our Team', to: '/team' },
];

// Reusable inline expandable group used inside the Company column
function CollapsibleGroup({ label, items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-xs text-foreground font-body uppercase tracking-wider focus:outline-none"
      >
        <span className="flex items-center gap-1">
          {label}
          <ChevronDown
            className={`w-3.5 h-3.5 text-foreground/70 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.6}
          />
        </span>
      </button>

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? 'max-h-96 opacity-100 mt-2.5' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-2 md:space-y-2.5 pl-3 border-l border-white/10">
          {items.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="block text-[11px] md:text-xs text-foreground font-body uppercase tracking-wider"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="pt-6 pb-24 md:py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Brand block — full-width on mobile */}
        <div className="mb-6 md:hidden flex flex-col items-center text-center">
          <div className="mb-2">
            <div className="font-heading text-2xl tracking-widest">AVALON</div>
            <div className="text-xs tracking-[0.3em] text-foreground -mt-1">VITALITY</div>
          </div>
          <p className="font-body text-xs text-foreground leading-relaxed text-center max-w-sm">
            Intelligent protocols administered by California-licensed clinicians across the San Francisco Bay Area.
          </p>
        </div>

        {/* Desktop grid: brand (2) + Services + Company + About = 5 cols
            Mobile: 3-col grid — Services | Company | About Us */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-x-3 md:gap-x-4 gap-y-6 md:gap-8 mb-6 md:mb-8">
          <div className="hidden md:block md:col-span-2">
            <div className="mb-3">
              <div className="font-heading text-2xl tracking-widest">AVALON</div>
              <div className="text-xs tracking-[0.3em] text-foreground -mt-1">VITALITY</div>
            </div>
            <p className="font-body text-xs text-foreground leading-tight max-w-xs text-left">
              Intelligent protocols administered by California-licensed clinicians across the San Francisco Bay Area.
            </p>
          </div>

          <div>
            <p className="text-xs tracking-[0.3em] text-foreground uppercase font-body mb-3 md:mb-4">Services</p>
            <div className="space-y-2 md:space-y-2.5">
              {[
                { label: 'Request a Visit', href: '/store' },
                { label: 'Membership', href: '/membership' },
                { label: 'Gift Cards', href: '/gift' },
                { label: 'For Athletes', href: '/athlete' },
                { label: 'For Teams', href: '/corporate' },
                { label: 'For Events', href: '/events' },
                { label: 'Hotel Delivery', href: '/hotel' },
              ].map((l) => (
                <Link key={l.href} to={l.href} className="block text-xs text-foreground font-body uppercase tracking-wider">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.3em] text-foreground uppercase font-body mb-3 md:mb-4">Company</p>
            <div className="space-y-2 md:space-y-2.5">
              <CollapsibleGroup label="About Us" items={ABOUT} />
              <Link to="/service-area" className="block text-xs text-foreground font-body uppercase tracking-wider">Service Area</Link>
              <Link to="/faq" className="block text-xs text-foreground font-body uppercase tracking-wider">FAQ</Link>
              <Link to="/safety" className="block text-xs text-foreground font-body uppercase tracking-wider">Safety</Link>
              <Link to="/ingredients" className="block text-xs text-foreground font-body uppercase tracking-wider">Ingredients</Link>
              <Link to="/medical-direction" className="block text-xs text-foreground font-body uppercase tracking-wider">Medical Direction</Link>
              <Link to="/press" className="block text-xs text-foreground font-body uppercase tracking-wider">Press</Link>
              <CollapsibleGroup label="Legal" items={LEGAL} />
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.3em] text-foreground uppercase font-body mb-3 md:mb-4">Contact</p>
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-foreground shrink-0" />
                <a href="mailto:support@avalonvitality.co" className="text-[11px] md:text-xs text-foreground font-body whitespace-nowrap">support@avalonvitality.co</a>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 text-foreground shrink-0" />
                <a href="tel:+14159807708" className="text-xs text-foreground font-body">(415) 980-7708</a>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-foreground shrink-0" />
                <span className="text-xs text-foreground font-body">Mon–Sun · 8AM–8PM</span>
              </div>
              <div className="flex items-start gap-2 md:gap-3">
                <span className="text-xs text-foreground font-body">San Francisco Bay Area · CA</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <p className="font-body text-xs text-foreground">© 2026 Avalon Vitality All rights reserved.</p>
            <p className="font-body text-xs text-foreground max-w-md text-center md:text-right">
              Avalon services are provided exclusively to California residents physically located in California at the time of service.
            </p>
          </div>
          <div className="pt-4 mb-3">
            <p className="font-body text-xs text-foreground/80 leading-relaxed text-center md:text-right font-medium">
              Avalon Vitality provides wellness and recovery support. This is not emergency medical care. If you are experiencing a medical emergency, call 911 immediately.
            </p>
          </div>
          <div className="pt-2 mb-6">
            <p className="font-body text-xs text-foreground/70 leading-relaxed text-center md:text-right">
              Statements made by Avalon Vitality about its services and products have not been evaluated by the U.S. Food and Drug Administration. The Services are not intended to diagnose, treat, cure, or prevent any disease. Information provided is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment from your physician. Individual results vary. Always consult your physician before beginning any therapy.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
