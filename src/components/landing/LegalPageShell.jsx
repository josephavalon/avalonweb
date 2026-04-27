import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const EASE = [0.16, 1, 0.3, 1];

// Reusable shell for every legal page (Privacy, Terms, HIPAA, Cookie, Telehealth, Product Disclaimer)
export default function LegalPageShell({ eyebrow = 'Legal', title, lastUpdated, intro, sections = [], related = [] }) {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      <section className="py-16 md:py-24 px-6 md:px-16">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="text-left mb-10 md:mb-14"
          >
            <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-3 md:mb-4">{eyebrow}</p>
            <h1 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] uppercase">
              {title}
            </h1>
            {lastUpdated && (
              <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mt-4">
                Last updated: {lastUpdated} · Applies to California residents
              </p>
            )}
            {intro && (
              <div className="mt-6 space-y-3">
                {intro.map((p, i) => (
                  <p key={i} className="font-body text-sm md:text-base text-foreground/85 leading-relaxed">{p}</p>
                ))}
              </div>
            )}
          </motion.div>

          <div className="space-y-6 md:space-y-8">
            {sections.map((s, i) => (
              <motion.div
                key={s.h}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.5, delay: 0.04 + i * 0.02, ease: EASE }}
                className="border border-white/10 bg-white/[0.03] backdrop-blur-md rounded-2xl p-6 md:p-8"
              >
                <h2 className="font-heading text-lg md:text-xl text-foreground tracking-wide uppercase mb-4">
                  {s.h}
                </h2>
                <div className="space-y-3">
                  {s.p.map((para, j) => (
                    <p key={j} className="font-body text-sm md:text-base text-foreground/85 leading-relaxed">
                      {para}
                    </p>
                  ))}
                  {s.list && (
                    <ul className="font-body text-sm md:text-base text-foreground/85 leading-relaxed list-disc pl-5 space-y-1">
                      {s.list.map((li, k) => <li key={k}>{li}</li>)}
                    </ul>
                  )}
                </div>
              </motion.div>
            ))}

            {related.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
                className="pt-6 flex flex-wrap gap-x-3 gap-y-2 text-[10px] md:text-xs tracking-[0.25em] uppercase font-body"
              >
                {related.map((r, i) => (
                  <React.Fragment key={r.to}>
                    <Link to={r.to} className="text-muted-foreground hover:text-accent transition-colors">{r.label}</Link>
                    {i < related.length - 1 && <span className="text-foreground/30">·</span>}
                  </React.Fragment>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
