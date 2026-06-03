import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '../landing/Navbar';
import Footer from '../landing/Footer';
import { slugify } from '@/data/products';
import GlassCard from '@/components/ui/GlassCard';

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
      <section className="relative flex min-h-[34rem] items-end justify-start overflow-hidden md:min-h-[calc(100svh-7rem)]">
        {heroImage && (
          <div className="absolute inset-0">
            <img src={heroImage} alt={title} loading="eager" fetchPriority="high" decoding="async" className={imgClass} />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}
        <div className="relative z-10 px-6 pb-8 md:px-16 md:pb-14">
          {badge && (
            <p className="text-xs tracking-[0.3em] text-accent font-body uppercase mb-2">{badge}</p>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-heading text-[clamp(4rem,17vw,8rem)] uppercase leading-[0.86] tracking-normal text-foreground"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <p className="mt-3 max-w-xl font-body text-sm font-semibold uppercase tracking-[0.18em] text-foreground/58">{subtitle}</p>
          )}
        </div>
      </section>

      {/* Description */}
      {description && (
        <section className="px-6 py-4 md:px-16 md:py-6">
          <GlassCard tone="soft" radius="1.55rem" className="mx-auto max-w-6xl p-5 md:p-6">
            <p className="relative max-w-3xl font-body text-sm font-semibold leading-relaxed text-foreground/62 md:text-base">{description}</p>
          </GlassCard>
        </section>
      )}

      {/* Treatments grid OR Coming Soon block */}
      {comingSoon ? (
        <section className="px-6 py-20 md:px-16">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4">
              Joining after launch
            </p>
            <h2 className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-5 leading-none">
              Not yet available
            </h2>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              {comingSoonNote || "This protocol is not live yet. Browse the active protocol set to see what is available today."}
            </p>
          </div>
        </section>
      ) : (
        <section className="px-6 py-6 md:px-16 md:py-10">
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
                          loading="lazy"
                          decoding="async"
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
                  className="av-glass-card group relative overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/38 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-xl transition-colors hover:border-foreground/24 hover:bg-background/54"
                >
                  {href ? (
                      <Link to={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[1.35rem]">
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
