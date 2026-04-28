import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../landing/Navbar';
import Footer from '../landing/Footer';
import { slugify } from '@/data/products';

export default function ServicePageLayout({
  title,
  subtitle,
  description,
  treatments,
  heroImage,
  heroImgClassName,
  badge,
  comingSoon = false,
  comingSoonNote,
  categorySlug,
}) {
  const imgClass = heroImgClassName || 'w-full h-full object-cover opacity-40';
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative h-[32vh] md:h-[50vh] flex items-end justify-start overflow-hidden">
        {heroImage && (
          <div className="absolute inset-0">
            <img src={heroImage} alt={title} className={imgClass} />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}
        <div className="relative z-10 px-6 md:px-16 pb-6 md:pb-14">
          {badge && (
            <p className="text-xs tracking-[0.3em] text-accent font-body uppercase mb-2">{badge}</p>
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
        <section className="py-6 md:py-12 px-6 md:px-16 border-b border-border">
          <div className="max-w-2xl">
            <p className="font-body text-sm md:text-base text-foreground leading-relaxed">{description}</p>
          </div>
        </section>
      )}

      {/* Treatments grid OR Coming Soon block */}
      {comingSoon ? (
        <section className="py-20 px-6 md:px-16">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4">
              Joining after launch
            </p>
            <h2 className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-5 leading-none">
              Not yet available
            </h2>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              {comingSoonNote || "This protocol isn't part of our launch menu yet. Browse the live treatments to see what's available today."}
            </p>
          </div>
        </section>
      ) : (
        <section className="py-8 md:py-16 px-6 md:px-16">
          <div className="max-w-6xl mx-auto">

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {treatments.map((t, i) => {
                const href = categorySlug ? `/products/${categorySlug}/${slugify(t.name)}` : null;
                const CardBody = (
                  <>
                    {t.image && (
                      <div className="aspect-square overflow-hidden bg-background flex items-center justify-center">
                        <img
                          src={t.image}
                          alt={t.name}
                          className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    )}
                    <div className="p-5">
                       <h3 className="font-heading text-xl md:text-2xl text-foreground tracking-wide mb-1">{t.name}</h3>
                       {t.desc && <p className="font-body text-xs text-muted-foreground leading-relaxed mb-3">{t.desc}</p>}
                       <div className="space-y-1">
                         {t.oneTime && <div className="font-body text-sm text-foreground">{t.oneTime} <span className="text-xs text-muted-foreground">one-time</span></div>}
                         {t.price && <div className="font-body text-sm text-foreground">{t.price} <span className="text-xs text-muted-foreground">session</span></div>}
                         {/* annualPrice in product data holds the per-unit monthly member rate
                             (already 20% off session). Annual membership = monthly × 12, flat. */}
                         {t.annualPrice && <div className="font-body text-sm text-accent">{t.annualPrice} <span className="text-xs text-muted-foreground">monthly</span></div>}
                         {t.annualPrice && (() => {
                           const n = parseFloat(String(t.annualPrice).replace(/[^0-9.]/g, ''));
                           if (!Number.isFinite(n)) return null;
                           const annual = Math.round(n * 12);
                           return (
                             <div className="font-body text-sm text-foreground">
                               ${annual.toLocaleString()} <span className="text-xs text-muted-foreground">annual member</span>
                             </div>
                           );
                         })()}
                         {t.monthly && <div className="font-body text-sm text-accent">{t.monthly} <span className="text-xs text-muted-foreground">monthly</span></div>}
                         {t.annual && <div className="font-body text-sm text-foreground">{t.annual} <span className="text-xs text-muted-foreground">annual member</span></div>}
                       </div>
                     </div>
                  </>
                );

                return (
                  <motion.div
                    key={t.name}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    className="border border-white/10 bg-white/[0.03] backdrop-blur-md rounded-3xl overflow-hidden group hover:border-accent/50 hover:bg-white/[0.06] transition-all"
                  >
                    {href ? (
                      <Link to={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-3xl">
                        {CardBody}
                      </Link>
                    ) : (
                      CardBody
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}



      <Footer />
    </div>
  );
}