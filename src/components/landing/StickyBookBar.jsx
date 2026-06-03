import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight } from 'lucide-react';

import { EASE, premiumTap } from '@/lib/motion';

const BOOK_URL = '/book';

export default function StickyBookBar() {
  return (
    <motion.div
      initial={false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.12, ease: EASE }}
      className="fixed inset-x-0 bottom-0 z-[70] md:hidden"
      aria-label="Quick booking bar"
    >
      <div className="relative isolate mx-2 mb-1 overflow-hidden rounded-[18px] border border-foreground/[0.12] bg-[hsl(var(--background)/0.86)] p-1.5 shadow-[0_12px_34px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
        <div className="absolute inset-0 -z-10 bg-[hsl(var(--background))]" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white/[0.14] via-white/[0.06] to-foreground/[0.05]" aria-hidden="true" />
        <motion.div whileTap={premiumTap}>
          <Link
            to={BOOK_URL}
            className="group flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[15px] bg-foreground px-4 py-2 font-body text-[11px] font-black uppercase tracking-[0.16em] text-background transition-colors duration-base ease-editorial hover:bg-foreground/85"
          >
            Book
            <ArrowRight className="h-4 w-4 transition-transform duration-base ease-editorial group-hover:translate-x-0.5" strokeWidth={2.35} />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
