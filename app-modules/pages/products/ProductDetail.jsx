import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, ChevronDown,
  ShieldCheck, Truck, UserRoundCheck,
} from 'lucide-react';

import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/context/CartContext';
import { getProduct } from '@/data/products';
import { useSeo } from '@/lib/seo';
import { appendActivity } from '@/lib/localOs';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import { buildProductJsonLd } from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

function priceNumber(value) {
  const number = Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function productPrice(product) {
  return product.oneTime || product.price || '$250';
}

function ProductMedia({ product, compact = false }) {
  const reduceMotion = useReducedMotion();
  const { image, motionVideo, name } = product;
  const transparentMedia = product.transparentMedia || image?.includes('-cutout.');
  const mediaPadding = compact ? (transparentMedia ? 'p-0' : 'p-2') : (transparentMedia ? 'p-2' : 'p-5');

  if (motionVideo) {
    return (
      <video
        src={motionVideo}
        poster={image}
        autoPlay
        muted
        loop
        playsInline
        className={`h-full w-full object-contain ${mediaPadding}`}
        aria-label={name}
      />
    );
  }

  return image ? (
    <motion.img
      src={image}
      alt={name}
      className={`h-full w-full object-contain drop-shadow-[0_22px_42px_rgba(41,31,21,0.20)] ${mediaPadding}`}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.992 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.006 }}
      transition={{ duration: 0.72, ease: EASE }}
    />
  ) : (
    <div className="flex h-full items-center justify-center px-10 text-center">
      <div>
        <p className="font-heading text-4xl tracking-[0.12em] text-foreground">AVALON</p>
        <p className="font-body text-[10px] tracking-[0.48em] text-foreground/40">VITALITY</p>
        <p className="mt-8 font-body text-xs uppercase tracking-[0.24em] text-foreground/45">{name}</p>
      </div>
    </div>
  );
}

function ProductBag({ product }) {
  return (
    <div className="relative isolate aspect-[0.78] min-h-[30rem] overflow-hidden rounded-[1.75rem] border border-foreground/12 bg-card/82 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_42%_18%,rgba(244,230,203,0.13),transparent_34%),radial-gradient(circle_at_70%_92%,rgba(184,127,44,0.10),transparent_44%)]" />
      <div className="relative h-full overflow-hidden rounded-[1.25rem] border border-foreground/10 bg-foreground/90">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/3 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),transparent)]" />
        <ProductMedia product={product} />
      </div>
    </div>
  );
}

function TrustItem({ icon: Icon, title, sub }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center md:flex-row md:text-left">
      <Icon className="h-4 w-4 shrink-0 text-foreground/55" strokeWidth={1.6} />
      <div className="min-w-0 max-w-full">
        <p className="font-body text-[9px] font-semibold leading-tight text-foreground md:text-[10px]">{title}</p>
        <p className="hidden font-body text-[9px] leading-tight text-foreground/40 sm:block">{sub}</p>
      </div>
    </div>
  );
}

function AccordionRow({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-foreground/[0.10]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-body text-sm font-semibold text-foreground">{title}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.28, ease: EASE }}>
          <ChevronDown className="h-4 w-4 text-foreground/45" strokeWidth={1.8} />
        </motion.span>
      </button>
      <SmoothDisclosure open={open}>
        <div className="pb-5 font-body text-sm leading-relaxed text-foreground/55">
          {children}
        </div>
      </SmoothDisclosure>
    </div>
  );
}

function includedFor(product) {
  if (product.name.toLowerCase().includes('myers')) {
    return ['B-complex vitamins', 'Vitamin C', 'Magnesium', 'Calcium', 'Zinc', 'IV fluids'];
  }
  if (product.name.toLowerCase().includes('nad')) return ['NAD+', 'IV fluids', 'B-complex support'];
  if (product.name.toLowerCase().includes('cbd')) return ['Zero-THC CBD', 'IV fluids', 'Clinician-guided dose'];
  if (product.name.toLowerCase().includes('beauty')) return ['Glutathione', 'Biotin', 'Vitamin C', 'B-complex'];
  if (product.name.toLowerCase().includes('immunity')) return ['Vitamin C', 'Zinc', 'Glutathione', 'IV fluids'];
  return ['IV fluids', 'Electrolytes', 'B-complex vitamins', 'Clinician-guided support'];
}

function protocolKeyForProduct(product = {}) {
  const name = String(product.name || '').toLowerCase();
  if (name.includes('nad')) return 'nad';
  if (name.includes('cbd')) return 'cbd';
  if (name.includes('myers')) return 'myers';
  if (name.includes('dehydration') || name.includes('hydration')) return 'hydration';
  if (name.includes('immunity') || name.includes('immune')) return 'immunity';
  if (name.includes('beauty') || name.includes('glow')) return 'beauty';
  if (name.includes('travel')) return 'jetlag';
  if (name.includes('performance') || name.includes('energy')) return 'energy';
  return 'recovery';
}

