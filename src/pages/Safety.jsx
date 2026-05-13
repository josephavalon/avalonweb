import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, ClipboardList, Phone, Lock, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
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
    a: 'All Avalon RNs carry emergency response equipment and are trained in IV complication management. In the event of an adverse reaction, established medical protocols are followed immediately, and emergency services are contacted if clinically indicated.',
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
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Standards &amp; Protocols
            </motion.p>
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
              Every session is designed around your wellbeing. Our protocols exist to protect you — before, during, and after your visit.
            </motion.p>
          </div>
        </section>

        {/* Contraindications */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div {...REVEAL} className="flex items-start gap-4 mb-10">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-2">Who Should Not Book</p>
                <h2 className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-[0.95] mb-4">
                  Health Screen Required
                </h2>
                <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl">
                  We perform a health screen before every session. If any of the following apply, please consult your physician before booking. Your safety is the priority — we would rather reschedule than proceed with unresolved concerns.
                </p>
              </div>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-4">
              {CONTRAINDICATIONS.map((item, i) => (
                <motion.div
                  key={i}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 flex items-start gap-3"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-2" />
                  <p className="font-body text-sm text-foreground/80 leading-relaxed">{item}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* What to Expect */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              What to Expect
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-12"
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
                    className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
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

        {/* Emergency Protocol */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...REVEAL}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 flex flex-col md:flex-row gap-6 md:gap-10 items-start"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-2">Emergency Protocol</p>
                <h2 className="font-heading text-2xl md:text-3xl text-foreground uppercase leading-[0.95] mb-4">
                  Prepared for Every Scenario
                </h2>
                <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl">
                  All Avalon RNs carry emergency response equipment and are trained in IV complications. In the event of an adverse reaction, your RN follows established medical protocols and emergency services are contacted if needed. You are never left alone with a concern.
                </p>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {/* HIPAA */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div {...REVEAL} className="flex items-start gap-4 mb-8">
              <div className="w-10 h-10 rounded-full bg-foreground/[0.06] flex items-center justify-center flex-shrink-0 mt-1">
                <Lock className="w-5 h-5 text-foreground/60" />
              </div>
              <div>
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-2">Your Privacy</p>
                <h2 className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-[0.95] mb-4">
                  HIPAA &amp; Your Health Data
                </h2>
              </div>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: 'What We Collect',
                  body: 'Health intake information, session records, and any clinical notes from your RN. We collect only what is necessary to deliver safe, personalized care.',
                },
                {
                  title: 'How It\'s Stored',
                  body: 'All health records are stored on HIPAA-compliant infrastructure with encryption at rest and in transit. Access is limited to your care team and authorized clinical staff.',
                },
                {
                  title: 'Your Rights',
                  body: 'You may request a copy of your health record at any time. You may request corrections, restrict certain uses, or request deletion where legally permitted.',
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                >
                  <p className="font-heading text-xl text-foreground uppercase mb-3">{item.title}</p>
                  <p className="font-body text-sm text-foreground/65 leading-relaxed">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Medical Oversight */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...REVEAL}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10"
            >
              <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">Medical Oversight</p>
              <h2 className="font-heading text-3xl md:text-4xl text-foreground uppercase leading-[0.95] mb-5">
                Physician-Reviewed Protocols
              </h2>
              <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl">
                All protocols are developed and reviewed under physician oversight. Individual sessions are conducted by licensed registered nurses. No Avalon formulation reaches a client until it has been reviewed and approved by our medical director.
              </p>
            </motion.div>
          </div>
        </Reveal>

        {/* FAQ */}
        <Reveal as="section" className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Common Questions
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
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

        {/* Footer links */}
        <Reveal as="section" className="py-12 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-6">
            <Link to="/medical-direction" className="font-body text-sm text-foreground/50 hover:text-foreground transition-colors duration-200">
              Medical Direction →
            </Link>
            <Link to="/ingredients" className="font-body text-sm text-foreground/50 hover:text-foreground transition-colors duration-200">
              Ingredient Glossary →
            </Link>
          </div>
        </Reveal>

      </main>
      <Footer />
    </div>
  );
}
