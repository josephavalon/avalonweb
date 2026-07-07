import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Clock,
  Droplets,
  Hexagon,
  MapPin,
  Pill,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react';

import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/context/CartContext';
import { getProduct, productsByCategory, slugify } from '@/data/products';
import { useSeo } from '@/lib/seo';
import { appendActivity } from '@/lib/localOs';
import { buildProductJsonLd } from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

const DESIGN_TIMELINE = [
  { label: '5 MIN', value: 'Arrival & check-in — we get you settled' },
  { label: '10 MIN', value: 'Setup — IV placed, therapy prepared' },
  { label: '45 MIN', value: 'Infusion — relax while we take care of you' },
  { label: '60 MIN', value: 'Complete — you get back to life' },
];

function priceNumber(value) {
  const number = Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function productPrice(product) {
  return product.oneTime || product.price || '$250';
}

function ingredientIcon(name) {
  const n = name.toLowerCase();
  if (/(saline|hydrat|water|fluid|electrolyt)/.test(n)) return n.includes('electro') ? Zap : Droplets;
  if (/(b-?complex|b12|b1|vitamin b|amino|taurine)/.test(n)) return Pill;
  if (/(vitamin c|zinc|glutathione|biotin|antioxidant|selenium)/.test(n)) return Sparkles;
  if (/(magnes|calcium|mineral|trace|nad)/.test(n)) return Hexagon;
  return Droplets;
}

function allProductLinks() {
  return Object.entries(productsByCategory).flatMap(([categorySlug, category]) => (
    (category.treatments || []).map((product) => ({
      categorySlug,
      category,
      product,
      slug: slugify(product.name),
      path: `/products/${categorySlug}/${slugify(product.name)}`,
    }))
  ));
}

function relatedProducts(product, currentCategorySlug, currentSlug) {
  const products = allProductLinks();
  const related = (product.related || [])
    .map((slug) => products.find((item) => item.slug === slug))
    .filter(Boolean)
    .filter((item) => !(item.categorySlug === currentCategorySlug && item.slug === currentSlug));

  if (related.length >= 3) return related.slice(0, 3);
  return products
    .filter((item) => !(item.categorySlug === currentCategorySlug && item.slug === currentSlug))
    .filter((item) => item.categorySlug === currentCategorySlug || item.categorySlug === 'iv-vitamins')
    .slice(0, 3);
}

function bookingPath(product, subscription = false) {
  const params = new URLSearchParams();
  if (product.protocolKey) params.set('protocol', product.protocolKey);
  if (subscription) params.set('subscription', 'starter');
  params.set('time', 'asap');
  const query = params.toString();
  return query ? `/book?${query}` : '/book';
}

function Bag({ src, alt, className = '' }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-white/20 bg-white/[0.04] ${className}`}>
        <Droplets className="h-1/3 w-1/3 text-white/70" strokeWidth={1.6} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={`object-contain ${className}`} />;
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-[18px] border border-white/[0.08] bg-[#0f0f0f] ${className}`}>{children}</div>
  );
}

function SectionLabel({ children }) {
  return <p className="mb-3.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/72 md:text-[13px]">{children}</p>;
}

