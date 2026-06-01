import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PremiumButton from '@/components/ui/PremiumButton';
import { useSeo } from '@/lib/seo';
import { EASE } from '@/lib/motion';

const launchCards = ['Venues', 'Hotels', 'Offices', 'Private Groups'];

export default function Events() {
  useSeo({
    title: 'Launches Coming Soon — Avalon Vitality',
    description: 'Avalon launch activations are coming soon. Book mobile recovery now or contact Avalon for group recovery planning.',
    path: '/launches',
  });

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 pb-20 pt-28 md:px-8 md:pt-32">
        <motion.section
          initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: EASE }}
          className="relative overflow-hidden rounded-[1.7rem] border border-foreground/12 bg-background/36 p-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_34px_120px_hsl(var(--foreground)/0.11)] backdrop-blur-2xl md:rounded-[2rem] md:p-8"
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,hsl(var(--foreground)/0.12),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.025))]" />

          <div className="relative grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-end">
            <div>
              <h1 className="font-heading text-[4.7rem] uppercase leading-[0.84] tracking-normal text-foreground md:text-[8rem] lg:text-[10rem]">
                Coming<br />Soon
              </h1>
              <p className="mt-5 max-w-xl font-body text-2xl font-semibold leading-tight text-foreground/82 md:text-3xl">
                Group recovery launches are being built.
              </p>
            </div>

            <div id="inquiry" className="grid gap-2">
              {launchCards.map((label) => (
                <div
                  key={label}
                  className="flex min-h-[66px] items-center justify-between rounded-[1.15rem] border border-foreground/12 bg-background/42 px-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] backdrop-blur-xl md:min-h-[74px]"
                >
                  <span className="font-heading text-[2rem] uppercase leading-none tracking-normal text-foreground md:text-[2.45rem]">
                    {label}
                  </span>
                  <ArrowRight className="h-5 w-5 text-foreground/60" strokeWidth={2.3} />
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-8 grid gap-2 md:grid-cols-2">
            <PremiumButton
              as={Link}
              to="/book"
              className="inline-flex min-h-[62px] items-center justify-center gap-2 rounded-full bg-foreground px-6 font-body text-xs font-black uppercase tracking-[0.16em] text-background"
            >
              Book A Visit <ArrowRight className="h-4 w-4" strokeWidth={2.3} />
            </PremiumButton>
            <a
              href="mailto:support@avalonvitality.co?subject=Launch%20Recovery%20Inquiry"
              className="inline-flex min-h-[62px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/42 px-6 font-body text-xs font-black uppercase tracking-[0.16em] text-foreground backdrop-blur-xl transition-colors hover:border-foreground/28 hover:bg-background/54"
            >
              Contact Avalon <Mail className="h-4 w-4" strokeWidth={2.3} />
            </a>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}
