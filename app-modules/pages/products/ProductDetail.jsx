import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  BriefcaseBusiness,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  Flame,
  Hotel,
  MapPin,
  Moon,
  Plane,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Zap,
} from 'lucide-react';

import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/context/CartContext';
import { getProduct, productsByCategory, slugify } from '@/data/products';
import { useSeo } from '@/lib/seo';
import { appendActivity } from '@/lib/localOs';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import { buildProductJsonLd } from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

const DEFAULT_INCLUDED = [
  'Clinical intake review',
  'Registered nurse administration',
  'Mobile visit at your location',
  'Visit supplies and setup',
];

const DEFAULT_TIMELINE = [
  { label: '0 min', value: 'Book protocol, address, and payment' },
  { label: 'Before arrival', value: 'Clinical intake review' },
  { label: 'Arrival', value: 'Registered nurse setup and vitals' },
  { label: 'Treatment', value: '45-60 min unless noted' },
];

const DEFAULT_FAQ = [
  { q: 'What is included?', a: 'Clinical intake review, registered nurse administration, mobile setup, and visit supplies are included unless noted.' },
  { q: 'Who administers the visit?', a: 'A California-licensed registered nurse administers the visit after intake and clinical review.' },
  { q: 'Can I book today?', a: 'Same-day requests are reviewed based on location, nurse availability, supplies, and clinical eligibility.' },
];

const IDEAL_ICONS = {
  Travel: Plane,
  Recovery: Flame,
  Performance: Zap,
  Wellness: Sparkles,
  Nightlife: Moon,
  Corporate: BriefcaseBusiness,
  Longevity: BatteryCharging,
  'Clinical Review': ShieldCheck,
};

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
  const mediaPadding = compact ? 'p-0' : (transparentMedia ? 'p-2' : 'p-4');

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
      className={`h-full w-full object-contain drop-shadow-[0_22px_42px_rgba(0,0,0,0.24)] ${mediaPadding} ${compact && !transparentMedia ? 'scale-[1.22]' : ''}`}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.992 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.72, ease: EASE }}
    />
  ) : (
    <div className="flex h-full items-center justify-center px-8 text-center">
      <div>
        <p className="font-heading text-4xl tracking-[0.12em] text-foreground">AVALON</p>
        <p className="font-body text-[10px] tracking-[0.48em] text-foreground/40">VITALITY</p>
        <p className="mt-8 font-body text-xs uppercase tracking-[0.24em] text-foreground/45">{name}</p>
      </div>
    </div>
  );
}

function GlassPanel({ children, className = '' }) {
  return (
    <div className={`av-glass-card relative overflow-hidden rounded-[1.45rem] border border-foreground/12 bg-background/40 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_24px_90px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl ${className}`}>
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,hsl(var(--foreground)/0.11),transparent_36%),linear-gradient(135deg,hsl(var(--foreground)/0.055),transparent_56%,hsl(var(--foreground)/0.026))]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function ProductBag({ product }) {
  return (
    <GlassPanel className="hidden aspect-[0.82] min-h-[30rem] p-5 md:block">
      <div className="h-full overflow-hidden rounded-[1.15rem] border border-foreground/10 bg-foreground/90">
        <div className="pointer-events-none absolute inset-x-5 top-5 z-10 h-1/3 rounded-t-[1.15rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.42),transparent)]" />
        <ProductMedia product={product} />
      </div>
    </GlassPanel>
  );
}

function TrustItem({ icon: Icon, title }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.045] px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-foreground/64" strokeWidth={1.8} />
      <p className="truncate font-body text-[10px] font-black uppercase tracking-[0.12em] text-foreground/72">{title}</p>
    </div>
  );
}

function SectionTitle({ label, title }) {
  return (
    <div className="mb-3 md:mb-5">
      <p className="font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/42">{label}</p>
      <h2 className="mt-1 font-heading text-[2.65rem] uppercase leading-none tracking-normal text-foreground md:text-[4rem]">{title}</h2>
    </div>
  );
}

function CollapsibleSection({ label, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <GlassPanel className="mt-3 md:mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex min-h-[68px] w-full items-center justify-between gap-4 px-4 text-left md:min-h-[78px] md:px-5"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/42">{label}</span>
          <span className="mt-1 block font-heading text-[2.35rem] uppercase leading-none tracking-normal text-foreground md:text-[3.25rem]">{title}</span>
        </span>
        <ArrowRight className={`h-4 w-4 shrink-0 text-foreground/52 transition-transform ${open ? 'rotate-90' : ''}`} strokeWidth={2.2} />
      </button>
      {open && (
        <SmoothDisclosure open>
          <div className="border-t border-foreground/8 p-3 md:p-5">{children}</div>
        </SmoothDisclosure>
      )}
    </GlassPanel>
  );
}

