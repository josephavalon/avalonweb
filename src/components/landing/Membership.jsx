import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const perks = [
  'Medical review and physician approval for safe treatment',
  'Personalized drip consultations every 3 months',
  'Ongoing clinical support with access to expert nurses',
  'Unlimited messaging with your care team',
  'Exclusive member pricing on all IV drips',
  'Priority scheduling — we come to you',
];

export default function Membership() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="membership" className="py-24 md:py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="font-heading text-3xl md:text-4xl text-foreground mb-4">
            Premium IV therapy. One membership.
          </h2>
        </motion.div>

        {/* Toggle */}
        <div className="flex justify-center gap-4 mb-12 items-center">
          <span className={`text-xs tracking-[0.15em] font-body transition-colors ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-primary' : 'bg-border'}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-foreground transition-transform ${annual ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-xs tracking-[0.15em] font-body transition-colors ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Yearly <span className="text-primary">Save 20%</span>
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="border border-border rounded-2xl p-8 md:p-12 bg-card"
        >
          <p className="text-xs tracking-[0.2em] text-primary font-body uppercase mb-2">Core Access</p>
          <div className="flex items-end gap-2 mb-2">
            <span className="font-heading text-5xl md:text-6xl text-foreground">
              ${annual ? '39' : '49'}
            </span>
            <span className="text-muted-foreground font-body text-sm mb-2">/month</span>
          </div>
          {annual && (
            <p className="text-xs text-muted-foreground font-body mb-4">$468 billed yearly</p>
          )}
          <p className="text-xs text-muted-foreground font-body mb-8">
            * IV drip sessions are sold separately and not covered by membership.
          </p>

          <div className="space-y-4 mb-10">
            {perks.map((perk) => (
              <div key={perk} className="flex gap-3 items-start">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="font-body text-sm text-foreground/80">{perk}</span>
              </div>
            ))}
          </div>

          <a
            href="#membership"
            className="block w-full text-center py-4 bg-foreground text-background rounded-full text-sm tracking-[0.15em] font-body uppercase hover:bg-foreground/90 transition-colors"
          >
            Book Now
          </a>

          <div className="mt-8 pt-8 border-t border-border space-y-6">
            <div>
              <h4 className="font-heading text-base text-foreground mb-2">Start Today — No Membership Required</h4>
              <p className="font-body text-xs text-muted-foreground leading-relaxed">
                Book your first IV session immediately with no membership fee. Includes full access to your personalized drip protocol and nurse-administered treatment.
              </p>
            </div>
            <div>
              <h4 className="font-heading text-base text-foreground mb-2">Ongoing Support + Member Pricing</h4>
              <p className="font-body text-xs text-muted-foreground leading-relaxed">
                After your initial session, continued access is just $49/month. Includes priority scheduling, dose adjustments, ongoing clinical support, and member-only pricing.
              </p>
            </div>
            <div>
              <h4 className="font-heading text-base text-foreground mb-2">IV Drips</h4>
              <p className="font-body text-xs text-muted-foreground leading-relaxed">
                Most IV drips start at $199 per session, lasting approximately 30–60 minutes. All formulations are compounded by accredited pharmacies at clinical strength.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}