import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, Phone, Clock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-5 gap-10 mb-12">
          <div className="md:col-span-2">
            <div className="mb-3">
              <div className="font-heading text-2xl tracking-widest">AVALON</div>
              <div className="text-[9px] tracking-[0.3em] text-muted-foreground -mt-1">VITALITY</div>
            </div>
            <p className="font-body text-xs text-muted-foreground leading-tight max-w-xs">
              Mobile wellness optimization, delivered. IV hydration, NAD+, CBD, and advanced recovery services—available throughout the San Francisco Bay Area.
            </p>
          </div>

          <div>
            <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase font-body mb-4">Services</p>
            <div className="space-y-2.5">
              {[
                { label: 'IV Vitamins', href: '/services/iv-vitamins' },
                { label: 'NAD+', href: '/services/nad' },
                { label: 'IV CBD', href: '/services/cbd' },
                { label: 'Exosomes', href: '/services/exosomes' },
              ].map((l) => (
                <Link key={l.href} to={l.href} className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase font-body mb-4">Company</p>
            <div className="space-y-2.5">
              <Link to="/our-story" className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Our Story</Link>
              <a href="/#faq" className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">FAQ</a>
              <a href="#membership" className="block text-xs text-accent hover:text-accent/80 transition-colors font-body uppercase tracking-wider">Membership</a>
              <a href="#gift" className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Gift Certificates</a>
              <a href="#events" className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Events</a>
              <a href="#b2b" className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Corporate & B2B</a>
              <Link to="/careers" className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Careers</Link>
            </div>
          </div>

          <div>
            <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase font-body mb-4">About Us</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href="mailto:support@avalonvitality.co" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-body">support@avalonvitality.co</a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href="tel:+14159807708" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-body">(415) 980-7708</a>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground font-body">Mon-Sun: 8AM-8PM</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <p className="font-body text-xs text-muted-foreground">© 2026 Avalon Vitality. All rights reserved.</p>
            <p className="font-body text-[10px] text-muted-foreground/50 max-w-md text-center md:text-right">
              IV therapy supports wellness and is not intended to diagnose, treat, cure, or prevent any disease. Services administered by licensed registered nurses under physician supervision.
            </p>
          </div>
          <div className="pt-6 border-t border-border/50">
            <p className="font-body text-[9px] text-muted-foreground/40 leading-relaxed">
              The services provided have not been evaluated by the Food and Drug Administration. These products are not intended to diagnose, treat, cure or prevent any disease. The material on this website is provided for informational purposes only and is not medical advice. Always consult your physician before beginning any treatment or therapy program. Any designations or references to therapies are for marketing purposes only and do not represent actual products.
            </p>
          </div>
          <div className="flex items-center justify-center md:justify-end gap-6">
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-accent transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.514l-5.106-6.694-5.934 6.694H2.88l7.644-8.769-8.169-10.731h6.332l4.432 5.89 5.064-5.89zM16.736 20.033h1.832L6.363 4.125H4.447l12.289 15.908z"/>
              </svg>
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-accent transition-colors">
              <Facebook className="w-6 h-6" fill="currentColor" />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-accent transition-colors">
              <Instagram className="w-6 h-6" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}