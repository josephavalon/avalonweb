import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

export default function Careers() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative h-[40vh] flex items-end justify-start overflow-hidden border-b border-border">
        <div className="relative z-10 px-6 md:px-16 pb-12">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-heading text-6xl md:text-8xl text-foreground tracking-wide leading-none"
          >
            JOIN THE TEAM
          </motion.h1>
          <p className="font-body text-sm text-muted-foreground mt-3 tracking-widest uppercase">Build the future of mobile wellness</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6 md:px-16">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <p className="font-body text-base text-muted-foreground leading-relaxed mb-6">
              Avalon Vitality is building the future of high-performance recovery. We're looking for passionate, driven individuals who are committed to excellence in clinical care, operations, and innovation.
            </p>
            <p className="font-body text-base text-muted-foreground leading-relaxed">
              If you're interested in joining our growing team, reach out to us at <a href="mailto:careers@avalonvitality.co" className="text-accent hover:text-accent/70">careers@avalonvitality.co</a> with your resume and a brief introduction.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="border-t border-border pt-12"
          >
            <h2 className="font-heading text-3xl md:text-4xl text-foreground tracking-wide mb-6">Why Avalon?</h2>
            <ul className="space-y-4">
              <li className="flex gap-4">
                <div className="shrink-0 w-2 h-2 rounded-full bg-accent mt-2" />
                <p className="font-body text-sm text-muted-foreground">Cutting-edge mobile wellness — be part of the longevity revolution</p>
              </li>
              <li className="flex gap-4">
                <div className="shrink-0 w-2 h-2 rounded-full bg-accent mt-2" />
                <p className="font-body text-sm text-muted-foreground">Work alongside clinical experts and passionate professionals</p>
              </li>
              <li className="flex gap-4">
                <div className="shrink-0 w-2 h-2 rounded-full bg-accent mt-2" />
                <p className="font-body text-sm text-muted-foreground">Competitive compensation and comprehensive benefits</p>
              </li>
              <li className="flex gap-4">
                <div className="shrink-0 w-2 h-2 rounded-full bg-accent mt-2" />
                <p className="font-body text-sm text-muted-foreground">Flexible scheduling and a collaborative, high-performance culture</p>
              </li>
            </ul>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}