import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../landing/Navbar';
import Footer from '../landing/Footer';

const BOOK_URL = 'https://avalonvitality.as.me/schedule/a9d85b1e';

export default function ServicePageLayout({ title, subtitle, description, treatments, heroImage, badge }) {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative h-[50vh] flex items-end justify-start overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt={title} className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="relative z-10 px-6 md:px-16 pb-14">
          {badge && (
            <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-2">{badge}</p>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-heading text-6xl md:text-[8rem] text-foreground tracking-wide leading-none"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <p className="font-body text-sm text-muted-foreground mt-3 tracking-widest uppercase">{subtitle}</p>
          )}
        </div>
      </section>

      {/* Description */}
      {description && (
        <section className="py-12 px-6 md:px-16 border-b border-border">
          <div className="max-w-2xl">
            <p className="font-body text-base text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </section>
      )}

      {/* Treatments grid */}
      <section className="py-16 px-6 md:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {treatments.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="border border-border rounded bg-card overflow-hidden group hover:border-accent/40 transition-colors"
              >
                {t.image && (
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={t.image}
                      alt={t.name}
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-heading text-xl md:text-2xl text-foreground tracking-wide mb-1">{t.name}</h3>
                  {t.desc && <p className="font-body text-xs text-muted-foreground leading-relaxed mb-3">{t.desc}</p>}
                  <div className="flex items-center justify-between">
                    <span className="font-body text-base font-semibold text-foreground">{t.price}</span>
                    <a
                      href={BOOK_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] tracking-[0.2em] text-accent hover:text-accent/70 font-body uppercase transition-colors"
                    >
                      Book →
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 text-center border-t border-border">
        <a
          href={BOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-10 py-4 bg-foreground text-background font-body text-sm tracking-widest uppercase font-semibold hover:bg-foreground/90 transition-colors rounded"
        >
          Book Online
        </a>
      </section>

      <Footer />
    </div>
  );
}