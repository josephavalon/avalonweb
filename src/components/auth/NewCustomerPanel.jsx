import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';

const EASE = [0.16, 1, 0.3, 1];

const BENEFITS = [
  'Save your details for faster booking',
  'Manage payments, records & membership',
  'Get insider perks and member-only offers',
];

// New-customer section cooked into an existing auth card: a divider, an optional
// "New Customer" heading, the benefit list, and an optional Register CTA.
// Transform + opacity reveals only (iOS-safe), no blur/filter.
//
// `embedded` = mounted inside a fixed-height, non-scrolling card (the login tab
// switcher). There the scroll-triggered whileInView reveal never fires, so the
// benefits would stay invisible; embedded mode renders them statically and tightens
// the vertical rhythm so the panel matches the other tabs' card height.
export default function NewCustomerPanel({ showCta = true, showHeading = true, bordered = true, embedded = false }) {
  return (
    <div className={bordered ? 'mt-6 border-t border-foreground/[0.08] pt-6' : ''}>
      {showHeading ? (
        <h2 className="mb-1 font-heading text-[1.75rem] uppercase leading-[0.9] tracking-tight text-foreground">
          New Customer
        </h2>
      ) : null}
      <p className={`${embedded ? 'mb-3' : 'mb-4'} font-body text-[13px] font-medium uppercase tracking-[0.18em] text-foreground/55`}>
        Create an account to:
      </p>

      <ul className="divide-y divide-foreground/[0.08] border-y border-foreground/[0.08]">
        {BENEFITS.map((text, i) => {
          const rowClass = `flex items-center gap-3.5 ${embedded ? 'py-2.5' : 'py-3'}`;
          const inner = (
            <>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/[0.18] text-foreground/72">
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
              <span className="font-body text-sm font-semibold leading-snug text-foreground/72">{text}</span>
            </>
          );
          // Embedded: static (always visible). Scrolling pages: whileInView reveal.
          return embedded ? (
            <li key={text} className={rowClass}>{inner}</li>
          ) : (
            <motion.li
              key={text}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: 0.05 * i, ease: EASE }}
              className={rowClass}
            >
              {inner}
            </motion.li>
          );
        })}
      </ul>

      {showCta ? (
        <motion.div whileTap={{ scale: 0.985 }}>
          <Link
            to="/signup"
            className={`${embedded ? 'mt-4 min-h-[48px]' : 'mt-5 min-h-[54px]'} flex w-full items-center justify-between rounded-full border border-foreground/[0.12] bg-background/35 px-5 font-body text-xs font-bold uppercase tracking-[0.2em] text-foreground/72 transition-colors hover:border-foreground/26 hover:text-foreground`}
          >
            <span>Register Now</span>
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </motion.div>
      ) : null}
    </div>
  );
}
