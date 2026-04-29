import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { productsByCategory, slugify } from '@/data/products';

// Legacy route at /products/iv-vitamins. Kept as an alternate catalog view,
// now sourced from the single shared IV Vitamins catalog so every card
// resolves at /products/iv-vitamins/:slug via ProductDetail.
export default function IVVitaminsCategory() {
  const cat = productsByCategory['iv-vitamins'];

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-16 px-4 border-b border-border">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4">Wellness Foundation</p>
            <h1 className="font-heading text-6xl md:text-8xl text-foreground tracking-wide mb-6">{cat.title}</h1>
            <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {cat.description}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cat.treatments.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={`/products/iv-vitamins/${slugify(t.name)}`}
                  className="group block h-full border border-white/15 bg-white/[0.03] backdrop-blur-md rounded-3xl overflow-hidden hover:border-accent/50 hover:bg-white/[0.06] transition-all duration-500"
                >
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={t.image}
                      alt={t.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  </div>
                  <div className="p-6">
                    {t.oneTime && (
                      <p className="text-[10px] tracking-[0.2em] text-accent font-body uppercase mb-2">
                        {t.oneTime} <span className="text-muted-foreground">session</span>
                      </p>
                    )}
                    <h3 className="font-heading text-2xl text-foreground tracking-wide mb-2">{t.name}</h3>
                    {t.desc && (
                      <p className="font-body text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
