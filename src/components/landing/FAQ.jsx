import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Search } from 'lucide-react';

const faqs = [
  {
    category: 'General',
    q: "What's in your IVs?",
    a: "Every IV is customized and made fresh on-site with medical-grade ingredients like B-complex vitamins, glutathione, magnesium, zinc, and electrolytes — tailored to your needs."
  },
  {
    category: 'General',
    q: "How long does an IV session take, and is it painful?",
    a: "Sessions last 30–60 minutes with minimal discomfort — just a quick pinch like a standard blood draw. Many clients love the relaxing, spa-like vibe of receiving treatment at home or their hotel."
  },
  {
    category: 'General',
    q: "Are there side effects, and is it safe?",
    a: "Side effects are rare and mild, such as minor bruising at the insertion site. IV therapy is safe for most people; always disclose any allergies or medical conditions when booking."
  },
  {
    category: 'General',
    q: "Can IV vitamins help with hangovers or fatigue?",
    a: "Absolutely. Our IVs are designed to support rapid rehydration and nutrient replenishment. Clients report feeling dramatically better within 30–60 minutes after a hangover or fatigue session."
  },
  {
    category: 'General',
    q: "Is IV therapy better than oral vitamins?",
    a: "IV therapy delivers nutrients directly to the bloodstream, bypassing digestion for up to 100% absorption compared to 10–20% from oral supplements."
  },
  {
    category: 'Treatments',
    q: "How often should I get an IV?",
    a: "Frequency varies by goal. Weekly for chronic fatigue or performance maintenance, bi-weekly for athletes, or on-demand for travel and events."
  },
  {
    category: 'Treatments',
    q: "What is NAD+ and why would I want it?",
    a: "NAD+ is a coenzyme essential for cellular energy production, DNA repair, and cognitive function. Levels decline with age. IV NAD+ replenishes them directly — supporting energy, mental clarity, and longevity."
  },
  {
    category: 'Treatments',
    q: "What are Exosomes?",
    a: "Exosomes are extracellular vesicles that carry biological signals between cells, supporting regeneration and repair. Our Exosome IVs range from 30B to 90B particles and represent the frontier of cellular regenerative therapy."
  },
  {
    category: 'Treatments',
    q: "What is IV CBD and does it contain THC?",
    a: "Our IV CBD is 100% THC-free isolate administered directly into the bloodstream for maximum bioavailability. It's used for anti-inflammatory effects, stress relief, and recovery support."
  },
  {
    category: 'Membership',
    q: "How does the membership work?",
    a: "Membership is by application only. Once approved, you lock in presale pricing with a 3-month minimum commitment. Credits roll over month-to-month as long as your membership stays active."
  },
  {
    category: 'Membership',
    q: "Can I pause or cancel my membership?",
    a: "After the 3-month minimum, you may cancel with 30 days notice. Pausing is available for up to 60 days per year for qualifying circumstances."
  },
  {
    category: 'Membership',
    q: "Do credits expire?",
    a: "Credits roll over indefinitely as long as your membership remains active. If you cancel, any unused credits expire at the end of your final billing cycle."
  },
  {
    category: 'Booking',
    q: "Do you offer mobile services for events?",
    a: "Yes — our teams arrive with everything needed for an on-site recovery lounge. We've done festivals, corporate retreats, film sets, and private parties. Contact us for group and event pricing."
  },
  {
    category: 'Booking',
    q: "How far in advance do I need to book?",
    a: "Same-day appointments are often available, though we recommend booking 24 hours ahead to guarantee your preferred time. Members receive priority scheduling."
  },
  {
    category: 'Booking',
    q: "What areas do you serve?",
    a: "We currently serve the entire San Francisco Bay Area, including SF, the Peninsula, East Bay, and Marin. Service area is expanding — join the waitlist for your city."
  },
];

const CATEGORIES = ['All', 'General', 'Treatments', 'Membership', 'Booking'];

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div
      className="border border-border/60 rounded-2xl bg-card overflow-hidden cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between px-6 py-5 gap-4">
        <span className="font-body text-sm text-foreground">{faq.q}</span>
        <div className="shrink-0 w-6 h-6 flex items-center justify-center">
          {isOpen
            ? <Minus className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            : <Plus className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          }
        </div>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className="px-6 pb-5 border-t border-border/40">
              <p className="font-body text-sm text-muted-foreground leading-relaxed pt-4">{faq.a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [openIndex, setOpenIndex] = useState(null);

  const filtered = faqs.filter(f => {
    const matchesCategory = activeCategory === 'All' || f.category === activeCategory;
    const matchesSearch = !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleToggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="faq" className="py-12 md:py-16 px-4">
      <div className="max-w-3xl mx-auto">

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-heading text-6xl md:text-8xl text-foreground tracking-wide mb-8"
        >
          FAQ
        </motion.h2>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="SEARCH"
            value={search}
            onChange={e => { setSearch(e.target.value); setOpenIndex(null); }}
            className="w-full bg-transparent border border-border/60 rounded-full pl-12 pr-6 py-3 font-body text-xs tracking-[0.2em] uppercase text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors"
          />
        </div>

        {/* Category filters */}
        <div className="mb-6">
          <p className="font-body text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-2">Topic</p>
          <div className="flex flex-wrap gap-4">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
                className={`font-body text-sm transition-colors ${
                  activeCategory === cat
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ items */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground py-8 text-center">No results found.</p>
          ) : (
            filtered.map((faq, i) => (
              <FAQItem
                key={faq.q}
                faq={faq}
                isOpen={openIndex === i}
                onToggle={() => handleToggle(i)}
              />
            ))
          )}
        </div>

      </div>
    </section>
  );
}