import React from 'react';
import { useSeo } from '@/lib/seo';
import { ArrowRight, Home, Hotel, Building2, Phone, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import ConsumerFooter from '@/components/landing/ConsumerFooter';

const LOCATION_TYPES = [
  { label: 'Home', icon: Home },
  { label: 'Hotel', icon: Hotel },
  { label: 'Office', icon: Building2 },
];

// Legacy application links lead to the current Cognito request flow. This page
// collects no contact details and never claims that an unsent request arrived.
export default function Apply() {
  useSeo({
    title: 'Request a Visit — Avalon Vitality',
    description: 'Request mobile IV therapy at your home, hotel or office in the SF Bay Area. Our team confirms availability and clinical eligibility.',
    path: '/apply',
  });

  return (
    <div className="av-page-surface min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-28 md:px-8 md:pt-36">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="mb-4 font-body text-sm font-semibold uppercase tracking-[0.15em] text-foreground/65">Mobile IV therapy · SF Bay Area</p>
          <h1 className="font-heading text-5xl uppercase leading-none tracking-tight text-foreground md:text-7xl">Request a visit</h1>
          <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-foreground/70">
            Registered nurses come to your home, hotel or office. Tell us your preferred date and time in the visit request form, and our team will contact you to confirm availability and clinical eligibility.
          </p>
          <div className="mt-6 flex flex-wrap gap-3" aria-label="Visit locations">
            {LOCATION_TYPES.map(({ label, icon: Icon }) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-2 font-body text-sm text-foreground/75">
                <Icon aria-hidden="true" className="h-4 w-4" />{label}
              </span>
            ))}
          </div>
          <div className="mt-8 rounded-3xl border border-foreground/15 p-6 md:p-8">
            <h2 className="font-heading text-3xl uppercase text-foreground">Start your request</h2>
            <p className="mt-3 font-body text-sm leading-relaxed text-foreground/70">
              Continue to our visit request form to share your contact details. Your $50 deposit is credited toward your visit and refunded if you are ineligible. Our team confirms your appointment.
            </p>
            <Link
              to="/start?source=apply"
              className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full bg-foreground px-6 py-3 font-body text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground sm:w-auto"
            >
              Continue to visit request <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              <a href="tel:+14159807708" className="inline-flex min-h-[44px] items-center gap-2 font-body text-sm text-foreground underline underline-offset-4"><Phone aria-hidden="true" className="h-4 w-4" />Call (415) 980-7708</a>
              <a href="sms:+14159807708" className="inline-flex min-h-[44px] items-center gap-2 font-body text-sm text-foreground underline underline-offset-4"><MessageSquare aria-hidden="true" className="h-4 w-4" />Text our team</a>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/protocols" className="inline-flex min-h-[44px] items-center font-body text-sm text-foreground underline underline-offset-4">Explore therapies</Link>
            <Link to="/events" className="inline-flex min-h-[44px] items-center font-body text-sm text-foreground underline underline-offset-4">Planning a group or event?</Link>
            <Link to="/safety" className="inline-flex min-h-[44px] items-center font-body text-sm text-foreground underline underline-offset-4">Safety and clinical review</Link>
          </div>
          <p className="mt-6 font-body text-sm leading-relaxed text-foreground/65">
            Avalon provides wellness services, not emergency care. If you are experiencing a medical emergency, call 911.
          </p>
        </motion.section>
      </main>
      <ConsumerFooter />
    </div>
  );
}
