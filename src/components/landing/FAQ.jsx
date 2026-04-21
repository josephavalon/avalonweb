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
    category: 'Treatments',
    q: "Which IV treatment is best for athletic recovery?",
    a: "Our Event Recovery IV is specifically designed for athletes post-workout. It includes anti-inflammatory agents, amino acids, electrolytes, and hydration. Many athletes also pair it with NAD+ or Exosomes for deeper cellular repair."
  },
  {
    category: 'Treatments',
    q: "Can I combine multiple IV treatments?",
    a: "Yes. Many clients enhance their sessions by stacking treatments. For example, combining Myers' Cocktail with NAD+ or CBD with amino acid boosters. Our clinical team can recommend safe and effective combinations based on your goals."
  },
  {
    category: 'Treatments',
    q: "How quickly will I feel the effects?",
    a: "Most clients feel effects within 15–30 minutes as nutrients enter the bloodstream. Energy, mental clarity, and hydration improvements are typically noticed immediately. Regenerative benefits from Exosomes develop over days to weeks."
  },
  {
    category: 'Treatments',
    q: "Are there any lifestyle changes I should make with IV therapy?",
    a: "While IV therapy is powerful alone, results are maximized with adequate sleep, hydration, balanced nutrition, and regular exercise. We provide personalized wellness guidance with every treatment to optimize your protocol."
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
    a: "Tiers include monthly IV drips and IM injections ranging from 1–4 treatments per month, depending on the plan. All members get 20% off à la carte services, priority scheduling, and access to exclusive member events. Higher tiers include a dedicated care coordinator and white-glove concierge service."
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
    a: "Memberships are non-transferable and tied to your account. However, we offer corporate and family plans for multiple users — contact partnerships@avalonvitality.com for details."
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
  {
    category: 'Booking',
    q: "What is your cancellation and refund policy?",
    a: "Cancellations made 24 hours in advance receive a full refund. Cancellations within 24 hours are subject to a 50% service fee. No-shows forfeit the full appointment cost. Members may cancel up to 2 monthly credits per billing cycle without penalty."
  },
  {
    category: 'Booking',
    q: "Do you require a deposit for events and group bookings?",
    a: "Yes. Event bookings require a 50% deposit to secure your date and time. The remaining balance is due 48 hours before the event. Deposits are non-refundable unless you reschedule with at least 7 days notice."
  },
  {
    category: 'Booking',
    q: "Can I customize my IV treatment?",
    a: "Absolutely. Every IV is customized based on your goals and needs. During your consultation, our clinical team will discuss your wellness objectives and design the perfect formula for you."
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
    category: 'Pricing',
    q: "What's the cost of a single IV session?",
    a: "Single IV sessions range from $150–$1,800 depending on the treatment type. IV Vitamins start at $150, NAD+ from $350, CBD from $250, and Exosomes from $700. Members receive 20% off all services."
  },
  {
    category: 'Pricing',
    q: "Are there payment plans available?",
    a: "We accept all major credit cards and offer membership plans with monthly installments. For large orders or corporate packages, contact us for custom payment arrangements."
  },
  {
    category: 'Pricing',
    q: "Do you offer group or corporate discounts?",
    a: "Yes. Corporate wellness programs, team events, and group bookings receive special rates. Contact us at partnerships@avalonvitality.com for details."
  },
  {
    category: 'Insurance',
    q: "Do you accept insurance?",
    a: "We do not bill insurance directly. Payment is required at the time of service. However, we provide itemized receipts that you can submit to your insurance provider for potential reimbursement if your policy covers IV wellness therapy."
  },
  {
    category: 'Insurance',
    q: "Can I use FSA or HSA funds?",
    a: "Yes, most FSA and HSA accounts can be used for IV therapy treatments. Check with your account administrator for specifics, and we'll provide documentation to support your claim."
  },
  {
    category: 'Insurance',
    q: "Do you provide receipts for reimbursement purposes?",
    a: "Absolutely. We provide itemized receipts detailing treatment type, date, and cost — perfect for FSA/HSA submissions or insurance reimbursement claims."
  },
  {
    category: 'Coming Soon',
    q: "What services are in your development pipeline?",
    a: "We're actively expanding our offerings to include peptide therapies, aesthetic treatments, and specialized regenerative protocols. Join our waitlist to be first notified when new services launch."
  },
  {
    category: 'Coming Soon',
    q: "When will new treatments become available?",
    a: "Our roadmap includes quarterly service launches. We're prioritizing based on member feedback and clinical validation. Subscribe to our newsletter for the latest updates on upcoming offerings."
  },
  {
    category: 'Coming Soon',
    q: "How can I request a specific treatment?",
    a: "We'd love to hear what you're interested in. Email us at support@avalonvitality.co with your treatment suggestions — member requests directly influence our development priorities."
  },
];

const CATEGORIES = ['General', 'Treatments', 'Membership', 'Booking', 'Safety', 'Pricing', 'Insurance', 'Events', 'B2B', 'Coming Soon'];

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div
      className="border border-border/60 rounded-2xl bg-card overflow-hidden cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between px-5 py-3 gap-4">
         <span className="font-body text-sm text-foreground">{faq.q}</span>
         <div className="shrink-0 w-5 h-5 flex items-center justify-center">
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
            <div className="px-5 pb-3 border-t border-border/40">
               <p className="font-body text-sm text-muted-foreground leading-relaxed pt-2">{faq.a}</p>
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
      <div className="max-w-3xl mx-auto">

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-heading text-6xl md:text-8xl text-foreground tracking-wide mb-3"
        >
          FAQ
        </motion.h2>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="SEARCH"
            value={search}
            onChange={e => { setSearch(e.target.value); setOpenIndex(null); }}
            className="w-full bg-transparent border border-border/60 rounded-full pl-12 pr-6 py-2 font-body text-xs tracking-[0.2em] uppercase text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors"
          />
        </div>

        {/* Category filters */}
        <div className="mb-2">
          <p className="font-body text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-1">Topic</p>
          <div className="flex flex-wrap gap-1.5">
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
        <div className="space-y-1">
          {filtered.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground py-4 text-center">No results found.</p>
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