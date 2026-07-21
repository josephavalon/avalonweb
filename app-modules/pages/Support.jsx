// Public customer support ticket page (/support). Anyone can open a ticket;
// optionally anonymously. POSTs to /api/support, which stores the full message
// in Supabase and emails support@ a PHI-free notification. No auth — plain fetch
// (apiClient would attach a bearer token we don't have here).
import React, { useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { LifeBuoy, Mail, Phone, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';
import { Button } from '@/components/ui/button';
import { avalonFieldClass, avalonLabelClass, avalonErrorClass } from '@/components/ui/formStyles';

const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 1, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'booking', label: 'Booking & scheduling' },
  { value: 'billing', label: 'Billing & payments' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Something else' },
];

const SELECT_CLASS = `${avalonFieldClass} appearance-none`;

export default function Support() {
  useSeo({
    title: 'Support — Avalon Vitality',
    description: 'Open a support ticket with Avalon Vitality. Ask a question, report an issue, or share feedback — anonymously if you prefer.',
    path: '/support',
  });

  const [form, setForm] = useState({ category: 'general', subject: '', message: '', name: '', email: '' });
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [error, setError] = useState('');
  const [ticketId, setTicketId] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.message.trim()) {
      setError('Please tell us how we can help.');
      return;
    }
    if (!anonymous) {
      const email = form.email.trim();
      if (!email) { setError('Add an email so we can reply — or switch to anonymous.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('That email address looks off.'); return; }
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          subject: form.subject.trim(),
          message: form.message.trim(),
          anonymous,
          name: anonymous ? '' : form.name.trim(),
          email: anonymous ? '' : form.email.trim(),
          website: '', // honeypot — real users leave this empty
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setStatus('error');
        setError('Too many requests. Please wait a few minutes and try again.');
        return;
      }
      if (!res.ok || !data?.success) {
        setStatus('error');
        setError(data?.error || 'Something went wrong. Please email support@avalonvitality.co directly.');
        return;
      }
      setTicketId(data.ticketId || '');
      setStatus('success');
    } catch {
      setStatus('error');
      setError('Network error. Please check your connection and try again.');
    }
  };

  return (
    <div className="av-page-surface min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-10 md:py-16 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE }}
              className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10"
            >
              <LifeBuoy className="h-5 w-5 text-accent" />
            </motion.div>
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
            >
              How can we help?
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl"
            >
              Open a ticket and our team will get back to you within one business day. Prefer to stay anonymous? You can.
            </motion.p>
          </div>
        </section>

        {/* Form + contact rail */}
        <Reveal as="section" className="py-8 md:py-14 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[1.6fr_1fr]">

            {/* Ticket form / success */}
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 md:p-8">
              {status === 'success' ? (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h2 className="font-heading text-3xl text-foreground uppercase mb-3">Ticket received</h2>
                  <p className="font-body text-sm text-foreground/65 leading-relaxed max-w-sm mx-auto">
                    {ticketId ? <>Your reference is <span className="text-foreground/90">#{ticketId}</span>. </> : null}
                    {anonymous
                      ? 'Thanks — we’ve logged your message. Since it was sent anonymously, we won’t be able to reply.'
                      : 'We’ve emailed you a confirmation and will reply within one business day.'}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => {
                      setForm({ category: 'general', subject: '', message: '', name: '', email: '' });
                      setAnonymous(false);
                      setTicketId('');
                      setStatus('idle');
                    }}
                  >
                    Submit another ticket
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  {/* Honeypot — hidden from humans, catches bots */}
                  <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
                    <label>
                      Leave this field empty
                      <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                    </label>
                  </div>

                  <div className="mb-5">
                    <label htmlFor="support-category" className={avalonLabelClass}>Topic</label>
                    <select id="support-category" className={SELECT_CLASS} value={form.category} onChange={set('category')}>
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-5">
                    <label htmlFor="support-subject" className={avalonLabelClass}>Subject <span className="text-foreground/30">(optional)</span></label>
                    <input
                      id="support-subject"
                      type="text"
                      className={avalonFieldClass}
                      value={form.subject}
                      onChange={set('subject')}
                      placeholder="A short summary"
                      maxLength={160}
                    />
                  </div>

                  <div className="mb-5">
                    <label htmlFor="support-message" className={avalonLabelClass}>How can we help?</label>
                    <textarea
                      id="support-message"
                      className={`${avalonFieldClass} min-h-[160px] resize-y`}
                      value={form.message}
                      onChange={set('message')}
                      placeholder="Tell us what's going on."
                      maxLength={5000}
                      required
                    />
                    <p className="mt-2 font-body text-[12px] text-foreground/35">
                      Please don’t include sensitive medical details here — for clinical matters, call us at (415) 980-7708.
                    </p>
                  </div>

                  {/* Contact mode toggle */}
                  <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-1">
                    <button
                      type="button"
                      onClick={() => setAnonymous(false)}
                      className={`rounded-xl px-3 py-2.5 font-body text-[13px] font-semibold transition-colors ${!anonymous ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground/80'}`}
                    >
                      Include my contact info
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnonymous(true)}
                      className={`rounded-xl px-3 py-2.5 font-body text-[13px] font-semibold transition-colors ${anonymous ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground/80'}`}
                    >
                      Send anonymously
                    </button>
                  </div>

                  {anonymous ? (
                    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] px-4 py-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground/45" />
                      <p className="font-body text-[13px] text-foreground/55 leading-relaxed">
                        We won’t collect your name or email. Note that we can’t reply to anonymous tickets — for a response, include your email.
                      </p>
                    </div>
                  ) : (
                    <div className="mb-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="support-name" className={avalonLabelClass}>Name <span className="text-foreground/30">(optional)</span></label>
                        <input
                          id="support-name"
                          type="text"
                          className={avalonFieldClass}
                          value={form.name}
                          onChange={set('name')}
                          placeholder="Your name"
                          maxLength={120}
                          autoComplete="name"
                        />
                      </div>
                      <div>
                        <label htmlFor="support-email" className={avalonLabelClass}>Email</label>
                        <input
                          id="support-email"
                          type="email"
                          className={avalonFieldClass}
                          value={form.email}
                          onChange={set('email')}
                          placeholder="you@email.com"
                          maxLength={254}
                          autoComplete="email"
                        />
                      </div>
                    </div>
                  )}

                  {error && <p className={`${avalonErrorClass} mb-4`}>{error}</p>}

                  <Button type="submit" size="lg" disabled={status === 'submitting'} className="w-full gap-2">
                    {status === 'submitting' ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : 'Submit ticket'}
                  </Button>
                </form>
              )}
            </div>

            {/* Contact rail */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 md:p-6">
                <p className="font-heading text-xl text-foreground uppercase mb-4">Reach us directly</p>
                <a href="mailto:support@avalonvitality.co" className="mb-3 flex items-center gap-3 font-body text-sm text-foreground/75 hover:text-foreground transition-colors">
                  <Mail className="h-4 w-4 text-foreground/45" /> support@avalonvitality.co
                </a>
                <a href="tel:+14159807708" className="flex items-center gap-3 font-body text-sm text-foreground/75 hover:text-foreground transition-colors">
                  <Phone className="h-4 w-4 text-foreground/45" /> (415) 980-7708
                </a>
                <p className="mt-4 font-body text-[12px] text-foreground/40">8AM–8PM · SF Bay Area</p>
              </div>
              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 md:p-6">
                <p className="font-body text-[13px] text-foreground/55 leading-relaxed">
                  Already a member? Manage bookings, billing, and messages from your account dashboard.
                </p>
              </div>
            </div>

          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
