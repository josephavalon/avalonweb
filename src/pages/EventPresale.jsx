import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Calendar, CheckCircle, Clock, Mail, QrCode, Shield, Ticket, User } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PremiumButton from '@/components/ui/PremiumButton';
import {
  generatePresaleCodes,
  readEventPresales,
  redeemPresaleCode,
} from '@/lib/platformOps';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];
const fieldClass = 'w-full rounded-2xl border border-foreground/[0.10] bg-background/[0.72] px-4 py-3.5 font-body text-sm text-foreground outline-none transition focus:border-foreground/35';

function MiniQr({ value = 'AV' }) {
  const blocks = Array.from({ length: 49 }, (_, index) => {
    const char = value.charCodeAt(index % Math.max(1, value.length)) || index;
    return (char + index) % 3 !== 0;
  });
  return (
    <div className="grid h-28 w-28 grid-cols-7 gap-1 rounded-2xl border border-foreground/[0.12] bg-background p-3">
      {blocks.map((on, index) => (
        <span key={index} className={`rounded-[3px] ${on ? 'bg-foreground' : 'bg-transparent'}`} />
      ))}
    </div>
  );
}

export default function EventPresale() {
  const { eventId = '' } = useParams();
  const [state, setState] = useState(() => {
    const current = readEventPresales();
    if (!current.codes.length && current.events[0]) return generatePresaleCodes(current.events[0].id, 6);
    return current;
  });
  const selectedEvent = useMemo(
    () => state.events.find((event) => event.id === eventId) || state.events[0],
    [state.events, eventId]
  );
  const starterCode = useMemo(() => (
    state.codes.find((code) => code.eventId === selectedEvent?.id && code.status !== 'Redeemed')?.code || ''
  ), [selectedEvent?.id, state.codes]);
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const [form, setForm] = useState({
    code: query.get('code') || starterCode,
    name: query.get('name') || '',
    email: query.get('email') || '',
    phone: query.get('phone') || '',
    source: query.get('source') || 'Partner ticket',
    selectedTime: selectedEvent?.slots?.[0] || '',
    intakeStatus: 'GFE intake started',
  });
  const [result, setResult] = useState(null);

  useSeo({
    title: 'Launch Presale Redemption - Avalon Vitality',
    description: 'Redeem an Avalon launch presale, complete early intake, and reserve your launch service time.',
    path: `/presale/${selectedEvent?.id || ''}`,
  });

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const response = redeemPresaleCode({
      eventId: selectedEvent.id,
      code: form.code,
      selectedTime: form.selectedTime,
      source: form.source,
      intakeStatus: form.intakeStatus,
      client: {
        name: form.name,
        email: form.email,
        phone: form.phone,
      },
    });
    setState(response.state);
    setResult(response);
  };

  if (!selectedEvent) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 text-foreground">
        <p className="font-body text-sm text-foreground/60">No launch presales are configured yet.</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="px-4 pb-20 pt-28 md:px-8 md:pb-24 md:pt-36">
        <section className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, ease: EASE }}
          className="av-motion-rail rounded-[1.75rem] border border-foreground/[0.10] bg-background/68 p-6 shadow-[0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-8"
        >
          <p className="mb-4 font-body text-[10px] uppercase tracking-[0.32em] text-foreground/42">Launch Presale</p>
          <h1 className="font-heading text-[4rem] uppercase leading-[0.84] tracking-tight md:text-[7rem]">
            Reserve<br />Launch Time
          </h1>
          <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-foreground/58">
            Enter your code. Pick a time. Start GFE before launch day.
          </p>

          <div className="mt-8 grid gap-3">
            {[
              { icon: Ticket, label: selectedEvent.name, sub: `${selectedEvent.partner} · ${selectedEvent.source}` },
              { icon: Calendar, label: selectedEvent.date, sub: selectedEvent.venue },
              { icon: Clock, label: selectedEvent.window, sub: selectedEvent.service },
              { icon: Shield, label: 'Bring ID or credential', sub: 'Name and QR/code are checked at the launch.' },
            ].map(({ icon: Icon, label, sub }) => (
              <motion.div
                key={label}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.36, ease: EASE }}
                className="av-glass-sweep relative flex items-center gap-3 overflow-hidden rounded-2xl border border-foreground/[0.08] bg-foreground/[0.035] p-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-foreground/[0.08] bg-background/64">
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">{label}</p>
                  <p className="font-body text-xs text-foreground/48">{sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, delay: 0.08, ease: EASE }}
          className="rounded-[1.75rem] border border-foreground/[0.10] bg-background/68 p-5 shadow-[0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-7"
        >
          <AnimatePresence mode="wait">
          {result?.ok ? (
            <motion.div
              key="credential"
              initial={{ opacity: 0, y: 14, rotateX: -8, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
              transition={{ duration: 0.7, ease: EASE }}
              className="flex min-h-full flex-col"
            >
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4 text-emerald-500">
                <CheckCircle className="h-5 w-5" />
                <p className="font-body text-xs font-semibold uppercase tracking-[0.16em]">Acuity + GFE queued</p>
              </div>
              <div className="rounded-[1.5rem] border border-foreground/[0.10] bg-background p-5">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/38">Avalon Credential</p>
                    <h2 className="mt-3 font-heading text-4xl uppercase leading-none">{result.redemption.client.name}</h2>
                    <p className="mt-3 font-body text-sm text-foreground/58">{result.redemption.eventName}</p>
                    <p className="font-body text-sm text-foreground/58">{result.redemption.date} · {result.redemption.selectedTime}</p>
                  </div>
                  <MiniQr value={result.redemption.credential} />
                </div>
                <div className="mt-6 rounded-2xl border border-foreground/[0.08] bg-card p-4">
                  <p className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/40">Code</p>
                  <p className="mt-1 font-heading text-2xl uppercase tracking-[0.08em]">{result.redemption.credential}</p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-foreground/[0.08] bg-card p-4">
                    <p className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/40">Acuity</p>
                    <p className="mt-1 font-body text-xs font-semibold text-foreground">{result.redemption.scheduleStatus}</p>
                  </div>
                  <div className="rounded-2xl border border-foreground/[0.08] bg-card p-4">
                    <p className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/40">GFE</p>
                    <p className="mt-1 font-body text-xs font-semibold text-foreground">{result.redemption.gfeStatus}</p>
                  </div>
                </div>
              </div>
              <p className="mt-5 font-body text-sm leading-relaxed text-foreground/56">
                Show this credential with your ID at the launch. Your intake status is saved as{' '}
                <span className="font-semibold text-foreground">{result.redemption.intakeStatus}</span>.
              </p>
              <PremiumButton
                as={Link}
                wrapperClassName="mt-auto w-full"
                to="/launches"
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-4 font-body text-xs font-semibold uppercase tracking-[0.22em] text-background"
              >
                Back to launches <ArrowRight className="h-4 w-4" />
              </PremiumButton>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="space-y-4"
            >
              {result?.error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-4 font-body text-sm text-red-400">
                  {result.error}
                </div>
              )}
              <label className="block">
                <span className="mb-2 block font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Presale code or partner ticket</span>
                <input className={fieldClass} value={form.code} onChange={(event) => setValue('code', event.target.value.toUpperCase())} placeholder="AV-LAUNCH-001" required />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42"><User className="h-3.5 w-3.5" /> Full name</span>
                  <input className={fieldClass} value={form.name} onChange={(event) => setValue('name', event.target.value)} placeholder="Name on ID" required />
                </label>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42"><Mail className="h-3.5 w-3.5" /> Email</span>
                  <input className={fieldClass} type="email" value={form.email} onChange={(event) => setValue('email', event.target.value)} placeholder="you@email.com" required />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Phone</span>
                  <input className={fieldClass} inputMode="tel" value={form.phone} onChange={(event) => setValue('phone', event.target.value)} placeholder="Mobile number" required />
                </label>
                <label className="block">
                  <span className="mb-2 block font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Source</span>
                  <select className={fieldClass} value={form.source} onChange={(event) => setValue('source', event.target.value)}>
                    <option>Avalon presale</option>
                    <option>Partner ticket</option>
                    <option>Guest list</option>
                    <option>Special code</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Choose launch time</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedEvent.slots.map((slot) => (
                    <motion.button
                      key={slot}
                      type="button"
                      layout
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setValue('selectedTime', slot)}
                      className={`min-h-[52px] rounded-2xl border px-3 font-body text-sm font-semibold transition ${
                        form.selectedTime === slot
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-foreground/[0.10] bg-background/[0.52] text-foreground'
                      }`}
                    >
                      {slot}
                    </motion.button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Estimate / intake state</span>
                <select className={fieldClass} value={form.intakeStatus} onChange={(event) => setValue('intakeStatus', event.target.value)}>
                  <option>GFE intake started</option>
                  <option>GFE intake complete</option>
                  <option>Clinical review needed</option>
                  <option>Cleared before launch</option>
                </select>
              </label>
              <PremiumButton
                as="button"
                type="submit"
                wrapperClassName="w-full"
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-4 font-body text-xs font-semibold uppercase tracking-[0.22em] text-background transition active:scale-[0.99]"
              >
                Reserve launch time <QrCode className="h-4 w-4" />
              </PremiumButton>
            </motion.form>
          )}
          </AnimatePresence>
        </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
