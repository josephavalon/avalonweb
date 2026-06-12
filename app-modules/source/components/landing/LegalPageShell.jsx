import React from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link, useLocation } from 'react-router-dom';
import Navbar from '../../../../src/components/landing/Navbar';
import Footer from '../../../../src/components/landing/Footer';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Reusable shell for every legal page (Privacy, Terms, HIPAA, Cookie, Telehealth, Product Disclaimer)
export default function LegalPageShell({ title, lastUpdated, intro, sections = [], related = [] }) {
  const { pathname } = useLocation();
  const introText = intro?.[0] || sections?.[0]?.p?.[0] || `${title} for Avalon Vitality.`;

  useSeo({
    title: `${title} — Avalon Vitality`,
    description: introText.slice(0, 155),
    path: pathname,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${title} — Avalon Vitality`,
      description: introText,
      url: `https://www.avalonvitality.co${pathname}`,
      dateModified: lastUpdated,
    },
  });

  return (
    <div className="av-page-surface min-h-screen">
      <Navbar />

      <section className="px-4 pb-10 pt-24 md:px-10 md:pb-16 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mb-5 rounded-[1.75rem] border border-foreground/[0.10] bg-background/68 p-5 shadow-[0_28px_110px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl md:mb-8 md:p-8"
          >
            <div className="grid gap-6 md:grid-cols-[1.1fr_0.7fr] md:items-end">
              <div>
                <h1 className="font-heading text-[3.5rem] uppercase leading-[0.84] tracking-tight text-foreground md:text-[6.6rem]">
                  {title}
                </h1>
              </div>
              <div className="md:text-right">
                {lastUpdated && (
                  <p className="font-body text-[11px] uppercase tracking-[0.22em] text-foreground/48">
                    Last updated
                  </p>
                )}
                {lastUpdated && (
                  <p className="mt-1 font-body text-sm text-foreground/62">
                    {lastUpdated}
                  </p>
                )}
                <p className="mt-3 font-body text-xs leading-relaxed text-foreground/42">
                  California services.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-foreground/[0.08] pt-5">
              <p className="max-w-3xl font-body text-sm leading-relaxed text-foreground/68 md:text-base">
                {introText}
              </p>
              {intro && intro.length > 1 && (
                <div className="mt-4 hidden space-y-3 md:block">
                  {intro.slice(1).map((p, i) => (
                    <p key={i} className="font-body text-sm leading-relaxed text-foreground/72 md:text-base">{p}</p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-[18rem_1fr] lg:items-start">
            <motion.aside
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
              className="av-motion-rail hidden rounded-2xl border border-foreground/[0.10] bg-background/82 p-4 shadow-[0_18px_70px_hsl(var(--foreground)/0.055)] backdrop-blur-xl lg:sticky lg:top-24 lg:block"
            >
              <p className="mb-3 font-body text-[10px] uppercase tracking-[0.3em] text-foreground/48">On this page</p>
              <div className="grid grid-cols-1 gap-1.5">
                {sections.slice(0, 10).map((s) => (
                  <motion.a
                    key={s.h}
                    href={`#${slugify(s.h)}`}
                    whileHover={{ x: 3 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex min-h-11 items-center rounded-lg px-3 py-2 font-body text-xs leading-tight text-foreground/72 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    {s.h.replace(/^\d+\.\s*/, '')}
                  </motion.a>
                ))}
              </div>

              {related.length > 0 && (
                <div className="mt-5 border-t border-foreground/[0.08] pt-4">
                  <p className="mb-3 font-body text-[10px] uppercase tracking-[0.3em] text-foreground/48">Related</p>
                  <div className="grid gap-1.5">
                    {related.map((r) => (
                      <Link key={r.to} to={r.to} className="flex min-h-11 items-center rounded-lg px-3 py-2 font-body text-xs text-foreground/72 transition-colors hover:bg-foreground/[0.04] hover:text-foreground">
                        {r.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </motion.aside>

            <div className="space-y-3 md:space-y-4">
              {sections.map((s, i) => (
                <motion.section
                  id={slugify(s.h)}
                  key={s.h}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-10%' }}
                  transition={{ duration: 0.5, delay: 0.04 + i * 0.015, ease: EASE }}
                  className="av-glass-sweep relative scroll-mt-28 overflow-hidden rounded-2xl border border-foreground/[0.08] bg-background/82 p-5 shadow-[0_18px_70px_hsl(var(--foreground)/0.045)] backdrop-blur-xl md:p-6"
                >
                  <h2 className="mb-4 font-heading text-2xl uppercase leading-none tracking-tight text-foreground md:text-3xl">
                    {s.h}
                  </h2>
                  <div className="space-y-3">
                    {s.p.map((para, j) => (
                      <p key={j} className="font-body text-sm leading-relaxed text-foreground/66 md:text-[15px]">
                        {para}
                      </p>
                    ))}
                    {s.list && (
                      <ul className="space-y-2 pl-5 font-body text-sm leading-relaxed text-foreground/66 md:text-[15px]">
                        {s.list.map((li, k) => <li className="list-disc" key={k}>{li}</li>)}
                      </ul>
                    )}
                  </div>
                </motion.section>
              ))}

              {related.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
                  className="flex flex-wrap gap-2 pt-5"
                >
                  {related.map((r) => (
                    <Link
                      key={r.to}
                      to={r.to}
                      className="inline-flex min-h-11 items-center rounded-full border border-foreground/[0.10] px-4 py-2 font-body text-[10px] uppercase tracking-[0.2em] text-foreground/68 transition-colors hover:border-foreground/25 hover:text-foreground"
                    >
                      {r.label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
