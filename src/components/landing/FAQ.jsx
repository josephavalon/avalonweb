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
    category: 'Safety',
    q: "Is Avalon safe for everyone?",
    a: "Avalon is safe for most people, but not suitable for those with certain medical conditions like heart failure, kidney disease, or severe allergies. Always disclose your full medical history during consultation with our clinical team."
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
    q: "Do you accept insurance?",
    a: "We do not bill insurance directly. Payment is required at the time of service. However, we provide itemized receipts that you can submit to your insurance provider for potential reimbursement if your policy covers IV wellness therapy."
  },
];

const CATEGORIES = ['All', 'General', 'Membership', 'Safety'];

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div
      className="border border-white/10 bg-white/[0.03] backdrop-blur-md rounded-3xl overflow-hidden cursor-pointer"
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
            <div className="px-5 pb-3/40">
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
          className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide mb-4 md:mb-8 md:whitespace-nowrap"
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
          <p className="font-body text-xs tracking-[0.25em] text-foreground uppercase mb-1">Topic</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
                className={`font-body text-sm transition-colors ${
                  activeCategory === cat
                    ? 'bg-foreground text-background font-semibold px-3 py-1 rounded-full'
                    : 'text-muted-foreground hover:text-foreground px-3 py-1 rounded-full'
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
                isOpen={openIndex === faq.q}
                onToggle={() => handleToggle(faq.q)}
              />
            ))
          )}
        </div>

      </div>
    </section>
  );
}