import { motion } from '@/components/ui/PageTransitionMotion';
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
          <p className="mb-4 font-body text-[10px] font-black uppercase tracking-[0.28em] text-foreground/56 md:text-xs">
            Launches
          </p>
          <h1 className="max-w-4xl font-heading text-[5.5rem] uppercase leading-[0.82] tracking-normal text-foreground md:text-[10rem]">
            COMING SOON!
          </h1>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}
