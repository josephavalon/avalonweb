import { motion } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE } from '@/lib/motion';

export default function Events() {
  useSeo({
    title: 'Launches Coming Soon — Avalon Vitality',
    description: 'Avalon launches are coming soon.',
    path: '/launches',
  });

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-6xl items-center px-4 pb-24 pt-28 md:px-8 md:pt-32">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="w-full"
        >
          <h1 className="max-w-4xl font-heading text-[5.5rem] leading-[0.82] tracking-normal text-foreground md:text-[10rem]">
            Coming soon
          </h1>
          <p className="mt-6 max-w-xl font-body text-base leading-relaxed text-foreground/60 md:text-lg">
            Avalon launches, pop-ups, and events are coming to the Bay Area. Book a mobile IV visit in the meantime — we come to you.
          </p>
          <Link
            to="/book"
            className="mt-8 inline-flex min-h-[3rem] items-center gap-2 rounded-full bg-foreground px-7 font-body text-xs font-black uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-90"
          >
            Book a visit <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}
