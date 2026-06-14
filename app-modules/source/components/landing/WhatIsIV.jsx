import React, { useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { FlaskConical, Clock, ShieldCheck, Stethoscope, SlidersHorizontal, UserCheck, TrendingUp, Minus, ChevronDown } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const MODALITIES = [
  {
    key: 'iv',
    label: 'IV Therapy',
    sub: '30 min · Direct IV delivery · MD-supervised',
    stats: [
      { value: 'Direct', label: 'IV Delivery',    icon: FlaskConical },
      { value: '30min',  label: 'Avg Session',      icon: Clock },
      { value: 'MD',     label: 'Clinical Oversight', icon: ShieldCheck },
      { value: 'Registered Nurse',     label: 'Secure Intake',      icon: Stethoscope },
      { value: '100%',   label: 'Customizable',     icon: SlidersHorizontal },
      { value: 'Registered Nurse',     label: 'Licensed Nurses',  icon: UserCheck },
    ],
    faq: [
      {
        title: 'What is IV therapy?',
        body: 'IV therapy delivers nutrients directly into the bloodstream for general wellness support — bypassing the digestive system for fast clinical delivery.',
      },
      {
        title: 'How long does a session take?',
        body: 'Most sessions run 30–45 minutes. Our licensed registered nurse sets up at your location — home, hotel, or office — with zero waiting room.',
      },
      {
        title: 'Is it safe?',
        body: 'Every session is MD-supervised and administered by a licensed registered nurse using pharmaceutical-grade nutrients.',
      },
    ],
  },
  {
    key: 'im',
    label: 'IM Shots',
    sub: 'Under 5 min · No IV line · Quick dose',
    stats: [
      { value: '~5min', label: 'Full Dose',      icon: Clock },
      { value: 'High',  label: 'Absorption',     icon: TrendingUp },
      { value: 'No IV', label: 'Line Needed',    icon: Minus },
      { value: 'B12',   label: 'Most Popular',   icon: FlaskConical },
    ],
    faq: [
      {
        title: 'What is an IM shot?',
        body: 'A concentrated dose injected directly into muscle. No IV line. Under five minutes.',
      },
      {
        title: 'How does it differ from IV?',
        body: 'IM shots are faster and needle-only — no catheter or drip bag. Ideal for a quick B12 boost or glutathione push without the full session.',
      },
      {
        title: 'What shots do you offer?',
        body: 'B12, MIC, NAD+ IM, Glutathione, and Vitamin C — each available in multiple concentrations.',
      },
    ],
  },
  {
    key: 'faq',
    label: 'FAQ',
    sub: 'Booking · safety · subscription · insurance',
    stats: [],
    faq: [
      {
        title: 'What is Avalon Vitality?',
        body: 'Mobile concierge IV therapy and longevity service for the SF Bay Area. administered by registered nurses, MD-supervised, delivered to your home or office.',
      },
      {
        title: 'How quickly can a nurse arrive?',
        body: 'Same-day in most Bay Area zip codes. Bookings made before noon typically delivered same afternoon.',
      },
      {
        title: 'Is Avalon safe for everyone?',
        body: 'Avalon is appropriate for most healthy adults. Disclose your full medical history at consultation — certain conditions may require additional screening.',
      },
      {
        title: 'Do you accept insurance?',
        body: 'No. Avalon is private-pay. We don\'t bill insurance.',
      },
      {
        title: 'What\'s the subscription commitment?',
        body: '3-month minimum. Credits roll over month-to-month while your subscription stays active. Cancel any time after the 3-month window.',
      },
    ],
  },
];

function FaqItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-foreground/10 bg-white/[0.08] rounded-xl overflow-hidden">
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        whileTap={premiumTap}
        className="w-full flex items-center justify-between px-4 py-3 [@media(hover:hover)]:hover:bg-white/[0.08] transition-colors duration-base ease-editorial"
        aria-expanded={open}
      >
        <span className="font-body text-xs font-semibold text-foreground/80 text-left">{item.title}</span>
        <ChevronDown
          className="w-3.5 h-3.5 text-foreground/25 shrink-0 transition-transform duration-300 ml-3"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          strokeWidth={2}
        />
      </motion.button>
      <SmoothDisclosure open={open}>
        <p className="px-4 pb-4 pt-1 font-body text-xs text-foreground/50 leading-relaxed border-t border-white/[0.05]">
          {item.body}
        </p>
      </SmoothDisclosure>
    </div>
  );
}

function ModalityRow({ mod, index, open, onToggle }) {
  return (
    <motion.div
      whileHover={premiumHover}
      className={`rounded-2xl border shadow-[0_18px_70px_hsl(var(--foreground)/0.035)] transition-colors duration-base ease-editorial ${
        open
          ? 'border-accent/35 bg-white/[0.12]'
          : 'border-foreground/10 bg-white/[0.08] hover:border-foreground/20 hover:bg-white/[0.105]'
      }`}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="w-full flex items-center justify-between px-5 py-4 [@media(hover:hover)]:hover:bg-white/[0.08] transition-colors duration-base ease-editorial"
        aria-expanded={open}
      >
        <div className="text-left">
          <p className="font-heading text-xl tracking-[0.06em] text-foreground uppercase leading-none">{mod.label}</p>
          <p className="font-body text-[9px] text-foreground/35 tracking-[0.15em] uppercase mt-0.5">{mod.sub}</p>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="text-foreground/30 shrink-0"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2} />
        </motion.div>
      </motion.button>

      <SmoothDisclosure open={open}>
        <div className="border-t border-white/[0.06] px-5 pb-5 pt-4 space-y-4">

              {/* Compact stat pills */}
              <div className="flex flex-wrap gap-2">
                {mod.stats.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]"
                  >
                    <s.icon className="w-3 h-3 text-accent shrink-0" strokeWidth={1.5} />
                    <span className="font-heading text-xs text-foreground tracking-wide leading-none">{s.value}</span>
                    <span className="font-body text-[9px] text-foreground/35 tracking-[0.12em] uppercase">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* FAQ */}
              <div className="space-y-1.5">
                {mod.faq.map((item) => (
                  <FaqItem key={item.title} item={item} />
                ))}
              </div>

        </div>
      </SmoothDisclosure>
    </motion.div>
  );
}

export default function WhatIsIV() {
  const [openModality, setOpenModality] = useState(null);

  return (
    <section className="py-10 md:py-16 px-4">
      <div className="max-w-6xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: EASE }}
          className="mb-6 md:mb-10"
        >
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">FAQ</p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">Questions</h2>
          <p className="font-body text-sm text-foreground/55 leading-relaxed mt-3 max-w-md">
            Quick answers on IV therapy, IM shots, booking, safety, and subscription care.
          </p>
        </motion.div>

        <div className="space-y-2">
          {MODALITIES.map((mod, i) => (
            <ModalityRow
              key={mod.key}
              mod={mod}
              index={i}
              open={openModality === mod.key}
              onToggle={() => setOpenModality(current => current === mod.key ? null : mod.key)}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
