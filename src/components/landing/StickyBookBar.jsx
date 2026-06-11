import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight } from 'lucide-react';

import { EASE, premiumTap } from '@/lib/motion';

const BOOK_URL = '/book';

export default function StickyBookBar() {
  const { pathname } = useLocation();
  const [heroActionVisible, setHeroActionVisible] = useState(false);
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
      setHeroActionVisible(false);
      return undefined;
    }

    const targets = Array.from(document.querySelectorAll('.av-hero-action'));
    if (!targets.length) {
      setHeroActionVisible(false);
      return undefined;
    }

    const visibleTargets = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleTargets.add(entry.target);
        } else {
          visibleTargets.delete(entry.target);
        }
      });
      setHeroActionVisible(visibleTargets.size > 0);
    }, { threshold: 0.01 });

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [hidden, pathname]);

  if (hidden || heroActionVisible) return null;

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
