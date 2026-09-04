import React, { useId, useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Plus, Minus, Search } from 'lucide-react';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const FAQ_SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      {
        q: 'What is mobile IV therapy?',
        a: 'IV therapy delivers vitamins, minerals, and fluids directly into the bloodstream via a small catheter. A licensed nurse comes to your location and administers the IV in 30–90 minutes. No clinic visit required.',
      },
      {
        q: 'How does Avalon work?',
        a: 'Request a visit online and choose a treatment or ask our team for help. We confirm your location, preferred time, availability, and clinical eligibility before arranging a registered nurse visit to your home, office, or hotel.',
      },
      {
        q: 'What areas do you serve?',
        a: 'Avalon currently serves San Francisco, San Mateo, Santa Clara, Alameda, and Contra Costa counties. Check your ZIP or city on our service-area page, or contact our team to confirm your address and visit availability.',
      },
      {
        q: 'What are your hours?',
        a: 'Monday through Sunday, 8 AM to 8 PM.',
      },
      {
        q: 'How quickly can a nurse arrive?',
        a: 'Same-day visits depend on your location, nurse availability, and clinical eligibility. Send your preferred date and time with your request; our team confirms the arrival window before your visit.',
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
        a: 'NAD+ (nicotinamide adenine dinucleotide) is a coenzyme found in every cell of the body, associated with cellular energy metabolism. NAD+ IV timing varies by dose, with listed options taking up to 6 hours. Your care team confirms the expected duration and health screening before your visit.',
      },
      {
        q: 'What is glutathione?',
        a: 'Glutathione is a naturally occurring antioxidant produced by the body. IV glutathione is delivered as a push at the end of your session and is associated with skin clarity and antioxidant support.',
      },
      {
        q: 'Can I customize my IV therapy?',
        a: 'Yes. Every session can be enhanced with add-ons: extra fluids, high-dose Vitamin C, glutathione push, NAD+ (250mg), magnesium support, and more.',
      },
      {
        q: 'How long does a session take?',
        a: 'Hydration sessions run 30–45 minutes. Most IV therapies are 45–60 minutes. NAD+ IV timing varies by dose, with listed options taking up to 6 hours. Our team confirms the expected duration before your visit.',
      },
    ],
  },
  {
    title: 'Safety & Medical',
    items: [
      {
        q: 'Are your nurses licensed?',
        a: 'All Avalon nurses are California-licensed registered nurses with IV therapy certification and a minimum of two years clinical experience.',
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
        a: 'Standard IV sessions do not require a prior consultation. NAD+ sessions require a brief health screening completed at booking.',
      },
      {
        q: 'Is IV therapy safe?',
        a: 'IV therapy administered by licensed nurses under physician oversight is well-established. As with any medical procedure, there are potential risks. We review your health history before each session and our nurses are trained to identify and respond to adverse events.',
      },
    ],
  },
  {
    title: 'Requests & Booking',
    items: [
      {
        q: 'Are subscriptions available?',
        a: 'Online subscription enrollment is currently unavailable. Request an individual visit, or contact our team to discuss ongoing visits.',
      },
      {
        q: 'Does sending a request confirm my appointment?',
        a: 'No. Your date and time are preferences until our team confirms availability, your location, and clinical eligibility. We contact you to confirm the appointment details.',
      },
      {
        q: 'How does the deposit work?',
        a: 'The $50 deposit is credited toward your visit and refunded if you are not clinically eligible. You can pay after submitting your request or wait for our call. Payment alone does not confirm an appointment.',
      },
      {
        q: 'How do I request a visit?',
        a: 'Use avalonvitality.co/start to send your request and preferred date and time. Our team confirms availability and visit details. Service hours are daily, 8 AM–8 PM.',
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
  const id = useId();
  const triggerId = `${id}-question`;
  const panelId = `${id}-answer`;
  return (
    <div className="border border-white/20 bg-white/[0.03] rounded-3xl overflow-hidden">
      <h3>
        <button
          id={triggerId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center justify-between px-5 py-3 gap-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-foreground"
        >
          <span className="font-body text-sm text-foreground">{faq.q}</span>
          <span className="shrink-0 w-5 h-5 flex items-center justify-center" aria-hidden="true">
            {isOpen
              ? <Minus className="w-4 h-4 text-foreground" strokeWidth={1.5} />
              : <Plus className="w-4 h-4 text-foreground" strokeWidth={1.5} />
            }
          </span>
        </button>
      </h3>
      <SmoothDisclosure open={isOpen}>
        <div id={panelId} role="region" aria-labelledby={triggerId} className="px-5 pb-4">
          <p className="font-body text-sm text-foreground/70 leading-relaxed pt-2">{faq.a}</p>
        </div>
      </SmoothDisclosure>
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
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-heading text-display text-foreground tracking-wide mb-4 md:mb-8 md:whitespace-nowrap"
        >
          FAQ
        </motion.h1>
      </div>
      <div className="max-w-3xl mx-auto">

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground" strokeWidth={1.5} />
          <input
            type="text"
            aria-label="Search frequently asked questions"
            placeholder="SEARCH"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpenKey(null); }}
            className="min-h-10 w-full bg-transparent border border-border/60 rounded-2xl pl-12 pr-6 py-2 font-body text-xs tracking-[0.2em] uppercase text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors"
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
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="font-body text-[10px] tracking-[0.3em] uppercase text-accent mb-3"
                >
                  {section.title}
                </motion.h2>
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
