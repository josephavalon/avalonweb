import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Search } from 'lucide-react';
import { EASE_OUT_EXPO } from '@/lib/motion';

const FAQ_SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      {
        q: 'What is mobile IV therapy?',
        a: 'IV therapy delivers vitamins, minerals, and fluids directly into the bloodstream via a small catheter. A licensed nurse comes to your location and administers the drip in 30–90 minutes. No clinic visit required.',
      },
      {
        q: 'How does Avalon work?',
        a: 'Book online or through our app, choose your protocol, and we dispatch a licensed nurse to your home, office, or hotel. Sessions typically take 30–90 minutes depending on the drip.',
      },
      {
        q: 'What areas do you serve?',
        a: 'San Francisco and five surrounding Bay Area counties. Enter your address at checkout to confirm availability.',
      },
      {
        q: 'What are your hours?',
        a: 'Monday through Sunday, 8 AM to 8 PM.',
      },
      {
        q: 'How quickly can a nurse arrive?',
        a: 'Most sessions are available same-day. Members receive a 90-minute arrival window. Inner Circle and Elite members receive dedicated nurse priority scheduling.',
      },
    ],
  },
  {
    title: 'Treatments',
    items: [
      {
        q: "What's in a Myers' Cocktail?",
        a: "The Myers' Cocktail is a blend of magnesium, calcium, B vitamins (B1, B2, B3, B5, B6), vitamin C, and saline. It's one of the most studied IV formulations and has been used clinically for decades.",
      },
      {
        q: 'What is NAD+ and who is it for?',
        a: 'NAD+ (nicotinamide adenine dinucleotide) is a coenzyme found in every cell of the body, associated with cellular energy metabolism. NAD+ IV therapy is popular among individuals focused on longevity and performance. Sessions run 2–4 hours. A brief health screening is required.',
      },
      {
        q: 'What is glutathione?',
        a: 'Glutathione is a naturally occurring antioxidant produced by the body. IV glutathione is delivered as a push at the end of your session and is associated with skin clarity and antioxidant support.',
      },
      {
        q: 'Can I customize my drip?',
        a: 'Yes. Every session can be enhanced with add-ons: extra fluids, high-dose Vitamin C, glutathione push, NAD+ (250mg), magnesium boost, and more.',
      },
      {
        q: 'How long does a session take?',
        a: 'Hydration sessions run 30–45 minutes. Most drips are 45–60 minutes. NAD+ sessions are 2–4 hours. Your nurse will confirm timing when they arrive.',
      },
    ],
  },
  {
    title: 'Safety & Medical',
    items: [
      {
        q: 'Are your nurses licensed?',
        a: 'All Avalon nurses are California-licensed registered nurses (RNs) with IV therapy certification and a minimum of two years clinical experience.',
      },
      {
        q: 'Is there a medical director?',
        a: 'Yes. Avalon operates under the oversight of a California-licensed physician who reviews our protocols, establishes standing orders, and ensures all services meet clinical standards.',
      },
      {
        q: 'What if I have a reaction?',
        a: 'All Avalon nurses carry emergency supplies and are trained in adverse event response. Our medical director is available for clinical consultation during all service hours.',
      },
      {
        q: 'Do I need a consultation first?',
        a: 'Standard IV sessions do not require a prior consultation. NAD+, Exosomes, and CBD sessions require a brief health screening completed at booking.',
      },
      {
        q: 'Is IV therapy safe?',
        a: 'IV therapy administered by licensed nurses under physician oversight is well-established. As with any medical procedure, there are potential risks. We review your health history before each session and our nurses are trained to identify and respond to adverse events.',
      },
    ],
  },
  {
    title: 'Membership & Booking',
    items: [
      {
        q: 'How does the membership work?',
        a: 'Members pay a monthly fee and receive credits redeemable for IV sessions, plus a discount on all add-ons and additional sessions. Credits do not roll over.',
      },
      {
        q: 'Can I pause or cancel?',
        a: 'Memberships require a 3-month minimum commitment. After that, you can cancel anytime with 30 days notice. Pausing is available once per year for up to 60 days.',
      },
      {
        q: 'Can I share my membership?',
        a: 'Elite and Private Client members may designate one household partner to share their membership benefits.',
      },
      {
        q: "What's the commitment?",
        a: '3 months minimum, then month-to-month.',
      },
      {
        q: 'How do I book?',
        a: 'Book directly through the Avalon app or at avalonvitality.co/store. Same-day appointments are available 8 AM–8 PM.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'All major credit and debit cards. Apple Pay and Google Pay accepted. Cash-pay only — we do not bill insurance. HSA/FSA eligibility is under review.',
      },
      {
        q: 'What is your cancellation policy?',
        a: 'Cancel or reschedule up to 2 hours before your appointment at no charge. Late cancellations (under 2 hours) incur a $50 fee.',
      },
      {
        q: 'Do you accept insurance?',
        a: 'No. Avalon is cash-pay only. We do not bill insurance or Medicare/Medicaid. HSA/FSA eligibility for certain services is currently under review.',
      },
    ],
  },
];

// Flatten for search
const ALL_ITEMS = FAQ_SECTIONS.flatMap((s) => s.items.map((item) => ({ ...item, section: s.title })));

const EASE = [0.16, 1, 0.3, 1];

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div
      className="border border-white/20 bg-white/[0.03] backdrop-blur-md rounded-3xl overflow-hidden cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between px-5 py-3 gap-4">
        <span className="font-body text-sm text-foreground">{faq.q}</span>
        <div className="shrink-0 w-5 h-5 flex items-center justify-center">
          {isOpen
            ? <Minus className="w-4 h-4 text-foreground" strokeWidth={1.5} />
            : <Plus className="w-4 h-4 text-foreground" strokeWidth={1.5} />
          }
        </div>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
          >
            <div className="px-5 pb-4">
              <p className="font-body text-sm text-foreground/70 leading-relaxed pt-2">{faq.a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState(null);

  const handleToggle = (key) => setOpenKey(openKey === key ? null : key);

  const isSearching = search.trim().length > 0;
  const searchResults = isSearching
    ? ALL_ITEMS.filter(
        (f) =>
          f.q.toLowerCase().includes(search.toLowerCase()) ||
          f.a.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <section id="faq" className="py-4 md:py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide mb-4 md:mb-8 md:whitespace-nowrap"
        >
          FAQ
        </motion.h2>
      </div>
      <div className="max-w-3xl mx-auto">

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="SEARCH"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpenKey(null); }}
            className="w-full bg-transparent border border-border/60 rounded-2xl pl-12 pr-6 py-2 font-body text-xs tracking-[0.2em] uppercase text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors"
          />
        </div>

        {isSearching ? (
          <div className="space-y-1">
            {searchResults.length === 0 ? (
              <p className="font-body text-sm text-foreground/50 py-4 text-center">No results found.</p>
            ) : (
              searchResults.map((faq) => (
                <FAQItem
                  key={`${faq.section}-${faq.q}`}
                  faq={faq}
                  isOpen={openKey === `${faq.section}-${faq.q}`}
                  onToggle={() => handleToggle(`${faq.section}-${faq.q}`)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {FAQ_SECTIONS.map((section) => (
              <div key={section.title}>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="font-body text-[10px] tracking-[0.3em] uppercase text-accent mb-3"
                >
                  {section.title}
                </motion.p>
                <div className="space-y-1">
                  {section.items.map((faq) => {
                    const key = `${section.title}-${faq.q}`;
                    return (
                      <FAQItem
                        key={key}
                        faq={faq}
                        isOpen={openKey === key}
                        onToggle={() => handleToggle(key)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
