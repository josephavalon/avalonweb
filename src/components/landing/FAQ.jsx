import React from 'react';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What is mobile IV therapy?",
    a: "Mobile IV therapy is a premium service where a registered nurse comes to your chosen location — home, office, hotel, or event — and administers an IV drip customized with vitamins, minerals, and hydration directly into your bloodstream."
  },
  {
    q: "Is IV therapy safe?",
    a: "Yes. All IV treatments are administered by licensed registered nurses using medical-grade equipment and formulas compounded by accredited U.S. pharmacies. A physician reviews every patient's health intake before treatment."
  },
  {
    q: "How long does a session take?",
    a: "Most IV drip sessions last between 30-60 minutes depending on the formula. Our nurse handles all setup and cleanup — you just sit back and relax."
  },
  {
    q: "Do I need a prescription?",
    a: "No prescription is needed. When you book, you'll complete a brief health questionnaire that is reviewed by a licensed physician before your treatment is approved."
  },
  {
    q: "Where can I receive treatment?",
    a: "Anywhere you're comfortable — your home, office, hotel room, or private event. We bring everything needed for a safe, sterile treatment."
  },
  {
    q: "What's included in the membership?",
    a: "Membership gives you access to priority scheduling, personalized drip consultations every 3 months, clinical support, unlimited messaging with your care team, and exclusive member pricing on all IV drips. The IV drips themselves are sold separately."
  },
  {
    q: "Can I book without a membership?",
    a: "Yes! Your first session requires no membership. After that, a $49/month membership unlocks ongoing benefits and member pricing."
  },
  {
    q: "How quickly will I feel results?",
    a: "Most clients report feeling noticeably better within 30-60 minutes of their infusion. Because nutrients go directly into your bloodstream, the effects are near-immediate."
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-24 md:py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl text-foreground">
            Frequently asked questions
          </h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl px-6 bg-card">
              <AccordionTrigger className="font-heading text-sm md:text-base text-foreground hover:no-underline py-5">
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