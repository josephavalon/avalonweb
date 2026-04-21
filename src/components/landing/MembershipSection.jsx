import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

// Pricing: 1 IV = $250, 20% off for members
// 1 IV/mo → $200/mo
// 2 IV/mo → $400/mo
// 3 IV/mo → $600/mo
const APPLY_URL = 'https://placeholder-square-presale.com'; // replace with Square link

const tiers = [
  {
    name: 'Essential',
    tagline: 'The Foundation',
    ivs: 1,
    ims: 1,
    price: 200,
    regularPrice: 250,
    perks: [
      '1 IV drip per month',
      '1 IM injection per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
    ],
  },
  {
    name: 'Performance',
    tagline: 'Most Popular',
    ivs: 2,
    ims: 2,
    price: 400,
    regularPrice: 500,
    featured: true,
    perks: [
      '2 IV drips per month',
      '2 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
    ],
  },
  {
    name: 'Elite',
    tagline: 'Full Protocol',
    ivs: 3,
    ims: 3,
    price: 600,
    regularPrice: 750,
    perks: [
      '3 IV drips per month',
      '3 IM injections per month',
      '20% off all à la carte treatments',
      'Credits roll over (membership must be active)',
      '3-month minimum commitment',
      'Priority scheduling',
      'Dedicated care coordinator',
      'Exclusive member events',
    ],
  },
];

export default function MembershipSection() {
  return (
    <section id="membership" className="py-24 md:py-36 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="text-center mb-6"
        >
          <p className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4">Presale — Limited Availability</p>
          <h2 className="font-heading text-6xl md:text-8xl text-foreground tracking-wide mb-6">MEMBERSHIP</h2>
          <p className="font-body text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Membership by application only. Lock in presale pricing and secure your spot before we go live.
            All plans include a <span className="text-foreground">20% discount</span>, rollover credits, and a 3-month minimum.
          </p>
        </motion.div>

        {/* Tiers */}
        <div className="grid md:grid-cols-3 gap-4 mt-16">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.8 }}
              className={`relative border rounded p-8 flex flex-col ${
                tier.featured
                  ? 'border-accent/60 bg-card'
                  : 'border-border bg-card'
              }`}
            >
              {tier.featured && (
                <div className="absolute -top-px left-0 right-0 h-px bg-accent" />
              )}
              {tier.featured && (
                <p className="text-[9px] tracking-[0.3em] text-accent font-body uppercase mb-4">{tier.tagline}</p>
              )}
              {!tier.featured && (
                <p className="text-[9px] tracking-[0.3em] text-muted-foreground font-body uppercase mb-4">{tier.tagline}</p>
              )}

              <h3 className="font-heading text-4xl text-foreground tracking-wide mb-2">{tier.name}</h3>
              <p className="font-body text-xs text-muted-foreground mb-6">
                {tier.ivs} IV{tier.ivs > 1 ? 's' : ''} + {tier.ims} IM{tier.ims > 1 ? 's' : ''} / month
              </p>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-5xl text-foreground">${tier.price}</span>
                  <span className="font-body text-xs text-muted-foreground">/month</span>
                </div>
                <p className="font-body text-[10px] text-muted-foreground mt-1">
                  <span className="line-through">${tier.regularPrice}</span>
                  <span className="text-accent ml-2">20% member discount</span>
                </p>
              </div>

              <ul className="space-y-3 mb-10 flex-1">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="font-body text-xs text-muted-foreground leading-relaxed">{perk}</span>
                  </li>
                ))}
              </ul>

              <a
                href={APPLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`block text-center py-3.5 font-body text-xs tracking-widest uppercase font-semibold rounded transition-colors ${
                  tier.featured
                    ? 'bg-foreground text-background hover:bg-foreground/90'
                    : 'border border-foreground/30 text-foreground hover:border-foreground'
                }`}
              >
                Apply for Presale
              </a>
            </motion.div>
          ))}
        </div>

        {/* Fine print */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-10 text-center"
        >
          <p className="font-body text-[10px] text-muted-foreground/50 tracking-wider max-w-lg mx-auto leading-relaxed">
            3-month minimum commitment. Credits roll over month-to-month as long as your membership remains active.
            Presale spots are limited — membership subject to approval.
          </p>
        </motion.div>
      </div>
    </section>
  );
}