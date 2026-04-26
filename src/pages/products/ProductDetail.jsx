import React from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Droplet } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { getProduct } from '@/data/products';

// Avalon easing — matches project non-negotiable.
const EASE = [0.16, 1, 0.3, 1];

// Pricing rows shared with ServicePageLayout card. Kept in sync by shape.
function PricingRows({ t }) {
  const rows = [];

  if (t.oneTime) {
    rows.push(
      <div key="oneTime" className="flex items-baseline gap-3">
        <span className="font-heading text-4xl text-foreground">{t.oneTime}</span>
        <span className="font-body text-xs tracking-wider uppercase text-muted-foreground">One-time</span>
      </div>
    );
  }
  if (t.price) {
    rows.push(
      <div key="price" className="flex items-baseline gap-3">
        <span className="font-heading text-4xl text-foreground">{t.price}</span>
        <span className="font-body text-xs tracking-wider uppercase text-muted-foreground">Per session</span>
      </div>
    );
  }

  // annualPrice field holds the per-unit MONTHLY member rate (already 20% off session).
  // Annual membership = monthly × 12, flat.
  if (t.annualPrice) {
    rows.push(
      <div key="monthlyFromAnnual" className="flex items-baseline gap-3">
        <span className="font-heading text-2xl text-accent">{t.annualPrice}</span>
        <span className="font-body text-xs tracking-wider uppercase text-muted-foreground">Monthly member</span>
      </div>
    );
    const n = parseFloat(String(t.annualPrice).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n)) {
      const annual = Math.round(n * 12);
      rows.push(
        <div key="annualComputed" className="flex items-baseline gap-3">
          <span className="font-heading text-2xl text-foreground">${annual.toLocaleString()}</span>
          <span className="font-body text-xs tracking-wider uppercase text-muted-foreground">Annual member</span>
        </div>
      );
    }
  }

  if (t.monthly) {
    rows.push(
      <div key="monthly" className="flex items-baseline gap-3">
        <span className="font-heading text-2xl text-accent">{t.monthly}</span>
        <span className="font-body text-xs tracking-wider uppercase text-muted-foreground">Monthly member</span>
      </div>
    );
  }
  if (t.annual) {
    rows.push(
      <div key="annual" className="flex items-baseline gap-3">
        <span className="font-heading text-2xl text-foreground">{t.annual}</span>
        <span className="font-body text-xs tracking-wider uppercase text-muted-foreground">Annual member</span>
      </div>
    );
  }

  return <div className="space-y-3">{rows}</div>;
}

export default function ProductDetail() {
  const { category, slug } = useParams();
  const match = getProduct(category, slug);

  if (!match) {
    return (
      <div className="bg-background min-h-screen">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-3">Not found</p>
          <h1 className="font-heading text-4xl md:text-5xl text-foreground tracking-wide mb-4">
            We couldn't find that product
          </h1>
          <Link
            to="/"
            className="mt-4 inline-block px-8 py-3 bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold rounded-full hover:bg-foreground/90 transition-colors"
          >
            Back to home
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { category: cat, treatment: t } = match;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-12 px-6 md:px-16 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mb-8"
          >
            <Link
              to={cat.backTo}
              className="inline-flex items-center gap-2 text-accent hover:text-accent/80 text-[11px] font-body uppercase tracking-[0.2em]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {cat.backLabel}
            </Link>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="aspect-square rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-md"
            >
              {t.image && (
                <img src={t.image} alt={t.name} className="w-full h-full object-contain bg-black" />
              )}
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            >
              <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-3">
                {cat.categoryLabel}
              </p>
              <h1 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide leading-none mb-5">
                {t.name}
              </h1>
              {t.desc && (
                <p className="font-body text-base text-muted-foreground leading-relaxed mb-8">
                  {t.desc}
                </p>
              )}

              <div className="mb-10">
                <PricingRows t={t} />
              </div>

              <div className="flex items-center gap-3 mb-10 pb-8">
                <Droplet className="w-4 h-4 text-accent" strokeWidth={1.5} />
                <span className="font-body text-xs tracking-[0.2em] uppercase text-muted-foreground">
                  Direct IV · Administered by a licensed clinician
                </span>
              </div>

              <Link
                to="/apply"
                className="inline-block w-full text-center px-8 py-4 bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold rounded-full hover:bg-foreground/90 transition-colors"
              >
                Apply for Membership
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Context block — brief educational framing from the category */}
      {cat.description && (
        <section className="py-16 px-6 md:px-16 border-b border-border">
          <div className="max-w-3xl mx-auto">
            <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4">
              About {cat.categoryLabel}
            </p>
            <p className="font-body text-base text-foreground leading-relaxed">
              {cat.description}
            </p>
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <section className="py-12 px-6 md:px-16">
        <div className="max-w-4xl mx-auto">
          <p className="font-body text-[11px] text-muted-foreground/60 text-center leading-relaxed">
            Educational content only — not intended to diagnose, treat, cure, or prevent any condition.
            Administered by California-licensed clinicians under physician supervision.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
