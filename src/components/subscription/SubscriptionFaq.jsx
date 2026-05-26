import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Reveal } from '@/components/ui/Reveal';

const EASE = [0.16, 1, 0.3, 1];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const faqs = [
  {
    q: 'Do unused credits expire?',
    a: 'Up to 1 unused credit rolls over per billing month. Rolled-over credits never expire — use them anytime.',
  },
  {
    q: 'Can I share credits with someone else?',
    a: 'Credits are non-transferable and tied to your plan account. Each guest must book under their own profile.',
  },
  {
    q: 'What counts as one credit?',
    a: 'One credit equals one standard IV session. IM shots, additional add-ons, and specialty drips may be purchased separately at your plan discount.',
  },
  {
    q: 'How do I pause my subscription?',
    a: 'Log in to your client portal and select Pause. Your billing cycle will pause immediately. Credits already issued remain valid.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Cancel anytime with 7 days notice before your next billing date. No cancellation fees. Sessions already booked are honored through the end of your paid period.',
  },
];

export default function SubscriptionFaq() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
      <div className="max-w-5xl mx-auto">
        <motion.p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3" {...fadeUp}>
          Questions
        </motion.p>
        <motion.h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-12" {...fadeUp}>
          Subscription FAQ
        </motion.h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={faq.q}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] overflow-hidden"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
            >
              <button
                className="w-full min-h-[64px] flex items-center justify-between p-6 text-left"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-body text-sm font-semibold text-foreground pr-4">{faq.q}</span>
                <span className="text-foreground/40 flex-shrink-0 text-lg leading-none">
                  {openFaq === i ? '-' : '+'}
                </span>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-6">
                  <p className="font-body text-sm text-foreground/60">{faq.a}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
