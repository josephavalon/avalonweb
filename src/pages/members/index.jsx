/**
 * Member OS — entry shell.
 *
 * Status: scaffolded, not routed. During presale (through 2026-04-24 launch)
 * /membership redirects to /apply via App.jsx. This file exists so the
 * post-launch Member OS has an established home.
 *
 * When auth ships:
 *   1. Add an auth context provider at src/lib/auth/.
 *   2. Wrap this component in an AuthGate that redirects unauthenticated
 *      visitors to a /members/sign-in route.
 *   3. Register <Route path="/members/*" element={<MemberHome />} /> in App.jsx
 *      (replacing the /membership → /apply Navigate).
 *   4. Build child routes under src/pages/members/ — planned tree:
 *        /members                → overview (this file)
 *        /members/protocol       → active Protocol, next session, adherence
 *        /members/diagnostics    → uploaded labs, wearables sync
 *        /members/billing        → credits balance, invoice history
 *        /members/sessions       → upcoming + past drip sessions
 *        /members/settings       → profile, notifications, providers
 *
 * Design rule: every child route must render a vertical-agnostic view. The
 * Member OS is a Protocol dashboard, not an IV dashboard — adding Peptides or
 * TRT should surface automatically from the Protocol registry, never require
 * a dashboard rewrite.
 *
 * Analytics rule: every meaningful Member OS action fires a typed event via
 * src/lib/analytics.js so ARPM attribution works across verticals.
 */

import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../../components/landing/Navbar';
import Footer from '../../components/landing/Footer';

// Editorial easing — matches brief non-negotiable #5.
const EASING = [0.16, 1, 0.3, 1];

export default function MemberHome() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      <section className="pt-28 md:pt-32 pb-24 md:pb-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASING }}
            className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-6"
          >
            Member Portal
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASING, delay: 0.05 }}
            className="font-heading text-6xl md:text-7xl text-foreground tracking-wide mb-6"
          >
            OPENS POST-LAUNCH
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASING, delay: 0.12 }}
            className="font-body text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto"
          >
            Your Protocol dashboard, credit balance, and provider notes will
            live here once your membership is active.
          </motion.p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
