import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import Navbar from '../../components/landing/Navbar';
import Footer from '../../components/landing/Footer';

export default function DehydrationIV() {
  const [selectedOption, setSelectedOption] = useState('onetime');

  const oneTimePerks = [
    '1000mL Lactated Ringers',
    '30-60 min experience',
    'California-licensed RNs',
    'Physician supervised',
    'In-home or clinic',
  ];

  const membershipPerks = [
    '1 IV per month included',
    '1000mL Lactated Ringers per session',
    '30-60 min experience',
    'California-licensed RNs',
    'Physician supervised',
    'Priority scheduling',
    'Exclusive member pricing',
    '20% off additional treatments',
  ];

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4 md:px-16 pt-32">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <img
              src="https://avalonvitality.co/wp-content/uploads/2025/07/Dehydration-1000ml.jpg"
              alt="Dehydration IV"
              className="w-full rounded-3xl"
            />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4">
              IV HYDRATION
            </p>
            <h1 className="font-heading text-6xl md:text-7xl text-foreground tracking-wide mb-6">
              DEHYDRATION IV
            </h1>
            
            <div className="mb-8">
              <p className="font-body text-lg text-muted-foreground leading-relaxed mb-6">
                Pure hydration for balance and renewal.
              </p>
              <p className="font-body text-sm text-muted-foreground mb-4">
                <span className="font-semibold text-foreground">Includes:</span> 1000mL Lactated Ringers
              </p>
              <p className="font-body text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Supports:</span> Hydration · Balance · Wellness
              </p>
            </div>

            <div className="border border-white/20 bg-white/[0.03] backdrop-blur-md rounded-2xl p-6 mb-10">
              <p className="font-body text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-4">
                Duration
              </p>
              <p className="font-heading text-3xl text-foreground">30–60 min</p>
            </div>

            <Link
              to="/apply"
              className="inline-block bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full px-8 py-4 hover:bg-foreground/90 transition-colors mb-6"
            >
              Start Now
            </Link>

            <div className="flex gap-4">
              <a href="tel:+14159807708" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-body uppercase tracking-wide">
                Call Us
              </a>
              <span className="text-muted-foreground/30">·</span>
              <a href="sms:+14159807708" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-body uppercase tracking-wide">
                Text Us
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Options Section */}
      <section className="py-16 md:py-20 px-4 md:px-16 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-heading text-5xl md:text-6xl text-foreground tracking-wide mb-6">
              HOW YOU GET IT
            </h2>
            <p className="font-body text-base text-muted-foreground max-w-2xl mx-auto">
              Choose your commitment level—single treatment or membership access.
            </p>
          </motion.div>

          {/* Toggle */}
          <div className="flex justify-center mb-12">
            <div className="flex items-center border border-white/20 bg-white/[0.05] backdrop-blur-md rounded-full p-1 gap-1">
              <button
                onClick={() => setSelectedOption('onetime')}
                className={`px-8 py-3 font-body text-sm tracking-widest uppercase rounded-full transition-colors font-semibold ${
                  selectedOption === 'onetime'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                One Time
              </button>
              <button
                onClick={() => setSelectedOption('membership')}
                className={`px-8 py-3 font-body text-sm tracking-widest uppercase rounded-full transition-colors font-semibold ${
                  selectedOption === 'membership'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Membership
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {selectedOption === 'onetime' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="border border-white/20 bg-white/[0.03] backdrop-blur-md rounded-3xl p-8 flex flex-col"
              >
                <div className="mb-8">
                  <p className="text-[9px] tracking-[0.3em] text-muted-foreground font-body uppercase mb-3">
                    One-Time Session
                  </p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-heading text-5xl text-foreground">$150</span>
                    <span className="font-body text-sm text-muted-foreground">/session</span>
                  </div>
                  <p className="font-body text-xs text-muted-foreground">
                    New clients save 15% with code: <span className="font-semibold text-accent">WEOUTHERE</span>
                  </p>
                </div>

                <ul className="space-y-3 mb-10 flex-1">
                  {oneTimePerks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span className="font-body text-sm text-muted-foreground">{perk}</span>
                    </li>
                  ))}
                </ul>

                <a
                   href="/apply"
                   className="block text-center py-3.5 font-body text-xs tracking-widest uppercase font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors"
                 >
                   Order Now
                 </a>
              </motion.div>
            )}

            {selectedOption === 'membership' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="border border-accent/60 bg-white/[0.04] backdrop-blur-md rounded-3xl p-8 flex flex-col"
              >
                <div className="absolute -top-px left-0 right-0 h-px bg-accent" />
                
                <div className="mb-8">
                  <p className="text-[9px] tracking-[0.3em] text-accent font-body uppercase mb-3">
                    MOST POPULAR
                  </p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-heading text-5xl text-foreground">$200</span>
                    <span className="font-body text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="font-body text-xs text-muted-foreground mt-2">
                    Lock in <span className="text-accent font-semibold">20% founding member discount</span> for life
                  </p>
                </div>

                <ul className="space-y-3 mb-10 flex-1">
                  {membershipPerks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span className="font-body text-sm text-muted-foreground">{perk}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="/apply"
                  className="block text-center py-3.5 font-body text-xs tracking-widest uppercase font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors"
                >
                  Start Now
                </a>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-12 px-4 md:px-16 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <div className="border border-white/20 bg-white/[0.03] backdrop-blur-md rounded-2xl p-8">
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground block mb-3">Clinical Support:</span>
              Performed by California-licensed nurses under physician supervision.
            </p>
            <p className="font-body text-xs text-muted-foreground leading-relaxed mt-4">
              <span className="font-semibold text-foreground block mb-3">Disclaimer:</span>
              For general wellness only. Not intended to diagnose, treat, cure, or prevent any condition.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}