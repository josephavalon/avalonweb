import React, { useState } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { Shield, AlertTriangle, ClipboardList, Phone, Lock, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { Reveal } from '@/components/ui/Reveal';

const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 1, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const CONTRAINDICATIONS = [
  'Active heart failure or severe cardiac conditions',
  'Severe kidney disease or renal failure',
  'Uncontrolled hypertension',
  'Pregnancy (without physician clearance)',
  'Known allergy to any listed ingredients',
  'Current use of certain medications — consult your physician before booking',
];

const TIMELINE = [
  {
    phase: 'Before',
    icon: ClipboardList,
    steps: [
      'Complete a brief health intake form at booking.',
      'An RN reviews your history and flags any concerns.',
      'You are contacted directly if clarification is needed before arrival.',
    ],
  },
  {
    phase: 'During',
    icon: Stethoscope,
    steps: [
      'Your RN monitors you throughout the entire session.',
      'Typical sessions run 45–60 minutes.',
      'You remain seated comfortably — at home, at work, or on-site.',
    ],
  },
  {
    phase: 'After',
    icon: Shield,
    steps: [
      'Your RN provides post-session guidance before departing.',
      'Direct contact information is left for any follow-up questions.',
      'All session notes are retained in your secure health record.',
    ],
  },
];

const FAQS = [
  {
    q: 'How does Avalon screen for safety before a session?',
    a: 'Every client completes a health intake form at booking. A licensed RN reviews the form before the session. If any flags are identified, the RN contacts you to discuss next steps — which may include a physician consultation before proceeding.',
  },
  {
    q: 'What happens if I have an adverse reaction?',
    a: 'Your RN follows protocol and contacts emergency services when clinically indicated.',
  },
  {
    q: 'Are your RNs licensed in California?',
    a: 'Yes. All Avalon registered nurses hold current California RN licenses issued by the California Board of Registered Nursing. Credentials are verified before employment and maintained on file.',
  },
  {
    q: 'Is the IV equipment sterile?',
    a: 'All IV supplies are single-use, sterile, and sourced from licensed medical distributors. Equipment is never reused between clients.',
  },
  {
    q: 'Who oversees the clinical protocols?',
    a: 'All Avalon IV protocols are developed and reviewed under physician oversight. A licensed medical director approves each formulation before it is offered to clients. Individual sessions are conducted by licensed registered nurses operating under standing orders.',
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-foreground/[0.08]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="font-body text-sm md:text-base text-foreground/90 pr-4">{q}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-foreground/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-foreground/40 flex-shrink-0" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="font-body text-sm text-foreground/60 leading-relaxed pb-5 pr-8">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Safety() {
  useSeo({ title: 'Safety & Standards — Avalon Vitality', description: "Avalon Vitality's clinical safety protocols, contraindications, and nursing standards.", path: '/safety' });
  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-10 md:py-16 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
            >
              Safety Standards
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl"
            >
              Clinician-led care with clear safety standards.
            </motion.p>
          </div>
        </section>

        {/* Contraindications */}
        <Reveal as="section" className="py-8 md:py-14 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div {...REVEAL} className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-[0.95] mb-4">
                  Health Screen Required
                </h2>
                <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl">
                  We screen before every session. If any item applies, check with your physician before booking.
                </p>
              </div>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-4">
              {CONTRAINDICATIONS.map((item, i) => (
                <motion.div
                  key={i}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4 flex items-start gap-3"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-2" />
                  <p className="font-body text-sm text-foreground/80 leading-relaxed">{item}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* What to Expect */}
        <Reveal as="section" className="py-8 md:py-14 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-6"
            >
              Before. During. After.
            </motion.h2>

            <div className="grid md:grid-cols-3 gap-6">
              {TIMELINE.map((phase, i) => {
                const Icon = phase.icon;
                return (
                  <motion.div
                    key={phase.phase}
                    {...REVEAL}
                    transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                    className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 md:p-6"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-5">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <p className="font-heading text-2xl text-foreground uppercase mb-4">{phase.phase}</p>
                    <ul className="space-y-3">
                      {phase.steps.map((step, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-accent flex-shrink-0 mt-2" />
                          <p className="font-body text-sm text-foreground/65 leading-relaxed">{step}</p>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Core standards */}
        <Reveal as="section" className="py-8 md:py-14 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-6"
            >
              Clear rules. No noise.
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  title: 'Emergency',
                  body: 'RNs follow protocol. Emergency services are contacted when clinically indicated.',
                  icon: Phone,
                  tone: 'text-red-300 bg-red-500/10',
                },
                {
                  title: 'Privacy',
                  body: 'Only necessary information is collected and access-limited.',
                  icon: Lock,
                  tone: 'text-foreground/70 bg-foreground/[0.06]',
                },
                {
                  title: 'Oversight',
                  body: 'Protocols are physician-reviewed and delivered by licensed registered nurses.',
                  icon: Shield,
                  tone: 'text-accent bg-accent/10',
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    {...REVEAL}
                    transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
                    className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 md:p-6"
                  >
                    <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-full ${item.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-heading text-xl text-foreground uppercase mb-3">{item.title}</p>
                    <p className="font-body text-sm text-foreground/65 leading-relaxed">{item.body}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* FAQ */}
        <Reveal as="section" className="py-8 md:py-14 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-6"
            >
              Safety FAQ
            </motion.h2>
            <div className="max-w-3xl">
              {FAQS.map((item, i) => (
                <FAQItem key={i} {...item} />
              ))}
            </div>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