export default function ProductDetail() {
  const { category, slug } = useParams();
  const match = getProduct(category, slug);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [showStickyBook, setShowStickyBook] = useState(false);
  const { clearItems, addItem } = useCart();

  const price = useMemo(() => productPrice(match?.treatment || {}), [match]);
  const numericPrice = useMemo(() => priceNumber(price), [price]);

  useSeo({
    title: match ? `${match.treatment.name} — Mobile IV Therapy | Avalon Vitality` : 'Product Not Found — Avalon Vitality',
    description: match?.treatment.seoDescription || match?.treatment.desc || 'Avalon Vitality mobile IV therapy in the San Francisco Bay Area.',
    path: match ? `/products/${category}/${slug}` : undefined,
    jsonLd: match ? buildProductJsonLd({ category: match.category, categorySlug: category, product: match.treatment, slug, price: numericPrice }) : undefined,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setShowStickyBook(window.scrollY > 430);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  if (!match) {
    return (
      <div className="av-page-surface min-h-screen">
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
  const currentSlug = slugify(treatment.name);
  const related = relatedProducts(treatment, category, currentSlug);
  const baseIncluded = (treatment.included || []).map((s) => s.replace(/\s*\(.*?\)\s*/g, ' ').trim()).filter(Boolean);
  const ingredients = baseIncluded.slice(0, 4);
  const included = [...baseIncluded, 'Nurse visit', 'Clinical review'].slice(0, 6);
  const timeline = DESIGN_TIMELINE;
  const duration = (treatment.duration || '60 min').replace(/\s*min$/i, ' MIN').toUpperCase();

  const buyNow = () => {
    clearItems();
    addItem({
      cartKey: treatment.doseKey || treatment.protocolKey || currentSlug,
      label: treatment.name,
      price: numericPrice,
      type: category === 'iv-vitamins' ? 'iv' : 'addon',
    });
    appendActivity(`Added product to checkout: ${treatment.name}`, { role: 'client', product: currentSlug });
    navigate(bookingPath(treatment));
  };

  const chip = (Icon, label) => (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.32] px-3 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-white/85 md:px-3.5 md:py-2 md:text-[11px]">
      <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.9} /> {label}
    </span>
  );

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-2.5 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-[4.5rem] md:px-6 md:pb-16 md:pt-28 2xl:max-w-7xl">
        <Link
          to={cat.backTo || '/protocols'}
          className="mb-3 ml-1 inline-flex items-center gap-2 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55 transition-colors hover:text-foreground md:mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.1} /> {cat.backLabel || 'Back to IV Therapy'}
        </Link>

        {/* HERO — poster scrim: backdrop photo reads through, darkening toward the base */}
        <section className="relative overflow-hidden rounded-[18px] border border-white/10 bg-gradient-to-t from-background/90 via-background/62 to-background/34">
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="relative grid items-center gap-4 p-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-7 md:p-7"
          >
            <div className="flex items-center gap-4 md:block">
              <Bag src={treatment.image} alt={treatment.name} className="h-[104px] w-[72px] shrink-0 drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)] md:mx-auto md:h-auto md:w-[170px]" />
              <div className="min-w-0 md:hidden">
                <h1 className="font-heading text-[2.2rem] uppercase leading-[0.95] tracking-normal text-white">{treatment.name}</h1>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-heading text-[1.9rem] uppercase leading-none tracking-normal text-white">{price}</span>
                  <span className="font-body text-[11px] text-white/70">per visit</span>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <h1 className="hidden font-heading text-[2.6rem] uppercase leading-[0.92] tracking-normal text-white md:block md:text-[4rem] lg:text-[4.5rem]">{treatment.name}</h1>
              <p className="mt-2.5 font-body text-[13px] leading-relaxed text-white/85 md:mt-3.5 md:max-w-xl md:text-[17px]">{treatment.desc || treatment.benefitStatement}</p>
              <div className="mt-3 hidden items-baseline gap-3 md:flex">
                <span className="font-heading text-[2.4rem] uppercase leading-none tracking-normal text-white md:text-[3.2rem]">{price}</span>
                <span className="font-body text-sm text-white/70">per visit</span>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-2">
                {chip(UserRound, 'Nurse comes to you')}
                {chip(Clock, duration)}
                {chip(MapPin, 'Bay Area')}
              </div>

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={buyNow}
                  style={{ backgroundColor: '#ffffff', color: '#000000' }}
                  className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-8 font-body text-xs font-semibold uppercase tracking-[0.08em] transition-opacity hover:opacity-90 md:min-h-[3.4rem] md:text-sm"
                >
                  Book Now <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <Link
                  to={bookingPath(treatment, true)}
                  className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-white/40 bg-background/42 px-6 font-body text-xs font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-xl transition-colors hover:bg-background/58 md:min-h-[3.4rem] md:text-sm"
                >
                  Subscribe &amp; Save 15%
                </Link>
              </div>

              <p className="mt-3 flex items-center gap-1.5 font-body text-[11px] text-white/72">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} /> All treatments administered by licensed registered nurses
              </p>
            </div>
          </motion.div>
        </section>

        {/* INGREDIENTS ROW */}
        {ingredients.length > 0 && (
          <Card className="mt-3 grid grid-cols-2 divide-x divide-white/[0.08] overflow-hidden sm:grid-cols-4">
            {ingredients.slice(0, 4).map((ing, i) => {
              const Icon = ingredientIcon(ing);
              return (
                <div key={ing} className={`px-2 py-4 text-center md:py-6 ${i >= 2 ? 'border-t border-white/[0.08] sm:border-t-0' : ''}`}>
                  <Icon className="mx-auto h-5 w-5 text-foreground md:h-6 md:w-6" strokeWidth={1.8} />
                  <p className="mt-2 font-body text-[11px] font-medium uppercase tracking-[0.1em] text-foreground/78 md:mt-2.5 md:text-[13px]">{ing}</p>
                </div>
              );
            })}
          </Card>
        )}

        {/* INCLUDED + TIMELINE */}
        <Card className="mt-3 p-5 md:grid md:grid-cols-[1fr_1.15fr] md:gap-7 md:p-7">
          <div>
            <SectionLabel>Included Inside</SectionLabel>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 md:gap-y-3.5">
              {included.map((item) => (
                <span key={item} className="flex items-center gap-2 font-body text-[13px] text-foreground/88 md:text-[15px]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-foreground md:h-[18px] md:w-[18px]" strokeWidth={2} /> {item}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-6 border-t border-white/[0.08] pt-5 md:mt-0 md:border-l md:border-t-0 md:pl-7 md:pt-0">
            <SectionLabel>Experience Timeline</SectionLabel>
            <ol className="relative">
              {timeline.slice(0, 4).map((step, index, arr) => (
                <li key={step.label} className="grid grid-cols-[14px_52px_1fr] gap-x-2.5 md:grid-cols-[16px_64px_1fr] md:gap-x-3.5">
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-foreground" />
                    {index < arr.length - 1 && <span className="my-0.5 w-px flex-1 bg-foreground/20" />}
                  </div>
                  <span className="pb-3.5 font-body text-xs font-semibold text-foreground md:text-sm">{step.label}</span>
                  <span className="pb-3.5 font-body text-xs leading-snug text-foreground/65 md:text-sm">{step.value}</span>
                </li>
              ))}
            </ol>
          </div>
        </Card>

        {/* RELATED */}
        {related.length > 0 && (
          <Card className="mt-3 p-5">
            <SectionLabel>Related Therapies</SectionLabel>
            <div className="grid gap-2.5 md:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#161616] p-3 transition-colors hover:border-white/24 md:flex-col md:items-center md:gap-3 md:p-5 md:text-center"
                >
                  <Bag src={item.product.image} alt={item.product.name} className="h-9 w-7 shrink-0 md:h-[84px] md:w-[60px]" />
                  <span className="min-w-0 flex-1 truncate font-body text-[11px] font-medium uppercase tracking-[0.06em] text-foreground/88 md:flex-none md:text-[13px]">{item.product.name}</span>
                  <span className="font-body text-[13px] font-medium text-foreground md:text-base">{productPrice(item.product)}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground/45 md:hidden" strokeWidth={2.2} />
                </Link>
              ))}
            </div>
            <Link
              to="/protocols"
              className="mt-3.5 flex items-center justify-center gap-2 rounded-xl border border-white/[0.22] py-2.5 font-body text-[11px] font-medium uppercase tracking-[0.1em] text-foreground/85 transition-colors hover:border-white/40"
            >
              View All Therapies <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />
            </Link>
          </Card>
        )}

        <p className="mx-auto mt-6 max-w-2xl px-4 text-center font-body text-[10px] leading-relaxed text-foreground/38">
          Educational content only. Avalon Vitality provides wellness and recovery support and does not diagnose, treat,
          cure, or prevent disease. Services are subject to intake, consent, and clinical approval.
        </p>
      </main>

      {/* MOBILE STICKY BOOK BAR */}
      {showStickyBook && <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-white/12 bg-background/92 px-4 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-2.5 backdrop-blur-xl md:hidden">
        <div className="min-w-0">
          <p className="font-body text-[15px] font-semibold leading-none text-foreground tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>{price}</p>
          <p className="mt-1 truncate font-body text-[9px] uppercase tracking-[0.06em] text-foreground/60">{treatment.name} · {duration}</p>
        </div>
        <button
          type="button"
          onClick={buyNow}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-body text-xs font-semibold uppercase tracking-[0.08em] text-black"
        >
          Book Now <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>}

      <Footer />
    </div>
  );
}