function BenefitGrid({ items = [] }) {
  return (
    <div className="av-wide-card-grid">
      {items.slice(0, 4).map((item) => (
        <GlassPanel key={item} className="av-rect-card min-h-[120px] p-4 md:min-h-[150px] md:p-5">
          <div className="flex h-full items-center gap-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-foreground/70" strokeWidth={2.2} />
            <p className="font-heading text-[2.25rem] uppercase leading-[0.9] tracking-normal text-foreground md:text-[2.75rem]">{item}</p>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}

function IdealForGrid({ items = [] }) {
  return (
    <div className="av-wide-card-grid">
      {items.slice(0, 6).map((item) => {
        const Icon = IDEAL_ICONS[item] || Sparkles;
        return (
          <GlassPanel key={item} className="av-rect-card min-h-[120px] p-4 md:min-h-[150px]">
            <div className="flex h-full items-center gap-4">
              <Icon className="h-5 w-5 shrink-0 text-foreground/72" strokeWidth={2.2} />
              <p className="font-heading text-[2.25rem] uppercase leading-[0.9] tracking-normal text-foreground md:text-[2.75rem]">{item}</p>
            </div>
          </GlassPanel>
        );
      })}
    </div>
  );
}

function IncludedGrid({ items = [] }) {
  const visibleItems = items.length ? items : DEFAULT_INCLUDED;
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {visibleItems.slice(0, 6).map((item) => (
        <div key={item} className="av-rect-card flex min-h-[88px] items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.045] px-4">
          <Droplets className="h-5 w-5 shrink-0 text-foreground/62" strokeWidth={2.1} />
          <p className="font-body text-base font-black leading-tight text-foreground/78">{item}</p>
        </div>
      ))}
    </div>
  );
}

function Timeline({ items = [] }) {
  const visibleItems = items.length ? items : DEFAULT_TIMELINE;
  return (
    <div className="av-wide-card-grid">
      {visibleItems.slice(0, 4).map((item, index) => (
        <div key={item.label} className="av-rect-card relative min-h-[132px] rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.06] font-body text-xs font-black text-foreground">
            {index + 1}
          </span>
          <p className="mt-4 font-heading text-[1.75rem] uppercase leading-none text-foreground">{item.label}</p>
          <p className="mt-1 font-body text-sm font-bold text-foreground/62">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function FaqList({ items = [] }) {
  const visibleItems = items.length ? items : DEFAULT_FAQ;
  return (
    <div>
      {visibleItems.slice(0, 5).map((item, index) => (
        <FaqRow key={item.q} item={item} defaultOpen={index === 0} />
      ))}
    </div>
  );
}

function FaqRow({ item, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-t border-foreground/8 first:border-t-0">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-[58px] w-full items-center justify-between gap-4 py-3 text-left" aria-expanded={open}>
        <span className="font-body text-sm font-black text-foreground">{item.q}</span>
        <ArrowRight className={`h-4 w-4 shrink-0 text-foreground/48 transition-transform ${open ? 'rotate-90' : ''}`} strokeWidth={2.1} />
      </button>
      <SmoothDisclosure open={open}>
        <p className="pb-4 font-body text-sm font-semibold leading-relaxed text-foreground/58">{item.a}</p>
      </SmoothDisclosure>
    </div>
  );
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

export default function ProductDetail() {
  const { category, slug } = useParams();
  const match = getProduct(category, slug);
  const navigate = useNavigate();
  const { clearItems, addItem } = useCart();

  const price = useMemo(() => productPrice(match?.treatment || {}), [match]);
  const numericPrice = useMemo(() => priceNumber(price), [price]);

  useSeo({
    title: match ? `${match.treatment.name} — Mobile IV Therapy | Avalon Vitality` : 'Product Not Found — Avalon Vitality',
    description: match?.treatment.seoDescription || match?.treatment.desc || 'Avalon Vitality mobile IV therapy in the San Francisco Bay Area.',
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
  const currentSlug = slugify(treatment.name);
  const related = relatedProducts(treatment, category, currentSlug);
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

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-[calc(100vw-2rem)] overflow-x-hidden px-0 pb-32 pt-24 md:max-w-7xl md:px-8 md:pb-20 md:pt-28">
        <Link
          to={cat.backTo || '/protocols'}
          className="mb-5 inline-flex items-center gap-2 font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/46 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.1} />
          {cat.backLabel || 'Back to Protocols'}
        </Link>

        <section className="grid gap-5 md:grid-cols-[0.86fr_1fr] md:gap-10 lg:gap-14">
          <ProductBag product={treatment} />

          <motion.div
            initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <GlassPanel className="p-3 md:hidden">
              <div className="min-w-0">
                <h1 className="font-heading text-[2.9rem] uppercase leading-[0.84] tracking-normal text-foreground">{treatment.name}</h1>
                <p className="mt-3 font-body text-sm font-semibold leading-snug text-foreground/64">{treatment.benefitStatement || treatment.desc}</p>
                <p className="mt-4 font-heading text-3xl text-foreground">{price}</p>
              </div>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={buyNow}
                  className="flex min-h-[3.35rem] items-center justify-center gap-2 rounded-full bg-foreground px-4 font-body text-[11px] font-black uppercase tracking-[0.14em] text-background"
                >
                  Book <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <Link
                  to={bookingPath(treatment, true)}
                  className="flex min-h-[2.75rem] items-center justify-center rounded-full border border-foreground/14 bg-background/34 px-3 text-center font-body text-[10px] font-black uppercase tracking-[0.12em] text-foreground/72"
                >
                  Monthly plan
                </Link>
              </div>
            </GlassPanel>

            <div className="hidden md:block">
              <h1 className="font-heading text-6xl uppercase leading-[0.86] tracking-normal text-foreground lg:text-8xl">{treatment.name}</h1>
              <p className="mt-5 max-w-2xl font-body text-xl font-semibold leading-snug text-foreground/66">{treatment.benefitStatement || treatment.desc}</p>
              <p className="mt-7 font-heading text-4xl text-foreground">{price}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 md:mt-7">
              <TrustItem icon={MapPin} title="Bay Area mobile" />
              <TrustItem icon={UserRoundCheck} title="Licensed Registered Nurse" />
              <TrustItem icon={ShieldCheck} title="Clinical review" />
            </div>

            <div className="mt-5 hidden grid-cols-2 gap-3 md:grid">
              <button
                type="button"
                onClick={buyNow}
                className="flex min-h-[58px] items-center justify-center gap-2 rounded-full bg-foreground px-6 font-body text-xs font-black uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
              >
                Book <ArrowRight className="h-4 w-4" strokeWidth={2.35} />
              </button>
              <Link
                to={bookingPath(treatment, true)}
                className="flex min-h-[58px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground/[0.12] px-6 font-body text-xs font-black uppercase tracking-[0.15em] text-foreground backdrop-blur-2xl transition-colors hover:bg-foreground/[0.18]"
              >
                Subscribe & Save
              </Link>
            </div>

            <GlassPanel className="mt-5 p-4 md:mt-7 md:p-5">
              <p className="font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/42">What It Is</p>
              <p className="mt-3 font-body text-base font-semibold leading-relaxed text-foreground/68 md:text-lg">
                {treatment.desc || cat.description}
              </p>
            </GlassPanel>
          </motion.div>
        </section>

        <section className="mt-6 md:mt-10">
          <SectionTitle label="Benefits" title="Fast Scan" />
          <BenefitGrid items={treatment.benefits || []} />
        </section>

        <section className="mt-6 md:mt-10">
          <SectionTitle label="Ideal For" title="Use Case" />
          <IdealForGrid items={treatment.idealFor || []} />
        </section>

        <section className="mt-6 grid gap-3 md:mt-10 md:grid-cols-2">
          <CollapsibleSection label="Included" title="Inside">
            <IncludedGrid items={treatment.included || []} />
          </CollapsibleSection>
          <CollapsibleSection label="Experience" title="Timeline">
            <Timeline items={treatment.timeline || []} />
          </CollapsibleSection>
        </section>

        <CollapsibleSection label="Related" title="Therapies">
          <div className="grid gap-2 md:grid-cols-2 md:gap-3">
            {related.map((item) => (
              <Link key={item.path} to={item.path} className="group block">
                <GlassPanel className="min-h-[118px] p-4 transition-colors group-hover:border-foreground/24 group-hover:bg-background/54">
                  <p className="font-heading text-[2.2rem] uppercase leading-none text-foreground">{item.product.name}</p>
                  <p className="mt-3 font-body text-sm font-bold text-foreground/60">{productPrice(item.product)}</p>
                </GlassPanel>
              </Link>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection label="FAQ" title="Need To Know">
          <FaqList items={treatment.faq || []} />
        </CollapsibleSection>

        <p className="mx-auto mt-8 max-w-3xl text-center font-body text-[10px] leading-relaxed text-foreground/34">
          Educational content only. Avalon Vitality provides wellness and recovery support and does not diagnose,
          treat, cure, or prevent disease. Services are subject to intake, consent, and clinical approval.
        </p>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/[0.10] bg-background/86 px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-2.5 shadow-[0_-18px_45px_rgba(0,0,0,0.18)] backdrop-blur-2xl md:hidden">
        <div className="mx-auto grid max-w-lg gap-2">
          <button
            type="button"
            onClick={buyNow}
            className="flex min-h-[3.5rem] items-center justify-center gap-2 rounded-full bg-foreground px-4 font-body text-[12px] font-black uppercase tracking-[0.15em] text-background"
          >
            Book <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
