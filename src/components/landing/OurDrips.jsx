import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Droplets, Zap, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';

const EASE = [0.16, 1, 0.3, 1];

const treatments = [
  {
    label: 'IV Vitamins',
    href: '/services/iv-vitamins',
    icon: Droplets,
    price: 150,
    priceFrom: true,
    suffix: 'starting / session',
    tag: 'Wellness Foundation',
    perks: [
      'Dehydration · Myers’ · Recovery · Athletic · Glow · Immunity',
      'B-complex, magnesium, glutathione, NAD+ add-ons',
      'IM shot add-ons available — B12, glutathione',
    ],
  },
  {
    label: 'IV CBD',
    href: '/services/cbd',
    icon: CannabisLeaf,
    price: 250,
    priceFrom: true,
    suffix: 'starting / session',
    tag: 'Recovery & Calm',
    perks: [
      '33mg → 99mg formulas, dose-graded',
      'Zero THC, full bioavailability',
      'Delivered by Avalon’s nurses',
      'IM and vitamin add-ons available',
    ],
  },
  {
    label: 'IV NAD+',
    href: '/services/nad',
    icon: Zap,
    price: 350,
    priceFrom: true,
    suffix: 'starting / session',
    tag: 'Cellular Repair',
    perks: [
      '250mg → 1500mg dose-graded',
      'Stack with IM shots or vitamin add-ons',
    ],
  },
];

function TreatmentCard({ t }) {
  const Icon = t.icon;
  return (
    <div
      className="flex-shrink-0 w-[85vw] max-w-[340px] sm:w-[300px] md:w-auto snap-center md:snap-align-none border border-white/20 bg-white/[0.04] backdrop-blur-md rounded-3xl p-4 md:p-5 flex flex-col"
    >
      {/* Tier name row */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-accent" strokeWidth={1.5} />
        <h3 className="font-heading text-xl tracking-wide text-foreground uppercase">{t.label}</h3>
      </div>

      {/* Tag */}
      <p className="font-body text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-4">{t.tag}</p>

      {/* Price */}
      <div className="mb-4">
        {t.priceFrom && (
          <div className="font-body text-[10px] tracking-[0.25em] uppercase text-accent mb-1">From</div>
        )}
        <div className="font-heading text-5xl md:text-6xl text-foreground leading-none tracking-tight">
          ${t.price}{t.priceFrom && <span className="text-accent">+</span>}
        </div>
        <div className="font-body text-xs tracking-widest uppercase text-muted-foreground mt-1">{t.suffix}</div>
      </div>

      {/* Perks */}
      <ul className="space-y-1.5 mb-4 flex-1">
        {t.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Plus className="w-3 h-3 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
            <span className="font-body text-xs text-foreground leading-relaxed">{perk}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        to={t.href}
        className="block text-center py-2.5 md:py-3 font-body text-sm tracking-widest uppercase font-semibold rounded-full transition-colors mt-auto border border-foreground/30 text-foreground hover:border-foreground"
      >
        Book Now
      </Link>
    </div>
  );
}

export default function OurDrips() {
  const scrollRef = useRef(null);

  // Keyboard nav: arrows scroll one card
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onKey = (e) => {
      if (!el.contains(document.activeElement) && document.activeElement !== el) return;
      const card = el.firstElementChild?.firstElementChild;
      if (!card) return;
      const cardW = card.getBoundingClientRect().width;
      const styles = window.getComputedStyle(el.firstElementChild);
      const gap = parseFloat(styles.columnGap || styles.gap || '16') || 16;
      const step = cardW + gap;
      if (e.key === 'ArrowRight') { e.preventDefault(); el.scrollBy({ left: step, behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); el.scrollBy({ left: -step, behavior: 'smooth' }); }
    };
    el.tabIndex = 0;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Vitality treatments — use arrow keys to navigate');
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, []);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.firstElementChild;
    if (!card) return;
    const cardW = card.getBoundingClientRect().width;
    const styles = window.getComputedStyle(el);
    const gap = parseFloat(styles.columnGap || styles.gap || '16') || 16;
    const step = cardW + gap;
    el.scrollBy({ left: dir === 'right' ? step : -step, behavior: 'smooth' });
  };

  return (
    <section id="treatments" className="scroll-mt-24 md:scroll-mt-32 py-8 md:py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-left mb-4 md:mb-5">
          <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-2">Live Protocols</p>
          <h2 className="font-heading text-[9vw] md:text-5xl lg:text-6xl text-foreground tracking-wide leading-[0.95] uppercase">
            Vitality Treatments
          </h2>
          <div className="w-12 md:w-16 h-[2px] bg-accent mt-2 md:mt-3" />
          <p className="font-body text-sm md:text-base text-foreground/70 mt-2 md:mt-3 max-w-xl">
            Delivered by Avalon&rsquo;s nurses across the Bay.
          </p>
        </div>

        {/* Treatment cards — horizontal scroll on mobile, 3-col grid on desktop (mirrors Membership pattern) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="md:hidden absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-background/70 backdrop-blur-md border border-white/15"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="md:hidden absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-background/70 backdrop-blur-md border border-white/15"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
          <div
            ref={scrollRef}
            className="av-scroll-hint md:[&]:!relative overflow-x-auto overflow-y-visible no-scrollbar md:overflow-visible md:grid md:grid-cols-3 md:gap-4 lg:gap-6 flex gap-4 pb-3 snap-x snap-mandatory md:snap-none scroll-px-[7.5vw] px-[7.5vw] md:px-0"
          >
            {treatments.map((t) => (
              <TreatmentCard key={t.label} t={t} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
