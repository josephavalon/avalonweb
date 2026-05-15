import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Clock, MapPin } from 'lucide-react';

const SERVICES = [
  { label: 'Request a Visit',  to: '/newsletter' },
  { label: 'Membership',       to: '/newsletter' },
  { label: 'Gift Cards',       to: '/newsletter' },
  { label: 'For Athletes',     to: '/newsletter' },
  { label: 'For Teams',        to: '/newsletter' },
  { label: 'For Events',       to: '/newsletter' },
  { label: 'Hotel Delivery',   to: '/newsletter' },
];

const COMPANY = [
  { label: 'Our Story',          to: '/newsletter' },
  { label: 'Our Team',           to: '/newsletter' },
  { label: 'Service Area',       to: '/newsletter' },
  { label: 'FAQ',                to: '/newsletter' },
  { label: 'Safety',             to: '/newsletter' },
  { label: 'Ingredients',        to: '/newsletter' },
  { label: 'Medical Direction',  to: '/newsletter' },
  { label: 'Press',              to: '/newsletter' },
];

const LEGAL = [
  { label: 'Terms of Service',  to: '/newsletter' },
  { label: 'Privacy Policy',    to: '/newsletter' },
  { label: 'More Disclosures',  to: '/newsletter' },
];

export default function Footer() {
  return (
    <footer className="pt-10 pb-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Brand */}
        <div className="mb-8">
          <div className="font-heading text-2xl tracking-widest text-foreground">AVALON</div>
          <div className="font-body text-xs tracking-[0.3em] text-foreground/60 -mt-1">VITALITY</div>
          <p className="font-body text-xs text-foreground/50 leading-relaxed mt-3 max-w-xs">
            Intelligent wellness protocols administered by California-licensed clinicians across the SF Bay Area.
          </p>
        </div>

        {/* Mobile: single column stacked. Desktop: 4-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          {/* Services */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Services</p>
            <div className="space-y-2.5">
              {SERVICES.map((l) => (
                <Link key={l.label} to={l.to} className="block font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Company</p>
            <div className="space-y-2.5">
              {COMPANY.map((l) => (
                <Link key={l.label} to={l.to} className="block font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Contact</p>
            <div className="space-y-3">
              <a href="mailto:support@avalonvitality.co" className="flex items-center gap-2 font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                support@avalonvitality.co
              </a>
              <a href="tel:+14159807708" className="flex items-center gap-2 font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                (415) 980-7708
              </a>
              <div className="flex items-center gap-2 font-body text-xs text-foreground/50">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Mon–Sun · 8AM–8PM
              </div>
              <div className="flex items-center gap-2 font-body text-xs text-foreground/50">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                San Francisco Bay Area · CA
              </div>
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Legal</p>
            <div className="space-y-2.5">
              {LEGAL.map((l) => (
                <Link key={l.label} to={l.to} className="block font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-foreground/[0.07] pt-6 space-y-3">
          <p className="font-body text-[10px] text-foreground/30 leading-relaxed">
            © 2026 Avalon Vitality. All rights reserved.
          </p>
          <p className="font-body text-[10px] text-foreground/30 leading-relaxed">
            Services provided exclusively to California residents physically located in California at the time of service.
          </p>
          <p className="font-body text-[10px] text-foreground/25 leading-relaxed">
            Avalon Vitality provides wellness and recovery support. This is not emergency medical care. If you are experiencing a medical emergency, call 911 immediately.
          </p>
          <p className="font-body text-[10px] text-foreground/25 leading-relaxed">
            These statements have not been evaluated by the FDA. Not intended to diagnose, treat, cure, or prevent any disease.
          </p>
        </div>

      </div>
    </footer>
  );
}
