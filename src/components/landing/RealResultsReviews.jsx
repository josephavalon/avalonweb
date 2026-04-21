import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const REVIEWS = [
  {
    title: 'Within weeks, my muscle definition sharpened',
    quote: '"After years of training, I thought I had hit a plateau. Within weeks, my muscle definition sharpened, recovery sped up, and I started looking leaner while still putting on size. It feels like I unlocked another level in the gym, stronger, more efficient, and more motivated than ever."',
    initials: 'K.L.',
  },
  {
    title: 'I lost 6 pounds in 4 weeks',
    quote: '"The peptides accelerate my workout results. They also make me feel less inflamed and more shredded. I just feel lighter, happier, and more confident truly."',
    initials: 'M.C.',
  },
  {
    title: 'I look better in my mid-70s than my early 20s',
    quote: '"The transformation has been remarkable. I have more energy, my skin looks incredible, and I feel like I\'ve turned back the clock. This is truly the future of anti-aging."',
    initials: 'R.P.',
  },
];

export default function RealResultsReviews() {
  const [expandedIndex, setExpandedIndex] = useState(null);

  return (
    <section className="py-16 md:py-20 px-4 md:px-16 border-t border-border">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="font-heading text-5xl md:text-6xl text-foreground tracking-wide mb-12 md:mb-16"
        >
          REAL PEOPLE. REAL RESULTS.
        </motion.h2>

        <div className="space-y-6">
          {REVIEWS.map((review, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.8 }}
              className="border-b border-border pb-8"
            >
              <button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="w-full flex items-start justify-between gap-6 group"
              >
                <h3 className="font-heading text-xl md:text-2xl text-foreground tracking-wide text-left">
                  "{review.title}"
                </h3>
                <div className="shrink-0 text-foreground/60 group-hover:text-foreground transition-colors">
                  {expandedIndex === index ? (
                    <Minus className="w-6 h-6" />
                  ) : (
                    <Plus className="w-6 h-6" />
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
                    <div className="pt-6 space-y-4">
                      <p className="font-body text-base text-foreground leading-relaxed">
                        {review.quote}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full border border-foreground/40 flex items-center justify-center">
                          <span className="font-body text-xs font-semibold text-foreground">
                            {review.initials}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}