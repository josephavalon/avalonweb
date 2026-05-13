import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Printer } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';

const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const PRESETS = [50, 100, 150, 200, 250, 350, 500];

const HOW_IT_WORKS = [
  { step: '01', title: 'Choose Amount', desc: 'Select a preset gift or enter a custom dollar amount.' },
  { step: '02', title: 'Enter Recipient Info', desc: 'Add their name, email, and a personal message.' },
  { step: '03', title: 'We Handle the Rest', desc: 'Our team issues the certificate manually and sends it to the recipient within 24 hours. You\'ll get a confirmation too.' },
];

const OCCASIONS = ['Birthday', 'Recovery Gift', 'New Parent', 'Thank You', 'Just Because', 'Post-Race', 'Wedding', 'Graduation'];

const OCCASION_MESSAGES = {
  'Birthday': 'Happy birthday! Treat yourself to an Avalon recovery session — you deserve it.',
  'Recovery Gift': 'Hope this helps you feel your best. Enjoy your Avalon session.',
  'New Parent': "You've earned some recovery time. Enjoy this Avalon session, on me.",
  'Thank You': 'Thank you for everything. Here\'s a little something to help you recharge.',
  'Just Because': "Just thinking of you. Book whenever you're ready.",
  'Post-Race': 'Incredible effort. Now it\'s time to recover right.',
  'Wedding': 'Wishing you a beautiful start. Here\'s to feeling your absolute best.',
  'Graduation': 'Congratulations! Time to celebrate and recover.',
};

