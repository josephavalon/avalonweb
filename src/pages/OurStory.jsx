import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const BOOK_URL = 'https://avalonvitality.as.me/schedule/a9d85b1e';

export default function OurStory() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative h-[60vh] flex items-end justify-start overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1619983081563-430f63602d4a?w=1920&q=80"
            alt="Golden Gate Bridge"
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="relative z-10 px-6 md:px-16 pb-16">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-heading text-7xl md:text-[9rem] text-foreground tracking-wide leading-none"
          >
            OUR STORY
          </motion.h1>
        </div>
      </section>

      {/* Content */}
      <section className="py-8 md:py-10 px-6 md:px-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="font-heading text-4xl md:text-5xl text-foreground tracking-wide mb-6">
              Recovery Engineered for the Golden State
            </h2>
            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-5">
              Living in the San Francisco Bay Area means operating at full velocity. High performers do not guess at recovery — they engineer it.
            </p>
            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-5">
              From late nights in Silicon Valley to all-out weekends at BottleRock and Burning Man, high performance is the baseline. The pace never stops, and your recovery should not either.
            </p>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              That's why we deliver science-backed, on-demand recovery therapies designed to keep you sharp, resilient, and ready for what is next. We are here to help creators, founders, and performers thrive — rather than just survive.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="border border-border rounded p-8 bg-card mb-6">
              <h3 className="font-heading text-2xl text-foreground tracking-wide mb-4">Why We Created Avalon Vitality</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
                California runs on ambition, but the recovery infrastructure never kept pace. We saw walk-in clinics with hour-long waits, generic treatments, and recovery options that felt like an afterthought.
              </p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                We believed high performers deserved something better — recovery that comes to you, calibrated to your body, and delivered by clinicians who treat outcomes as seriously as you treat your goals.
              </p>
            </div>

            <div className="border border-border rounded p-8 bg-card">
              <h3 className="font-heading text-2xl text-foreground tracking-wide mb-4">Our Mission</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                To deliver world-leading recovery therapies with the best possible outcomes at the lowest reasonable cost — wherever you are.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Founder section */}
      <section className="py-8 md:py-10 px-6 md:px-16 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <h2 className="font-heading text-4xl md:text-5xl text-foreground tracking-wide mb-2">Clinical Leadership</h2>
            <p className="font-body text-sm text-muted-foreground">Dr. Jayson Weir, MD and Stephanie Weeks, RN</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="border border-border rounded p-8 bg-card"
            >
              <div className="w-16 h-16 rounded-full bg-secondary border border-border flex items-center justify-center mb-4">
                <span className="font-heading text-2xl text-accent">JW</span>
              </div>
              <h3 className="font-heading text-xl text-foreground tracking-wide mb-1">Dr. Jayson Weir, MD</h3>
              <p className="text-[10px] tracking-[0.2em] text-accent font-body uppercase mb-3">Founder & Medical Director</p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                A respected medical doctor with a background in internal medicine and regenerative therapies. Dr. Weir envisioned a new kind of wellness: on-demand, elite-grade, and tailored for artists, athletes, and professionals who live at the edge.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="border border-border rounded p-8 bg-card"
            >
              <div className="w-16 h-16 rounded-full bg-secondary border border-border flex items-center justify-center mb-4">
                <span className="font-heading text-2xl text-accent">SW</span>
              </div>
              <h3 className="font-heading text-xl text-foreground tracking-wide mb-1">Stephanie Weeks, RN</h3>
              <p className="text-[10px] tracking-[0.2em] text-accent font-body uppercase mb-3">Lead Registered Nurse</p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Veteran nurse and co-clinical lead. Stephanie brings years of IV therapy experience and ensures every Avalon treatment upholds the highest standards of safety, sterility, and patient care.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-8 md:py-10 px-6 text-center border-t border-border">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-heading text-4xl md:text-6xl text-foreground tracking-wide">THIS IS AVALON VITALITY</h2>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}