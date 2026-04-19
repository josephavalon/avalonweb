import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { Droplets } from 'lucide-react';

export default function About() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      <section className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Droplets className="w-10 h-10 text-primary mb-6" strokeWidth={1.5} />
            <h1 className="font-heading text-4xl md:text-5xl text-foreground mb-8">
              About<br />The Infusion
            </h1>
            <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-6">
              The Infusion was created to solve a gap in modern wellness: getting high-quality IV therapy shouldn't require a clinic visit, long wait times, or guesswork about what's in your drip.
            </p>
            <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-6">
              We believe advanced health tools should be both safe and accessible — delivered directly to you, on your schedule.
            </p>
            <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed">
              That's why The Infusion combines physician oversight, medical-grade formulations, and licensed nursing care — so you can access the benefits of IV therapy with complete confidence.
            </p>
          </motion.div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-card border border-border rounded-2xl p-8"
            >
              <h3 className="font-heading text-xl text-foreground mb-4">Why "The Infusion"</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
                Our name reflects our philosophy: true wellness comes not from a quick fix, but from a thoughtful infusion — a careful blend of science, care, and intention delivered directly to where it matters most.
              </p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                From the first consultation to every treatment, the process is intentional, transparent, and results-driven.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-card border border-border rounded-2xl p-8"
            >
              <h3 className="font-heading text-xl text-foreground mb-4">Our Standards</h3>
              <div className="space-y-4">
                {[
                  'All drips compounded by FDA-registered U.S. pharmacies',
                  'Every nurse is a licensed registered nurse (RN)',
                  'Physician review on every patient intake',
                  'Medical-grade equipment and sterile protocols',
                  'Rigorous testing for purity and potency',
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                    <span className="font-body text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="bg-card border border-border rounded-2xl p-8"
            >
              <h3 className="font-heading text-xl text-foreground mb-4">Our Mission</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                To be your trusted source for IV therapy — combining clinical credibility, expert nursing care, and premium pharmacy partnerships to deliver wellness that works, wherever you are.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}