export default function Gift() {
  useSeo({ title: 'Gift an IV Session — Avalon Vitality', description: 'Give the gift of recovery. Send an Avalon IV therapy session to someone you care about.', path: '/gift' });
  const [selectedAmount, setSelectedAmount] = useState(150);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [selectedOccasion, setSelectedOccasion] = useState(null);
  const [formData, setFormData] = useState({
    recipientName: '',
    recipientEmail: '',
    senderName: '',
    message: '',
    sendDate: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const certCode = useMemo(() => `AVLN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, []);

  const displayAmount = customMode ? (customValue || null) : selectedAmount;

  const handlePreset = (amount) => {
    setSelectedAmount(amount);
    setCustomMode(false);
    setCustomValue('');
  };

  const handleCustomToggle = () => {
    setCustomMode(true);
    setSelectedAmount(null);
  };

  const handleOccasion = (occasion) => {
    if (selectedOccasion === occasion) {
      setSelectedOccasion(null);
    } else {
      setSelectedOccasion(occasion);
      setFormData((prev) => ({ ...prev, message: OCCASION_MESSAGES[occasion] }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Gift Certificates
            </motion.p>
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
            >
              Give Recovery
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl mb-3"
            >
              The gift of an Avalon session. For anyone. Any occasion.
            </motion.p>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.22 }}
              className="font-body text-sm text-foreground/40 leading-relaxed"
            >
              Birthday. Wedding. New parent. Post-marathon. Just because.
            </motion.p>
          </div>
        </section>

        {/* Amount Generator */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Select a Gift
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Gift Amount
            </motion.h2>

            {/* Animated amount display */}
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
              className="text-center py-8 border border-foreground/[0.08] rounded-2xl bg-foreground/[0.02] mb-6"
            >
              <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/30 mb-2">Gift Value</p>
              <motion.p
                key={displayAmount}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="font-heading text-7xl md:text-8xl text-foreground leading-none"
              >
                {displayAmount ? `$${displayAmount}` : '—'}
              </motion.p>
              <p className="font-body text-xs text-foreground/40 mt-3">Applied as credit toward any Avalon session</p>
            </motion.div>

            {/* Preset pills */}
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.18 }}
              className="flex flex-wrap gap-2 mb-4"
            >
              {PRESETS.map((amount) => {
                const isActive = !customMode && selectedAmount === amount;
                return (
                  <button
                    key={amount}
                    onClick={() => handlePreset(amount)}
                    className={`px-4 py-2 rounded-full font-body text-xs tracking-[0.12em] border transition-all duration-200 ${
                      isActive
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-foreground/20 text-foreground/60 hover:border-foreground/40'
                    }`}
                  >
                    ${amount}
                  </button>
                );
              })}
              <button
                onClick={handleCustomToggle}
                className={`px-4 py-2 rounded-full font-body text-xs tracking-[0.12em] border transition-all duration-200 ${
                  customMode
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-foreground/20 text-foreground/60 hover:border-foreground/40'
                }`}
              >
                Custom
              </button>
            </motion.div>

            {/* Custom amount input */}
            {customMode && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="mt-4"
              >
                <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                  Custom Amount
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-body text-foreground/50">$</span>
                  <input
                    type="number"
                    min="25"
                    placeholder="Enter amount"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl pl-8 pr-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors"
                  />
                </div>
              </motion.div>
            )}
          </div>
        </Reveal>

        {/* How It Works */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              How It Works
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Three Steps
            </motion.h2>

            <div className="grid md:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((step, i) => (
                <motion.div
                  key={step.step}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                >
                  <p className="font-heading text-5xl text-foreground/10 leading-none mb-4">{step.step}</p>
                  <p className="font-heading text-xl text-foreground uppercase mb-3">{step.title}</p>
                  <p className="font-body text-sm text-foreground/60 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Gift Form */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Send a Gift
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Gift Details
            </motion.h2>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="max-w-lg space-y-6"
              >
                {/* Gift Certificate Card */}
                <div className="rounded-2xl border border-accent/30 bg-accent/[0.04] p-8 space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-body text-[8px] tracking-[0.4em] uppercase text-foreground/40 mb-1">Gift Certificate</p>
                      <p className="font-heading text-2xl text-foreground uppercase tracking-wide">Avalon Vitality</p>
                    </div>
                    <p className="font-heading text-4xl text-accent leading-none">
                      {displayAmount ? `$${displayAmount}` : '—'}
                    </p>
                  </div>

                  <div className="border-t border-foreground/[0.08] pt-5 space-y-1.5">
                    {formData.recipientName && (
                      <p className="font-body text-xs text-foreground/60">
                        To: <span className="text-foreground">{formData.recipientName}</span>
                      </p>
                    )}
                    {formData.senderName && (
                      <p className="font-body text-xs text-foreground/60">
                        From: <span className="text-foreground">{formData.senderName}</span>
                      </p>
                    )}
                    {formData.message && (
                      <p className="font-body text-xs text-foreground/50 italic pt-1">"{formData.message}"</p>
                    )}
                  </div>

                  <div className="border-t border-foreground/[0.08] pt-4 space-y-1">
                    <p className="font-body text-[10px] tracking-[0.2em] uppercase text-accent">
                      {certCode}
                    </p>
                    <p className="font-body text-[10px] text-foreground/40">Valid 12 months from purchase</p>
                    <p className="font-body text-[10px] text-foreground/40">Redeem at avalonvitality.co</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-foreground/20 font-body text-xs tracking-[0.15em] uppercase text-foreground/60 hover:border-foreground/40 hover:text-foreground transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Print
                  </button>
                </div>

                <p className="font-body text-xs text-foreground/40 leading-relaxed">
                  Our team will send the certificate to the recipient within 24 hours. Check your inbox for a confirmation.
                </p>
              </motion.div>
            ) : (
              <motion.div
                {...REVEAL}
                transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
                className="max-w-2xl"
              >
                {/* Occasion chips */}
                <div className="mb-8">
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-3">Occasion</p>
                  <div className="flex flex-wrap gap-2">
                    {OCCASIONS.map((occasion) => {
                      const isActive = selectedOccasion === occasion;
                      return (
                        <button
                          key={occasion}
                          type="button"
                          onClick={() => handleOccasion(occasion)}
                          className={`px-3 py-1.5 rounded-full font-body text-[10px] tracking-[0.1em] border transition-all duration-200 ${
                            isActive
                              ? 'bg-accent/15 text-accent border-accent/40'
                              : 'border-foreground/15 text-foreground/50 hover:border-foreground/30'
                          }`}
                        >
                          {occasion}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live preview card */}
                <div className="rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] p-6 md:p-8 mb-8">
                  <p className="font-body text-[9px] tracking-[0.35em] uppercase text-foreground/30 mb-4">Preview</p>
                  <div className="border border-accent/20 bg-accent/[0.03] rounded-2xl p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-heading text-lg text-foreground uppercase tracking-wide">Avalon Vitality</p>
                        <p className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/40 mt-0.5">Gift Certificate</p>
                      </div>
                      <motion.p
                        key={displayAmount}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="font-heading text-3xl text-accent"
                      >
                        {displayAmount ? `$${displayAmount}` : '—'}
                      </motion.p>
                    </div>
                    <div className="border-t border-foreground/[0.08] pt-4 space-y-1">
                      <p className="font-body text-xs text-foreground/60">
                        To: <span className="text-foreground">{formData.recipientName || 'Recipient Name'}</span>
                      </p>
                      <p className="font-body text-xs text-foreground/60">
                        From: <span className="text-foreground">{formData.senderName || 'Your Name'}</span>
                      </p>
                    </div>
                    {formData.message && (
                      <p className="font-body text-xs text-foreground/50 italic border-t border-foreground/[0.06] pt-3">
                        "{formData.message}"
                      </p>
                    )}
                    <p className="font-body text-[9px] text-foreground/30 tracking-wide border-t border-foreground/[0.06] pt-3">
                      Valid 12 months · No expiration on credit · SF Bay Area
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 space-y-6"
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Their name"
                        value={formData.recipientName}
                        onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                        className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25"
                      />
                    </div>
                    <div>
                      <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="their@email.com"
                        value={formData.recipientEmail}
                        onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                        className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your name"
                      value={formData.senderName}
                      onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                      className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40">
                        Personal Message (optional)
                      </label>
                      {selectedOccasion && (
                        <span className="font-body text-[9px] tracking-[0.1em] uppercase text-accent/70">
                          {selectedOccasion} template applied
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Add a personal note..."
                      value={formData.message}
                      onChange={(e) => {
                        setFormData({ ...formData, message: e.target.value });
                        if (selectedOccasion && e.target.value !== OCCASION_MESSAGES[selectedOccasion]) {
                          setSelectedOccasion(null);
                        }
                      }}
                      className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25 resize-none"
                    />
                  </div>

                  <div>
                    <label className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                      Send Date
                    </label>
                    <input
                      type="date"
                      value={formData.sendDate}
                      onChange={(e) => setFormData({ ...formData, sendDate: e.target.value })}
                      className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors"
                    />
                    <p className="font-body text-[11px] text-foreground/35 mt-1.5">Leave blank to send immediately.</p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-accent text-background font-body text-sm tracking-[0.15em] uppercase py-4 rounded-xl hover:bg-accent/90 transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    Submit Gift Request <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </motion.div>
            )}
          </div>
        </Reveal>

        {/* Fine print */}
        <Reveal as="section" className="py-12 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <p className="font-body text-xs text-foreground/35 leading-relaxed max-w-2xl">
              Gift certificates are non-refundable. Valid for 12 months from date of purchase. Redeemable on any Avalon IV session. No cash value.
            </p>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
