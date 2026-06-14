import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight } from 'lucide-react';

import { EASE, premiumTap } from '@/lib/motion';

const BOOK_URL = '/book';

export default function StickyBookBar() {
  const { pathname } = useLocation();
  // The bar is revealed only once the hero's white Book button has scrolled
  // ABOVE the top of the viewport (i.e. you've scrolled past it). It must stay
  // hidden on first paint and while the button is still below the fold — the
  // common mobile case where the hero is tall and the button starts off-screen
  // below. Default hidden so there is no flash before the observer fires.
  const [scrolledPast, setScrolledPast] = useState(false);
  const hidden = pathname === '/book' ||
    pathname.startsWith('/book/') ||
    pathname.startsWith('/protocols') ||
    pathname.startsWith('/subscription') ||
    pathname.startsWith('/custom') ||
    pathname.startsWith('/store') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/launches') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/booking/confirmation') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/provider') ||
    pathname.startsWith('/members') ||
    pathname.startsWith('/login');

  useEffect(() => {
    if (hidden || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setScrolledPast(false);
      return undefined;
    }

    // Gate on the hero's white primary Book button. The bar reveals only when
    // that button has scrolled fully ABOVE the viewport top (boundingClientRect
    // top < 0). While the button is on-screen OR still below the fold, the bar
    // stays hidden — matching the intent that it replaces the white button only
    // after you scroll past it. IntersectionObserver fires once on observe with
    // the initial state, so first paint resolves correctly with no flash.
    const target = document.querySelector('.av-hero-action-primary');
    if (!target) {
      setScrolledPast(false);
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      setScrolledPast(past);
    }, { threshold: 0 });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hidden, pathname]);

  if (hidden || !scrolledPast) return null;

  return (
    <motion.div
      initial={false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.12, ease: EASE }}
      className="fixed inset-x-0 z-[70] md:hidden"
      style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
      aria-label="Quick booking bar"
    >
      <div className="relative isolate mx-3 rounded-[16px]">
        <motion.div className="relative z-0" whileTap={premiumTap}>
          <Link
            to={BOOK_URL}
            className="av-glass-widget group flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] border px-12 py-1.5 font-body text-[10px] font-black uppercase tracking-[0.16em] text-foreground/72 transition-colors duration-base ease-editorial hover:text-foreground"
          >
            Book
            <ArrowRight className="h-4 w-4 transition-transform duration-base ease-editorial group-hover:translate-x-0.5" strokeWidth={2.35} />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
