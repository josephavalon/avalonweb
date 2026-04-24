import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Clock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border py-6 md:py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Brand block — full-width on mobile, spans 2 cols on desktop */}
        <div className="mb-6 md:hidden">
          <div className="mb-2">
            <div className="font-heading text-2xl tracking-widest">AVALON</div>
            <div className="text-xs tracking-[0.3em] text-foreground -mt-1">VITALITY</div>
          </div>
          <p className="font-body text-xs text-foreground leading-snug text-left max-w-sm">
            Mobile therapy, delivered. Hydration, NAD+, and CBD infusions administered by licensed nurses throughout the San Francisco Bay Area.
          </p>
        </div>

        {/* Desktop grid: brand (2) + Services + Company + About = 5 cols
            Mobile: 3-col grid — Services | Company | About Us on one row */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-x-3 md:gap-x-4 gap-y-6 md:gap-8 mb-6 md:mb-8">
          <div className="hidden md:block md:col-span-2">
            <div className="mb-3">
              <div className="font-heading text-2xl tracking-widest">AVALON</div>
              <div className="text-xs tracking-[0.3em] text-foreground -mt-1">VITALITY</div>
            </div>
            <p className="font-body text-xs text-foreground leading-tight max-w-xs text-left">
              Mobile therapy, delivered. Hydration, NAD+, and CBD infusions administered by licensed nurses throughout the San Francisco Bay Area.
            </p>
          </div>

          <div>
            <p className="text-xs tracking-[0.3em] text-foreground uppercase font-body mb-3 md:mb-4">Services</p>
            <div className="space-y-2 md:space-y-2.5">
              {[
                { label: 'IV Vitamins', href: '/services/iv-vitamins' },
                { label: 'NAD+', href: '/services/nad' },
                { label: 'IV CBD', href: '/services/cbd' },
              ].map((l) => (
                <Link key={l.href} to={l.href} className="block text-xs text-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.3em] text-foreground uppercase font-body mb-3 md:mb-4">Company</p>
            <div className="space-y-2 md:space-y-2.5">
              <a href="/#membership" className="block text-xs text-accent hover:text-accent/80 transition-colors font-body uppercase tracking-wider">Membership</a>
              <Link to="/our-story" className="block text-xs text-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Our Story</Link>
              <Link to="/team" className="block text-xs text-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Our Team</Link>
              <a href="/#faq" className="block text-xs text-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">FAQ</a>
              <a href="/#events" className="block text-xs text-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Events</a>
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.3em] text-foreground uppercase font-body mb-3 md:mb-4">About Us</p>
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-foreground shrink-0" />
                <a href="mailto:support@avalonvitality.co" className="text-[11px] md:text-xs text-foreground hover:text-foreground transition-colors font-body whitespace-nowrap">support@avalonvitality.co</a>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 text-foreground shrink-0" />
                <a href="tel:+14159807708" className="text-xs md:text-xs text-foreground hover:text-foreground transition-colors font-body">(415) 980-7708</a>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-foreground shrink-0" />
                <span className="text-xs md:text-xs text-foreground font-body">Mon–Sun · 8AM–8PM</span>
              </div>
              <div className="flex items-start gap-2 md:gap-3">
                <span className="text-xs md:text-xs text-foreground font-body">San Francisco Bay Area</span>
              </div>
              {/* Social links hidden until real handles are live. */}
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <p className="font-body text-xs text-foreground">© 2026 Avalon Vitality. All rights reserved.</p>
            <p className="font-body text-xs text-foreground max-w-md text-center md:text-right">
              IV therapy supports wellness and is not intended to diagnose, treat, cure, or prevent any disease. Services administered by licensed registered nurses under physician supervision.
            </p>
          </div>
          <div className="pt-4 border-t border-border/50 mb-6">
            <p className="font-body text-xs text-foreground leading-relaxed text-center md:text-right">
              The services provided have not been evaluated by the Food and Drug Administration. These products are not intended to diagnose, treat, cure or prevent any disease. The material on this website is provided for informational purposes only and is not medical advice. Always consult your physician before beginning any treatment or therapy program. Any designations or references to therapies are for marketing purposes only and do not represent actual products.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}