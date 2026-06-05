import { Link, useLocation } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight } from 'lucide-react';

import { EASE, premiumTap } from '@/lib/motion';

const BOOK_URL = '/book';

export default function StickyBookBar() {
  const { pathname } = useLocation();
  const hidden = pathname === '/book' ||
    pathname.startsWith('/book/') ||
    pathname.startsWith('/protocols') ||
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

  if (hidden) return null;

  return (
    <motion.div
      initial={false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.12, ease: EASE }}
      className="fixed inset-x-0 bottom-0 z-[70] md:hidden"
      aria-label="Quick booking bar"
    >
      <div className="relative isolate mx-2 mb-1 overflow-hidden rounded-[18px]">
        <motion.div whileTap={premiumTap}>
          <Link
            to={BOOK_URL}
            className="av-glass-widget group flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[15px] border px-4 py-2 font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground/66 transition-colors duration-base ease-editorial hover:text-foreground"
          >
            Book
            <ArrowRight className="h-4 w-4 transition-transform duration-base ease-editorial group-hover:translate-x-0.5" strokeWidth={2.35} />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
