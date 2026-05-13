import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

export default function NotFound() {
  useSeo({
    title: '404 — Avalon Vitality',
    description: 'Page not found.',
    path: '/404',
  });

  return (
    <div className="bg-background min-h-screen w-full flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-5 py-24">
        <div className="text-center max-w-lg mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-4"
          >
            Error
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.06 }}
            className="font-heading text-[22vw] md:text-[10rem] text-foreground leading-none tracking-wide mb-6"
          >
            404
          </motion.h1>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
            className="h-px w-12 bg-foreground/20 mx-auto mb-8 origin-left"
          />

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.26 }}
            className="font-body text-sm md:text-base text-foreground/60 leading-relaxed mb-10"
          >
            This page doesn't exist. Your recovery still can.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.34 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              to="/"
              className="inline-flex items-center justify-center px-7 py-3 rounded-xl border border-foreground/20 font-body text-xs tracking-[0.2em] uppercase text-foreground/70 hover:border-foreground/50 hover:text-foreground transition-all duration-200 w-full sm:w-auto"
            >
              Back to Home
            </Link>
            <Link
              to="/store"
              className="inline-flex items-center justify-center px-7 py-3 rounded-xl bg-accent text-background font-body text-xs tracking-[0.2em] uppercase hover:bg-accent/90 transition-colors duration-200 w-full sm:w-auto"
            >
              Book a Session
            </Link>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
