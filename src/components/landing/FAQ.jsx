import React from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "What's in your IVs?",
    a: "Every IV is customized and made fresh on-site with medical-grade ingredients like B-complex vitamins, glutathione, magnesium, zinc, and electrolytes — tailored to your needs. Whether it's hydration for a hangover, immune support, or athletic performance, your formula is dialed in."
  },
  {
    q: "How long does an IV session take, and is it painful?",
    a: "Sessions last 30–60 minutes with minimal discomfort — just a quick pinch like a standard blood draw. Many clients love the relaxing, spa-like vibe of receiving treatment at home or their hotel."
  },
  {
    q: "Are there side effects, and is it safe?",
    a: "Side effects are rare and mild, such as minor bruising at the insertion site, which our licensed RNs minimize through strict sterile protocols. IV therapy is safe for most people; always disclose any allergies or medical conditions when booking."
  },
  {
    q: "Can IV vitamins help with hangovers or fatigue?",
    a: "Absolutely. Our IVs are designed to support rapid rehydration and nutrient replenishment for a quick bounce-back. Clients report feeling dramatically better within 30–60 minutes after a hangover or fatigue session."
  },
  {
    q: "How often should I get an IV?",
    a: "Frequency varies by goal. Weekly for chronic fatigue or performance maintenance, bi-weekly for athletes, or on-demand for travel and events. Our team will recommend a cadence based on your lifestyle."
  },
  {
    q: "Do you offer mobile services for events?",
    a: "Yes — our teams arrive with everything needed for an on-site recovery lounge. We've done festivals, corporate retreats, film sets, and private parties. Contact us for group and event pricing."
  },
  {
    q: "Is IV therapy better than oral vitamins?",
    a: "IV therapy delivers nutrients directly to the bloodstream, bypassing digestion for up to 100% absorption compared to 10–20% from oral supplements. This means faster, more reliable results — especially for rehydration and energy."
  },
  {
    q: "What is NAD+ and why would I want it?",
    a: "NAD+ (Nicotinamide Adenine Dinucleotide) is a coenzyme essential for cellular energy production, DNA repair, and cognitive function. Levels decline with age. IV NAD+ replenishes them directly — supporting energy, mental clarity, and longevity."
  },
  {
    q: "What are Exosomes?",
    a: "Exosomes are extracellular vesicles that carry biological signals between cells, supporting regeneration and repair. Our Exosome IVs range from 30B to 90B particles and represent the frontier of cellular regenerative therapy."
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-12 md:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide">FAQ</h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded px-6 bg-card">
              <AccordionTrigger className="font-body text-sm font-semibold text-foreground tracking-wide hover:no-underline py-5 text-left">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="font-body text-sm text-muted-foreground leading-relaxed pb-5">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}