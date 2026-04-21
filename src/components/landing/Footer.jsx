import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-border py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full border-2 border-foreground flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              </div>
              <div>
                <div className="font-heading text-lg tracking-widest">AVALON</div>
                <div className="text-[8px] tracking-[0.3em] text-muted-foreground -mt-0.5">VITALITY</div>
              </div>
            </div>
            <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-xs">
              Precision wellness delivered to you. IV therapy, NAD+, CBD, and cellular recovery — wherever you are in San Francisco.
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
              <a href="#membership" className="block text-xs text-accent hover:text-accent/80 transition-colors font-body uppercase tracking-wider">Presale Membership</a>
              <a href="#gift" className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Gift Certificates</a>
              <a href="#events" className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Events</a>
              <a href="#b2b" className="block text-xs text-muted-foreground hover:text-foreground transition-colors font-body uppercase tracking-wider">Corporate & B2B</a>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-muted-foreground">© 2026 Avalon Vitality. All rights reserved.</p>
          <p className="font-body text-[10px] text-muted-foreground/50 max-w-md text-center md:text-right">
            IV therapy supports wellness and is not intended to diagnose, treat, cure, or prevent any disease. Services administered by licensed registered nurses under physician supervision.
          </p>
        </div>
      </div>
    </footer>
  );
}