export default function ProductDetail() {
  const { category, slug } = useParams();
  const match = getProduct(category, slug);
  const navigate = useNavigate();
  const { clearItems, addItem } = useCart();

  const price = useMemo(() => productPrice(match?.treatment || {}), [match]);
  const numericPrice = useMemo(() => priceNumber(price), [price]);

  useSeo({
    title: match ? `${match.treatment.name} — Avalon Vitality` : 'Product Not Found — Avalon Vitality',
    description: match?.treatment.desc || 'Avalon Vitality mobile IV therapy product page.',
    path: match ? `/products/${category}/${slug}` : undefined,
    jsonLd: match ? buildProductJsonLd({ category: match.category, categorySlug: category, product: match.treatment, slug, price: numericPrice }) : undefined,
  });

  if (!match) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
          <h1 className="font-heading text-5xl uppercase leading-none text-foreground">Product missing</h1>
          <Link to="/protocols" className="mt-8 rounded-full bg-foreground px-8 py-4 font-body text-xs font-semibold uppercase tracking-[0.22em] text-background">
            Browse Protocols
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { category: cat, treatment } = match;
  const included = includedFor(treatment);

  const buyNow = () => {
    clearItems();
    addItem({
      cartKey: slug,
      label: treatment.name,
      price: numericPrice,
      type: category === 'iv-vitamins' ? 'iv' : 'addon',
    });
    appendActivity(`Added product to checkout: ${treatment.name}`, { role: 'client', product: slug });
    navigate(`/book?protocol=${encodeURIComponent(protocolKeyForProduct(treatment))}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="px-4 pb-36 pt-24 md:px-8 md:pb-16 md:pt-28">
        <div className="mx-auto max-w-7xl">
          <Link
            to={cat.backTo}
            className="mb-6 inline-flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.24em] text-foreground/45 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {cat.backLabel}
          </Link>

          <section className="grid gap-6 md:grid-cols-[0.84fr_1fr] md:gap-12 lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.58, ease: EASE }}
              className="hidden md:block"
            >
              <ProductBag product={treatment} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.58, ease: EASE, delay: 0.06 }}
              className="md:pt-3"
            >
              <div className="relative min-h-[22rem] overflow-hidden rounded-[1.75rem] border border-foreground/12 bg-card/88 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl md:hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(244,230,203,0.13),transparent_36%),radial-gradient(circle_at_90%_75%,rgba(184,127,44,0.12),transparent_45%)]" />
                <div className="relative z-10 max-w-[53%]">
                  <h1 className="font-heading text-[clamp(2.2rem,10vw,3rem)] uppercase leading-[0.86] tracking-tight text-foreground [overflow-wrap:normal] [word-break:normal]">
                    {treatment.name}
                  </h1>
                  <p className="mt-3 font-body text-[11px] leading-relaxed text-foreground/58">
                    {treatment.desc || cat.description}
                  </p>
                  <p className="mt-5 font-heading text-2xl text-foreground">{price}</p>
                </div>
                <div className="absolute bottom-4 right-4 h-[76%] w-[43%] overflow-hidden rounded-[1.1rem] border border-foreground/12 bg-foreground/90">
                  <ProductMedia product={treatment} compact />
                </div>
              </div>

              <div className="hidden md:block">

                <h1 className="font-heading text-5xl uppercase leading-[0.9] tracking-tight text-foreground md:text-7xl">
                  {treatment.name}
                </h1>

                <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-foreground/62">
                  {treatment.desc || cat.description}
                </p>

                <p className="mt-7 font-heading text-3xl text-foreground">{price}</p>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 border-y border-foreground/[0.10] py-4 md:mt-8 md:gap-4 md:py-5">
                <TrustItem icon={Truck} title="Flat pricing" sub="No surprise fees" />
                <TrustItem icon={UserRoundCheck} title="Licensed RN" sub="Clinician delivered" />
                <TrustItem icon={ShieldCheck} title="Medical oversight" sub="Your safety first" />
              </div>

              <div className="mt-7 hidden gap-3 sm:grid-cols-2 md:grid">
                <button
                  type="button"
                  onClick={buyNow}
                  className="flex items-center justify-center gap-2 rounded-md bg-foreground px-7 py-4 font-body text-xs font-semibold uppercase tracking-[0.18em] text-background transition-colors hover:bg-foreground/88"
                >
                  Buy Now <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
                <Link
                  to="/subscription"
                  className="flex items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-7 py-4 font-body text-xs font-semibold uppercase tracking-[0.14em] text-background shadow-[0_14px_34px_hsl(var(--foreground)/0.10)] transition-colors hover:bg-foreground/90"
                >
                  View Plans
                </Link>
              </div>

              <div className="mt-8 overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-white/[0.035] px-5 backdrop-blur-xl">
                <AccordionRow title="What's Included">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {included.map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-foreground/45" strokeWidth={1.7} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </AccordionRow>
                <AccordionRow title="How It Works">
                  <p>
                    Book. A California-licensed RN arrives after clinical approval.
                  </p>
                </AccordionRow>
                <AccordionRow title="Clinical Oversight">
                  <p>
                    Licensed clinician. Medical protocols. Clinical review required.
                  </p>
                </AccordionRow>
                <AccordionRow title="FAQ">
                  <p>
                    Most sessions take 30-60 minutes. Same-day depends on location, nurse coverage, and clinical clearance.
                  </p>
                </AccordionRow>
              </div>
            </motion.div>
          </section>

          <p className="mx-auto mt-10 max-w-3xl text-center font-body text-[10px] leading-relaxed text-foreground/30">
            Educational content only. Avalon Vitality provides wellness and recovery support and does not diagnose,
            treat, cure, or prevent disease. Services are subject to clinical approval.
          </p>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/[0.10] bg-background/92 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-18px_45px_rgba(20,15,10,0.16)] backdrop-blur-2xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[1fr_0.72fr] gap-2">
          <button
            type="button"
            onClick={buyNow}
            className="flex min-h-[3.75rem] items-center justify-center gap-2 rounded-[1.35rem] bg-foreground px-4 font-body text-[12px] font-semibold uppercase tracking-[0.18em] text-background"
          >
            Buy Now <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
          <Link
            to="/subscription"
            className="flex min-h-[3.75rem] items-center justify-center rounded-[1.35rem] border border-foreground bg-foreground px-3 text-center font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-background shadow-[0_14px_34px_hsl(var(--foreground)/0.12)]"
          >
            Plans
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
