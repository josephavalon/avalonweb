import React from 'react';
import { Link } from 'react-router-dom';
import { Droplets } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-3">
            <Droplets className="w-5 h-5 text-primary" />
            <span className="font-heading text-lg tracking-widest text-foreground">THE INFUSION</span>
          </div>

          <div className="flex flex-wrap gap-8">
            <a href="#membership" className="text-xs tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors font-body">
              MEMBERSHIP
            </a>
            <Link to="/about" className="text-xs tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors font-body">
              ABOUT
            </Link>
            <a href="#faq" className="text-xs tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors font-body">
              FAQS
            </a>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-muted-foreground">
            © 2026 The Infusion. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </a>
          </div>
        </div>

        <p className="font-body text-[10px] text-muted-foreground/50 mt-8 leading-relaxed max-w-2xl">
          The Infusion provides IV hydration and vitamin therapy services administered by licensed registered nurses. Our services are not intended to diagnose, treat, cure, or prevent any disease. All treatments are reviewed by a licensed physician. Individual results may vary.
        </p>
      </div>
    </footer>
  );
}