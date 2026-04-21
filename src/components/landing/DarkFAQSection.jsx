import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

export default function DarkFAQSection({ title, faqs, ctaButton }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  return (
    <section className="py-16 md:py-20 px-4 md:px-16">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-3xl bg-[#2a1419] p-8 md:p-12 space-y-6">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="w-full flex items-center justify-between group"
              >
                {expandedIndex === index && (
                  <motion.div
                    layoutId={`indicator-${index}`}
                    className="w-12 h-8 bg-[#9b7b70] rounded-full shrink-0 mr-6"
                  />
                )}
                <motion.h3
                  layout
                  className="font-body text-lg md:text-xl text-foreground tracking-widest uppercase text-left font-semibold flex-1"
                >
                  {faq.question}
                </motion.h3>
                <div className="shrink-0 text-foreground ml-4">
                  {expandedIndex === index ? (
                    <Minus className="w-7 h-7" />
                  ) : (
                    <Plus className="w-7 h-7" />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {expandedIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="pt-4 font-body text-base text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {index < faqs.length - 1 && (
                <div className="mt-6 h-px bg-white/10" />
              )}
            </motion.div>
          ))}

          {ctaButton && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="pt-6"
            >
              <a
                href={ctaButton.href}
                className="block w-full bg-foreground text-background font-body text-sm tracking-widest uppercase font-semibold rounded-full py-4 text-center hover:bg-foreground/90 transition-colors"
              >
                {ctaButton.label}
              </a>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}