import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Search } from 'lucide-react';
import { EASE_OUT_EXPO } from '@/lib/motion';

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
    q: "Is IV therapy often used around hangovers or fatigue?",
    a: "IV fluids and electrolytes are commonly used to address dehydration, and B-complex and magnesium are popular nutrients in this context. Individual experiences vary — this is educational information, not medical advice. Your clinician will help you decide if a session is appropriate for you."
  },
  {
    category: 'General',
    q: "Is IV therapy better than oral vitamins?",
    a: "IV therapy delivers nutrients directly to the bloodstream, bypassing digestion for up to 100% absorption compared to 10–20% from oral supplements."
  },
  {
    category: 'General',
    q: "How often should I get an IV?",
    a: "Frequency varies by goal. Weekly for chronic fatigue or performance maintenance, bi-weekly for athletes, or on-demand for travel and events."
  },
  {
    category: 'General',
    q: "What is NAD+ and why would I want it?",
    a: "NAD+ is a coenzyme essential for cellular energy production, DNA repair, and cognitive function. Levels decline with age. IV NAD+ replenishes them directly — supporting energy, mental clarity, and longevity."
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
    category: 'Membership',
    q: "What's included in each membership tier?",
    a: "Tiers include monthly IV drips and IM injections ranging from 1–4 treatments per month, depending on the plan. All members get 20% off à la carte services, priority scheduling, and access to exclusive member events. Higher tiers include a dedicated care coordinator."
  },
  {
    category: 'Membership',
    q: "Can I upgrade or downgrade my membership?",
    a: "Yes. You may upgrade or downgrade your membership tier at any time. Changes take effect on your next billing cycle. Downgrades may affect your credit allowance; any excess credits will roll over to the next month."
  },
  {
    category: 'Membership',
    q: "What happens if I don't use my monthly credits?",
    a: "Monthly credits roll over indefinitely as long as your membership stays active. There's no penalty for not using them — they accumulate and are available whenever you need them."
  },
  {
    category: 'Membership',
    q: "Can I transfer my membership to someone else?",
    a: "Memberships are non-transferable and tied to your account. However, we offer corporate and family plans for multiple users — contact partnerships@avalonvitality.co for details."
  },
  {
    category: 'General',
    q: "What areas do you serve?",
    a: "We currently serve the entire San Francisco Bay Area, including SF, the Peninsula, East Bay, and Marin. Service area is expanding — join the waitlist for your city."
  },
  {
    category: 'General',
    q: "What is your cancellation and refund policy?",
    a: "Cancellations made 24 hours in advance receive a full refund. Cancellations within 24 hours are subject to a 50% service fee. No-shows forfeit the full appointment cost. Members may cancel up to 2 monthly credits per billing cycle without penalty."
  },
  {
    category: 'Safety',
    q: "Is IV therapy safe for everyone?",
    a: "IV therapy is safe for most people, but not suitable for those with certain medical conditions like heart failure, kidney disease, or severe allergies. Always disclose your full medical history during consultation."
  },
  {
    category: 'Safety',
    q: "What are the possible side effects?",
    a: "Side effects are rare and mild — minor bruising at the injection site, slight lightheadedness, or temporary headache. Serious complications are extremely uncommon with our licensed nurses and protocols."
  },
  {
    category: 'Safety',
    q: "Are the ingredients FDA-approved and sterile?",
    a: "Yes. All our ingredients are pharmaceutical-grade and meet strict FDA standards. We use sterile, single-use equipment and maintain rigorous infection control protocols for every session."
  },
  {
    category: 'General',
    q: "Are there payment plans available?",
    a: "We accept all major credit cards and offer membership plans with monthly installments. For large orders or corporate packages, contact us for custom payment arrangements."
  },
  {
    category: 'General',
    q: "Do you accept insurance?",
    a: "We do not bill insurance directly. Payment is required at the time of service. However, we provide itemized receipts that you can submit to your insurance provider for potential reimbursement if your policy covers IV wellness therapy."
  },
  {
    category: 'General',
    q: "Can I use FSA or HSA funds?",
    a: "Yes, most FSA and HSA accounts can be used for IV therapy treatments. Check with your account administrator for specifics, and we'll provide documentation to support your claim."
  },
];

const CATEGORIES = ['General', 'Treatments', 'Membership', 'Booking', 'Safety', 'Pricing', 'Insurance', 'Events', 'B2B', 'Coming Soon'];

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div
      className="border border-border/60 rounded-3xl bg-card overflow-hidden cursor-pointer"
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
            <div className="px-5 pb-3 border-t border-border/40">
               <p className="font-body text-sm text-foreground leading-relaxed pt-2">{faq.a}</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('General');
  const [openIndex, setOpenIndex] = useState(null);

  const filtered = faqs.filter(f => {
    const matchesCategory = f.category === activeCategory;
    const matchesSearch = !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleToggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="faq" className="py-4 md:py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide mb-4 md:mb-8 whitespace-nowrap"
        >
          FAQ
        </motion.h2>
      </div>
      <div className="max-w-3xl mx-auto">


        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="SEARCH"
            value={search}
            onChange={e => { setSearch(e.target.value); setOpenIndex(null); }}
            className="w-full bg-transparent border border-border/60 rounded-2xl pl-12 pr-6 py-2 font-body text-xs tracking-[0.2em] uppercase text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors"
          />
        </div>

        {/* Category filters */}
        <div className="mb-2">
          <p className="font-body text-[10px] tracking-[0.25em] text-foreground uppercase mb-1">Topic</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
                className={`font-body text-sm transition-colors ${
                  activeCategory === cat
                    ? 'text-foreground font-semibold'
                    : 'text-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ items */}
        <div className="space-y-1">
          {filtered.length === 0 ? (
            <p className="font-body text-sm text-foreground py-4 text-center">No results found.</p>
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