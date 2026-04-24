import React from 'react';
import { motion } from 'framer-motion';
import { Gift } from 'lucide-react';

const GIFT_SQUARE_URL = 'https://placeholder-square-gift.com'; // replace with Square link
const GIFT_TYPEFORM_URL = 'https://placeholder-typeform-gift.com'; // replace with Typeform link

export default function GiftCertificates() {
  return (
    <section id="gift" className="py-8 md:py-10 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-left mb-4 md:mb-8"
        >
          <p className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4">Give The Gift of Recovery</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide md:whitespace-nowrap">GIFT CERTIFICATES</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="grid md:grid-cols-2 gap-12 items-center"
        >
          {/* Left */}
          <div>
            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-8">
              Elite mobile IV therapy, delivered to their door. Any denomination. Never expires.
            </p>
            {/* Denomination buttons */}
             <div className="flex flex-wrap md:flex-nowrap gap-2 mb-5 justify-center">
             {['$100', '$250', '$500', '$1,000', '$5,000'].map((amt) => (
                <a
                  key={amt}
                  href={GIFT_SQUARE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 border border-foreground/30 text-foreground font-body text-xs tracking-widest uppercase hover:border-foreground hover:text-accent transition-colors rounded-full text-center"
                >
                  {amt}
                </a>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={GIFT_SQUARE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-7 py-3.5 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold hover:bg-foreground/90 transition-colors rounded-full text-center"
              >
                Purchase Online
              </a>
              <a
                href={GIFT_TYPEFORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-7 py-3.5 border border-foreground/30 text-foreground font-body text-xs tracking-widest uppercase hover:border-foreground transition-colors rounded-full text-center"
              >
                Custom Amount
              </a>
            </div>
          </div>

          {/* Right — decorative card (desktop only) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="relative hidden md:block"
          >
            <div className="border border-border rounded-3xl bg-card p-10 relative overflow-hidden">
              {/* Background glow */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-accent/5 blur-3xl" />

              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="font-heading text-2xl tracking-widest text-foreground">AVALON</div>
                  <div className="text-xs tracking-[0.3em] text-muted-foreground font-body -mt-0.5">VITALITY</div>
                </div>
                <Gift className="w-6 h-6 text-accent" strokeWidth={1.5} />
              </div>

              <div className="mb-8">
                <p className="font-body text-xs tracking-[0.25em] text-muted-foreground uppercase mb-1">Gift Certificate</p>
                <p className="font-heading text-6xl text-foreground tracking-wide">$250</p>
              </div>

              <div className="border-t border-border pt-5">
                <p className="font-body text-xs text-muted-foreground">Valid for any Avalon Vitality service · Never expires</p>
              </div>

              {/* Decorative dots */}
              <div className="absolute bottom-4 right-6 flex gap-1">
                {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-accent/40" />)}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}