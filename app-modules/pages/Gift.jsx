import React, { useState, useMemo, useEffect } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight, Loader2 } from 'lucide-react';
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

const PRESETS = [50, 100, 250, 500];

const HOW_IT_WORKS = [
  { step: '01', title: 'Choose Amount', desc: 'Select a preset gift or enter a custom dollar amount.' },
  { step: '02', title: 'Enter Recipient Info', desc: 'Add their name, email, and a personal message.' },
  { step: '03', title: "We'll Email the Code", desc: "Pay through Stripe — the recipient gets the gift code by email the moment your payment clears. They redeem it from their member account." },
];

const OCCASIONS = ['Birthday', 'Recovery Gift', 'New Parent', 'Thank You', 'Just Because', 'Post-Race', 'Wedding', 'Graduation'];

const OCCASION_MESSAGES = {
  'Birthday': 'Happy birthday — enjoy a session, on me.',
  'Recovery Gift': 'Feel your best. Enjoy your Avalon session.',
  'New Parent': "You've earned this. Recover whenever you're ready.",
  'Thank You': 'Thank you for everything — recharge on me.',
  'Just Because': "Thinking of you. Book whenever you're ready.",
  'Post-Race': 'Incredible effort — now recover right.',
  'Wedding': 'To a beautiful start, and feeling your best.',
  'Graduation': 'Congratulations — celebrate, then recover.',
};

export default function Gift() {
  useSeo({ title: 'Gift an IV Session — Avalon Vitality', description: 'Give the gift of recovery. Send an Avalon IV therapy session to someone you care about.', path: '/gift' });
  const [selectedAmount, setSelectedAmount] = useState(250);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [selectedOccasion, setSelectedOccasion] = useState(null);
  const [formData, setFormData] = useState({
    recipientName: '',
    recipientEmail: '',
    senderName: '',
    senderEmail: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Detect a Stripe-success redirect (the server sets ?purchase=success on the
  // hosted Checkout success_url). We show a friendly post-purchase confirmation
  // so the buyer knows the recipient email is on its way.
  const [purchaseConfirmed, setPurchaseConfirmed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('purchase') === 'success') {
      setPurchaseConfirmed(true);
    }
  }, []);

  // The effective amount to charge (dollars). Custom mode reads the typed
  // input; otherwise the selected preset. Used by both the preview card and
  // the purchase POST.
  const effectiveAmount = useMemo(() => {
    if (customMode) {
      const n = Number(customValue);
      return Number.isFinite(n) && n >= 25 ? n : null;
    }
    return selectedAmount;
  }, [customMode, customValue, selectedAmount]);
  const displayAmount = effectiveAmount;

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!effectiveAmount || effectiveAmount < 25) {
      setError('Please choose a gift amount of $25 or more.');
      return;
    }
    if (!formData.recipientName.trim() || !formData.recipientEmail.trim()) {
      setError('Recipient name and email are required.');
      return;
    }
    if (!formData.senderName.trim() || !formData.senderEmail.trim()) {
      setError('Your name and email are required so we can send your receipt.');
      return;
    }
    setSubmitting(true);
    try {
      // Public endpoint — no Bearer header needed. Server validates everything
      // and returns the Stripe Checkout URL. We do a full-page redirect (vs
      // window.open) so Apple/Google Pay express buttons render in their own
      // origin, matching the rest of the checkout flow.
      const res = await fetch('/api/gift-cards/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: effectiveAmount,
          recipientEmail: formData.recipientEmail.trim(),
          recipientName: formData.recipientName.trim(),
          senderEmail: formData.senderEmail.trim(),
          senderName: formData.senderName.trim(),
          message: formData.message.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) {
        throw new Error(body?.error || 'Could not start checkout. Please try again.');
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err?.message || 'Could not start checkout. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="av-page-surface min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
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
              <p className="font-body text-[13px] tracking-[0.35em] uppercase text-foreground/30 mb-2">Gift Value</p>
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
                    className={`min-h-[44px] px-4 py-2 rounded-full font-body text-xs tracking-[0.12em] border transition-all duration-200 ${
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
                className={`min-h-[44px] px-4 py-2 rounded-full font-body text-xs tracking-[0.12em] border transition-all duration-200 ${
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
                <label className="font-body text-[13px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
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
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Gift Details
            </motion.h2>

            {purchaseConfirmed ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="max-w-lg space-y-6"
              >
                <div className="rounded-2xl border border-accent/30 bg-accent/[0.04] p-8 space-y-5">
                  <p className="font-body text-[11px] tracking-[0.4em] uppercase text-foreground/40 mb-1">Gift Sent</p>
                  <h3 className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-[0.95]">Your gift is on its way</h3>
                  <p className="font-body text-sm text-foreground/70 leading-relaxed">
                    Thank you. We've emailed your recipient a one-time redemption code and instructions for applying the credit to their Avalon account. You'll receive a Stripe receipt at the email you provided.
                  </p>
                  <p className="font-body text-xs text-foreground/40 leading-relaxed">
                    Codes can only be redeemed once and are tied to the recipient's email above. If they need help, reply to the email or write to support@avalonvitality.co.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                {...REVEAL}
                transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
                className="max-w-2xl"
              >
                {/* Occasion chips */}
                <div className="mb-8">
                  <p className="font-body text-[13px] tracking-[0.25em] uppercase text-foreground/40 mb-3">Occasion</p>
                  <div className="flex flex-wrap gap-2">
                    {OCCASIONS.map((occasion) => {
                      const isActive = selectedOccasion === occasion;
                      return (
                        <button
                          key={occasion}
                          type="button"
                          onClick={() => handleOccasion(occasion)}
                          className={`min-h-[44px] px-3 py-1.5 rounded-full font-body text-[13px] tracking-[0.1em] border transition-all duration-200 ${
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
                  <p className="font-body text-[12px] tracking-[0.35em] uppercase text-foreground/30 mb-4">Preview</p>
                  <div className="border border-accent/20 bg-accent/[0.03] rounded-2xl p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-heading text-lg text-foreground uppercase tracking-wide">Avalon Vitality</p>
                        <p className="font-body text-[13px] tracking-[0.2em] uppercase text-foreground/40 mt-0.5">Gift Certificate</p>
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
                    <p className="font-body text-[12px] text-foreground/30 tracking-wide border-t border-foreground/[0.06] pt-3">
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
                      <label className="font-body text-[13px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
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
                      <label className="font-body text-[13px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
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

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="font-body text-[13px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
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
                      <label className="font-body text-[13px] tracking-[0.25em] uppercase text-foreground/40 block mb-2">
                        Your Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@email.com"
                        value={formData.senderEmail}
                        onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                        className="w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:border-accent/60 transition-colors placeholder:text-foreground/25"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-body text-[13px] tracking-[0.25em] uppercase text-foreground/40">
                        Personal Message (optional)
                      </label>
                      {selectedOccasion && (
                        <span className="font-body text-[12px] tracking-[0.1em] uppercase text-accent/70">
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

                  {error && (
                    <p role="alert" className="font-body text-sm text-red-400/90 bg-red-500/[0.06] border border-red-500/30 rounded-xl px-4 py-3">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-accent text-background font-body text-sm tracking-[0.15em] uppercase py-4 rounded-xl hover:bg-accent/90 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Stripe…
                      </>
                    ) : (
                      <>
                        Pay {effectiveAmount ? `$${effectiveAmount}` : ''} & Send Gift <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="font-body text-[12px] text-foreground/40 leading-relaxed text-center">
                    Secured by Stripe. Your card is charged once. The recipient gets their code by email the moment payment clears.
                  </p>
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
