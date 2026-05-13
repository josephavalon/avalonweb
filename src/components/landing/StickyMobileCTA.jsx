import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';

// Sticky bottom mobile bar — primary action always within reach.
// Hidden on desktop. Shows after 25vh of scroll.
export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.25);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      className={`md:hidden fixed bottom-0 inset-x-0 z-40 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
    >
      <div className="bg-background border-t border-foreground/[0.1] px-4 py-3 flex items-center gap-3">
        <a
          href="tel:+14159807708"
          aria-label="Call or text Avalon"
          className="flex items-center gap-2 px-4 py-3 rounded-full border border-white/20 bg-white/[0.04] text-foreground hover:text-accent hover:border-accent/50 transition-colors shrink-0"
        >
          <Phone className="w-4 h-4 shrink-0" strokeWidth={1.6} />
          <span className="font-body text-[10px] tracking-widest uppercase whitespace-nowrap">Call / Text</span>
        </a>
        <Link
          to="/apply"
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background font-body text-xs tracking-[0.3em] uppercase font-semibold rounded-full"
        >
          Start Now <span className="text-foreground/40">·</span> $150+
        </Link>
      </div>
    </div>
  );
}
