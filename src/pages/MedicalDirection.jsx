import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Stethoscope, ClipboardCheck, UserCheck, Scale, ArrowLeft } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: EASE },
};

const PILLARS = [
  {
    icon: ClipboardCheck,
    title: 'Physician Developed',
    desc: 'All IV protocols are developed, reviewed, and approved by our medical director before any formulation is offered to clients. Nothing reaches the field without sign-off.',
  },
  {
    icon: UserCheck,
    title: 'Standing Orders',
    desc: 'RNs conduct sessions under standing orders reviewed and maintained by the medical director. Standing orders are updated as clinical evidence evolves.',
  },
  {
    icon: Stethoscope,
    title: 'Available for Consultation',
    desc: 'Physician availability is maintained during all Avalon operating hours. RNs can escalate any clinical concern in real time.',
  },
];

const PROTOCOL_STEPS = [
  {
    step: '01',
    title: 'Formulation Review',
    desc: 'Each ingredient and concentration is reviewed for safety, sourcing, and compatibility before a protocol is approved. No formulation is final until the medical director signs off.',
  },
  {
    step: '02',
    title: 'Standing Order Issuance',
    desc: 'Approved protocols are issued as standing orders to the RN team. Orders define dosage ranges, administration parameters, and contraindication criteria.',
  },
  {
    step: '03',
    title: 'Continuous Audit',
    desc: 'Active protocols are audited on a rolling basis against current clinical literature. Modifications are reflected in updated standing orders and communicated to the care team.',
  },
];

// Full standalone medical direction page. FDA-safe throughout — frames
// oversight and methodology, not therapeutic outcomes.
export default function MedicalDirection() {
  useSeo({ title: 'Medical Direction — Avalon Vitality', description: 'Avalon Vitality operates under licensed physician medical direction for all IV therapy protocols.', path: '/medical-direction' });
  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Clinical Governance
            </motion.p>
            <motion.h1
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
            >
              Medical Direction
            </motion.h1>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
              className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl"
            >
              Every protocol reviewed. Every session supervised. Clinical oversight is not optional — it is foundational.
            </motion.p>
          </div>
        </section>

        {/* Oversight Model */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              How It Works
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-4"
            >
              Oversight Model
            </motion.h2>
            <motion.p
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.14 }}
              className="font-body text-sm md:text-base text-foreground/60 leading-relaxed max-w-2xl mb-12"
            >
              Avalon operates under the oversight of a licensed physician medical director. This is not a checkbox — it shapes every protocol, every standing order, and every session.
            </motion.p>

            <div className="grid md:grid-cols-3 gap-6">
              {PILLARS.map((pillar, i) => {
                const Icon = pillar.icon;
                return (
                  <motion.div
                    key={pillar.title}
                    {...REVEAL}
                    transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                    className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-5">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <p className="font-heading text-xl text-foreground uppercase mb-3">{pillar.title}</p>
                    <p className="font-body text-sm text-foreground/60 leading-relaxed">{pillar.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Medical Director Card */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Leadership
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-10"
            >
              Medical Director
            </motion.h2>

            <motion.div
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.14 }}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 flex flex-col md:flex-row gap-8 items-start"
            >
              {/* Photo placeholder */}
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-foreground/[0.06] border border-foreground/[0.08] flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-8 h-8 text-foreground/20" />
              </div>

              <div className="flex-1">
                <div className="inline-block px-3 py-1 rounded-full border border-foreground/[0.12] bg-foreground/[0.04] mb-4">
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40">Medical Director</p>
                </div>
                <p className="font-heading text-2xl md:text-3xl text-foreground uppercase leading-tight mb-2">
                  Name Pending Announcement
                </p>
                <p className="font-body text-sm text-foreground/40 mb-4">Credentials pending announcement</p>
                <p className="font-body text-sm text-foreground/60 leading-relaxed max-w-xl">
                  Our medical director oversees all clinical protocols, reviews every formulation, and maintains physician-level availability throughout Avalon operating hours. Full announcement coming soon.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* State Licensing */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...REVEAL}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-10 flex flex-col md:flex-row gap-6 md:gap-10 items-start"
            >
              <div className="w-10 h-10 rounded-full bg-foreground/[0.06] flex items-center justify-center flex-shrink-0">
                <Scale className="w-5 h-5 text-foreground/60" />
              </div>
              <div>
                <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-2">State Licensing</p>
                <h2 className="font-heading text-2xl md:text-3xl text-foreground uppercase leading-[0.95] mb-4">
                  California Compliance
                </h2>
                <p className="font-body text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl">
                  Avalon operates in compliance with California Board of Registered Nursing regulations. All RNs hold current California RN licenses. Licensure is verified before employment and maintained on file. We do not operate outside our licensed scope.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Protocol Review Process */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.p {...REVEAL} className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
              Protocol Methodology
            </motion.p>
            <motion.h2
              {...REVEAL}
              transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              className="font-heading text-3xl md:text-5xl text-foreground uppercase leading-[0.95] mb-12"
            >
              How Protocols Are Built
            </motion.h2>

            <div className="space-y-6">
              {PROTOCOL_STEPS.map((step, i) => (
                <motion.div
                  key={step.step}
                  {...REVEAL}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
                  className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start"
                >
                  <p className="font-heading text-4xl text-foreground/15 leading-none flex-shrink-0 w-12">{step.step}</p>
                  <div>
                    <p className="font-heading text-xl md:text-2xl text-foreground uppercase mb-3">{step.title}</p>
                    <p className="font-body text-sm text-foreground/60 leading-relaxed max-w-2xl">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer links */}
        <section className="py-12 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-6">
            <Link to="/safety" className="font-body text-sm text-foreground/50 hover:text-foreground transition-colors duration-200">
              Safety Standards →
            </Link>
            <Link to="/team" className="font-body text-sm text-foreground/50 hover:text-foreground transition-colors duration-200 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Our Team
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
