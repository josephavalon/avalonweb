import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from '@/components/ui/PageTransitionMotion';
import {
  ArrowRight,
  Activity,
  BatteryCharging,
  ChevronDown,
  Clock,
  Droplets,
  Dumbbell,
  FlaskConical,
  Heart,
  Microscope,
  Syringe,
  Sparkles,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE, premiumListContainer, premiumStaggerItem, premiumTap } from '@/lib/motion';
import PremiumButton from '@/components/ui/PremiumButton';
import { IV_ADDONS, IV_SESSIONS, IM_SHOTS } from '@/config/verticals';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'energy', label: 'Energy' },
  { key: 'advanced', label: 'Advanced' },
];

const SORTS = [
  { key: 'featured', label: 'Featured' },
  { key: 'price', label: '$' },
  { key: 'az', label: 'A-Z' },
];

const HERO_GOALS = [
  { label: 'Now', body: 'Book a visit.', icon: Clock, href: '/book' },
  { label: 'Guide Me', body: 'Start with your goal.', icon: Heart, href: '/book' },
];

const PROTOCOL_MODULES = [
  {
    key: 'hydration',
    label: 'Hydration',
    status: 'Live',
    body: 'IV fluids, vitamins, minerals, medications when clinically appropriate.',
    icon: Droplets,
    href: '/book?outcome=recover&protocol=hydration',
    cta: 'Start',
  },
  {
    key: 'recovery',
    label: 'Recovery',
    status: 'Live',
    body: 'Travel, fatigue, post-launch, training, and heavier recovery days.',
    icon: Activity,
    href: '/book?outcome=recover&protocol=recovery',
    cta: 'Start',
  },
  {
    key: 'performance',
    label: 'Performance',
    status: 'Consult',
    body: 'Energy, focus, output, travel schedules, and high-demand work cycles.',
    icon: Dumbbell,
    href: '/book?outcome=perform&protocol=energy',
    cta: 'Plan',
  },
  {
    key: 'longevity',
    label: 'Longevity',
    status: 'Consult',
    body: 'NAD+, advanced wellness, longer visits, and clinician-guided review.',
    icon: BatteryCharging,
    href: '/book?outcome=longevity&protocol=nad',
    cta: 'Review',
  },
  {
    key: 'aesthetics',
    label: 'Aesthetics',
    status: 'Next',
    body: 'Glow, skin, regenerative services, and future aesthetics protocols.',
    icon: Sparkles,
    href: '/book?outcome=restore&protocol=beauty',
    cta: 'Queue',
  },
  {
    key: 'diagnostics',
    label: 'Diagnostics',
    status: 'Next',
    body: 'Labs, biomarkers, tracking, and ongoing protocol intelligence.',
    icon: Microscope,
    href: '/custom',
    cta: 'Request',
  },
];

const PLATFORM_LAYERS = [
  ['Webstore', 'Choose your protocol'],
  ['Avalon OS', 'Route handoff'],
  ['Clinical', 'Review first'],
  ['Field', 'RN arrives'],
];

const FEATURED_KEYS = ['myers', 'hydration', 'recovery', 'immunity'];
const ADVANCED_KEYS = ['nad', 'cbd', 'exosomes'];
const DEFAULT_ORDER = new Map(IV_SESSIONS.map((session, index) => [session.key, index]));
const FEATURED_ORDER = new Map(FEATURED_KEYS.map((key, index) => [key, index]));

const CONTROL_TRANSITION = { duration: 0.48, ease: EASE };
const CARD_TRANSITION = { duration: 0.54, ease: EASE };
const FOLDOUT_TRANSITION = { duration: 0.58, ease: EASE };
const MotionLink = motion(Link);

function priceFor(session) {
  return session.price || session.doses?.[0]?.price || 0;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function productHrefForSession(session) {
  return `/therapies/${session.key}`;
}

function includesText(session) {
  if (session.inside) return session.inside;
  if (session.doses?.length) return `${session.doses.length} dose tiers available`;
  return session.desc || session.tagline || 'Clinician-guided protocol';
}

function categoryFor(session) {
  if (ADVANCED_KEYS.includes(session.key)) return 'advanced';
  return session.category || 'all';
}

function sortSessions(sessions, sort) {
  const list = [...sessions];
  if (sort === 'price') {
    return list.sort((a, b) => priceFor(a) - priceFor(b));
  }
  if (sort === 'az') {
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }
  return list.sort((a, b) => {
    const aFeatured = FEATURED_ORDER.has(a.key) ? FEATURED_ORDER.get(a.key) : 100 + (DEFAULT_ORDER.get(a.key) || 0);
    const bFeatured = FEATURED_ORDER.has(b.key) ? FEATURED_ORDER.get(b.key) : 100 + (DEFAULT_ORDER.get(b.key) || 0);
    return aFeatured - bFeatured;
  });
}

function scrollChipIntoView(event) {
  event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function OutcomeCard({ item }) {
  const Icon = item.icon;
  return (
    <MotionLink
      to={item.href}
      whileHover={{ y: -3 }}
      whileTap={premiumTap}
      transition={CONTROL_TRANSITION}
      className="av-glass-sweep group relative flex min-h-[86px] flex-col justify-between overflow-hidden rounded-[1.1rem] border border-foreground/[0.10] bg-background/58 p-3 shadow-[0_18px_70px_hsl(var(--foreground)/0.04)] backdrop-blur-xl transition-colors hover:border-foreground/[0.20] hover:bg-foreground/[0.055] md:min-h-[112px] md:rounded-[1.35rem] md:p-4"
    >
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-accent md:h-5 md:w-5" strokeWidth={1.55} />
        <ArrowRight className="h-3.5 w-3.5 text-foreground/28 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/55 md:h-4 md:w-4" strokeWidth={1.8} />
      </div>
      <div>
        <p className="font-heading text-xl uppercase leading-none text-foreground md:text-2xl">{item.label}</p>
        <p className="mt-1 line-clamp-2 font-body text-[11px] leading-snug text-foreground/50 md:mt-2 md:text-xs md:leading-relaxed">{item.body}</p>
      </div>
    </MotionLink>
  );
}

function ModuleCard({ item, index }) {
  const Icon = item.icon || FlaskConical;
  const isLive = item.status === 'Live';
  return (
    <motion.article
      initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.62, delay: Math.min(index * 0.045, 0.18), ease: EASE }}
      className="av-glass-sweep group relative flex min-h-[180px] flex-col justify-between overflow-hidden rounded-[1.2rem] border border-foreground/[0.10] bg-background/58 p-4 shadow-[0_20px_80px_hsl(var(--foreground)/0.045)] backdrop-blur-xl transition-colors hover:border-foreground/[0.20] hover:bg-foreground/[0.052] md:rounded-[1.45rem] md:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${isLive ? 'border-accent/26 bg-accent/[0.085] text-accent' : 'border-foreground/[0.10] bg-foreground/[0.035] text-foreground/48'}`}>
          <Icon className="h-5 w-5" strokeWidth={1.55} />
        </span>
        <span className={`rounded-full border px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.18em] ${isLive ? 'border-accent/26 text-accent' : 'border-foreground/[0.10] text-foreground/38'}`}>
          {item.status}
        </span>
      </div>
      <div className="mt-8">
        <h3 className="font-heading text-3xl uppercase leading-none text-foreground md:text-4xl">{item.label}</h3>
        <p className="mt-3 line-clamp-3 font-body text-sm leading-snug text-foreground/54">{item.body}</p>
        <Link
          to={item.href}
          className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-full border border-foreground/[0.12] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.17em] text-foreground/62 transition-colors hover:border-foreground/32 hover:text-foreground"
        >
          {item.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </Link>
      </div>
    </motion.article>
  );
}

const ProtocolCard = React.forwardRef(function ProtocolCard({ session, compact = false, index = 0 }, ref) {
  const Icon = session.icon || Droplets;
  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.985 }}
      whileHover={{ y: -2, transition: CONTROL_TRANSITION }}
      transition={{ ...CARD_TRANSITION, delay: Math.min(index * 0.025, 0.12), layout: CARD_TRANSITION }}
      className="av-glass-sweep relative transform-gpu overflow-hidden rounded-[1.1rem] border border-foreground/[0.10] bg-background/58 p-3 shadow-[0_18px_70px_hsl(var(--foreground)/0.045)] backdrop-blur-xl transition-colors will-change-transform hover:border-foreground/[0.18] hover:bg-foreground/[0.055] md:rounded-[1.45rem] md:p-4"
    >
      <div className="flex items-start gap-3 md:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/[0.08] text-accent md:h-12 md:w-12 md:rounded-2xl">
          <Icon className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading text-[1.7rem] uppercase leading-none text-foreground md:text-3xl">{session.label}</p>
              <p className="mt-1 line-clamp-2 font-body text-xs leading-snug text-foreground/55 md:mt-2 md:text-sm md:leading-relaxed">{session.tagline || session.desc}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-heading text-xl leading-none text-foreground md:text-2xl">{money(priceFor(session))}</p>
              <p className="mt-0.5 font-body text-[8px] uppercase tracking-[0.16em] text-foreground/32 md:mt-1 md:text-[9px]">from</p>
            </div>
          </div>
          {!compact && (
            <div className="mt-3 flex flex-wrap gap-1.5 md:mt-4">
              {includesText(session).split(' · ').slice(0, 4).map((item) => (
                <span key={item} className="rounded-full border border-foreground/[0.08] bg-background/45 px-2.5 py-1 font-body text-[10px] text-foreground/50">
                  {item}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-[0.82fr_1fr] gap-2 md:mt-4">
            <Link
              to={productHrefForSession(session)}
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-foreground/[0.10] font-body text-[10px] font-semibold uppercase tracking-[0.17em] text-foreground/58 md:min-h-[48px] md:rounded-2xl"
            >
              Details
            </Link>
            <Link
              to={`/book?protocol=${session.key}`}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-foreground font-body text-[10px] font-semibold uppercase tracking-[0.17em] text-background md:min-h-[48px] md:rounded-2xl"
            >
              Start <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
});

ProtocolCard.displayName = 'ProtocolCard';

function CompactRow({ item, type = 'addon' }) {
  const Icon = type === 'shot' ? (item.icon || Syringe) : Droplets;
  return (
    <MotionLink
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.4, ease: EASE }}
      to={`/book`}
      className="flex min-h-[58px] items-center gap-3 border-b border-foreground/[0.06] py-2.5 last:border-b-0 md:min-h-[68px] md:py-3"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] text-foreground/50 md:h-10 md:w-10">
        <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.55} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-[13px] font-medium text-foreground md:text-sm">{item.label}</span>
        <span className="mt-0.5 block truncate font-body text-[11px] text-foreground/42 md:text-xs">{item.desc || 'Add to any visit'}</span>
      </span>
      <span className="shrink-0 font-heading text-lg text-foreground md:text-xl">{money(item.price)}</span>
    </MotionLink>
  );
}

function Foldout({ title, sub, icon: Icon, children }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div layout transition={{ layout: FOLDOUT_TRANSITION }} className="av-glass-sweep relative overflow-hidden rounded-[1.1rem] border border-foreground/[0.10] bg-background/58 shadow-[0_18px_70px_hsl(var(--foreground)/0.04)] backdrop-blur-xl md:rounded-[1.45rem]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[64px] w-full items-center gap-3 px-3 text-left transition-colors hover:bg-foreground/[0.035] md:min-h-[76px] md:gap-4 md:px-4"
        aria-expanded={open}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.08] bg-background/45 text-accent md:h-11 md:w-11 md:rounded-2xl">
          <Icon className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.6} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[10px] uppercase tracking-[0.24em] text-foreground/38">{title}</span>
          <span className="mt-0.5 block font-body text-xs text-foreground/58 md:mt-1 md:text-sm">{sub}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={CONTROL_TRANSITION} className="shrink-0 text-foreground/35" aria-hidden="true">
          <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -8, filter: 'blur(6px)' }}
            animate={{ height: 'auto', opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ height: 0, opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={FOLDOUT_TRANSITION}
            className="overflow-hidden"
          >
            <motion.div
              initial="hidden"
              animate="show"
              exit="hidden"
              variants={{
                hidden: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
                show: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
              }}
              className="border-t border-foreground/[0.06] px-4"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Menu() {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('featured');

  useSeo({
    title: 'Protocols — Avalon Vitality',
    description: 'Choose an Avalon protocol for hydration, recovery, performance, longevity, and future mobile clinical services.',
    path: '/protocols',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'Avalon Vitality Protocols',
      url: 'https://www.avalonvitality.co/protocols',
      itemListElement: IV_SESSIONS.map((session) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: session.name,
          description: session.description || session.desc || session.tagline || includesText(session),
          provider: {
            '@type': 'MedicalBusiness',
            name: 'Avalon Vitality',
          },
        },
        priceCurrency: 'USD',
        price: String(session.price || '').replace(/[^0-9.]/g, ''),
      })),
    },
  });

  const filtered = useMemo(() => {
    const sessions = filter === 'all' ? IV_SESSIONS : IV_SESSIONS.filter((session) => categoryFor(session) === filter);
    return sortSessions(sessions, sort);
  }, [filter, sort]);
  const standardAddons = IV_ADDONS.filter((item) => !item.group).slice(0, 8);
  const shotPreview = IM_SHOTS.slice(0, 8);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar showBack />

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-20 md:px-8 md:pt-28">
        <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-end md:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, ease: EASE }}
          >
            <p className="font-body text-[9px] uppercase tracking-[0.3em] text-accent md:text-[10px] md:tracking-[0.34em]">Avalon Protocols</p>
            <h1 className="mt-2 font-heading text-[3.35rem] uppercase leading-[0.84] tracking-tight md:mt-4 md:text-[7.8rem]">
              Choose<br />Protocol.
            </h1>
            <p className="mt-3 max-w-md font-body text-sm leading-snug text-foreground/58 md:mt-5 md:text-lg md:leading-relaxed">
              Hydration is live. Recovery, performance, longevity, aesthetics, and diagnostics are next.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-2">
            {HERO_GOALS.map((item) => (
              <OutcomeCard key={item.label} item={item} />
            ))}
          </div>
        </section>

        <section className="mt-8 md:mt-14">
          <div className="mb-3 flex flex-col gap-3 md:mb-5 md:flex-row md:items-end md:justify-between md:gap-4">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.25em] text-foreground/38 md:text-[10px] md:tracking-[0.3em]">Protocol System</p>
              <h2 className="mt-1 font-heading text-4xl uppercase leading-none md:mt-2 md:text-7xl">Platform Modules</h2>
            </div>
            <p className="max-w-md font-body text-xs leading-snug text-foreground/48 md:text-sm md:leading-relaxed">
              IV therapy is the first wedge. Every module plugs into the same clearance, booking, nurse, inventory, and follow-up layer.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-3 md:gap-3">
            {PROTOCOL_MODULES.map((item, index) => (
              <ModuleCard key={item.key} item={item} index={index} />
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {PLATFORM_LAYERS.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
                <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/34">{label}</p>
                <p className="mt-1 font-body text-xs font-semibold text-foreground/62">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 md:mt-14">
          <div className="mb-3 flex flex-col gap-3 md:mb-5 md:flex-row md:items-end md:justify-between md:gap-4">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.25em] text-foreground/38 md:text-[10px] md:tracking-[0.3em]">Protocols</p>
              <h2 className="mt-1 font-heading text-4xl uppercase leading-none md:mt-2 md:text-7xl">Hydration Live</h2>
            </div>
          </div>

          <LayoutGroup id="menu-controls">
            <div className="mb-3 space-y-2.5 md:mb-4 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0">
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                {FILTERS.map((item) => {
                  const active = filter === item.key;
                  return (
                    <motion.button
                      key={item.key}
                      type="button"
                      layout
                      whileTap={premiumTap}
                      onClick={(event) => {
                        setFilter(item.key);
                        scrollChipIntoView(event);
                      }}
                      className={`relative isolate min-h-[44px] shrink-0 overflow-hidden rounded-full border px-3.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors md:px-4 md:text-[11px] md:tracking-[0.14em] ${
                        active ? 'border-foreground text-background' : 'border-foreground/[0.12] text-foreground/58 hover:border-foreground/[0.22] hover:text-foreground'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="active-menu-filter"
                          className="absolute inset-0 rounded-full bg-foreground"
                          transition={CONTROL_TRANSITION}
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                {SORTS.map((item) => {
                  const active = sort === item.key;
                  return (
                    <motion.button
                      key={item.key}
                      type="button"
                      layout
                      whileTap={premiumTap}
                      onClick={(event) => {
                        setSort(item.key);
                        scrollChipIntoView(event);
                      }}
                      aria-label={`Sort by ${item.key === 'price' ? 'price' : item.label}`}
                      className={`relative isolate min-h-[44px] min-w-[54px] shrink-0 overflow-hidden rounded-full border px-3.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors md:px-4 ${
                        active ? 'border-accent text-background' : 'border-foreground/[0.10] text-foreground/50 hover:border-foreground/[0.22] hover:text-foreground'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="active-menu-sort"
                          className="absolute inset-0 rounded-full bg-accent"
                          transition={CONTROL_TRANSITION}
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </LayoutGroup>

          <LayoutGroup id="menu-protocols">
            <motion.div
              key={`${filter}-${sort}`}
              layout
              initial="hidden"
              animate="show"
              variants={premiumListContainer(0.035, 0.04)}
              className="grid gap-2 md:grid-cols-2 md:gap-3"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((session, index) => (
                  <motion.div key={session.key} layout variants={premiumStaggerItem}>
                    <ProtocolCard session={session} index={index} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
        </section>

        <section className="mt-8 grid gap-2 md:mt-14 md:grid-cols-2 md:gap-3">
          <Foldout title="IV Add-ons" sub="Boosters added to select IV visits" icon={Droplets}>
            {standardAddons.map((item) => (
              <CompactRow key={item.label} item={item} />
            ))}
          </Foldout>
          <Foldout title="IM Shots" sub="Quick stand-alone or add-on injections" icon={Syringe}>
            {shotPreview.map((item) => (
              <CompactRow key={item.label} item={item} type="shot" />
            ))}
          </Foldout>
        </section>

        <section className="mt-8 overflow-hidden rounded-[1.35rem] border border-accent/24 bg-accent/[0.07] p-4 shadow-[0_24px_90px_hsl(var(--accent)/0.12)] backdrop-blur-xl md:mt-14 md:rounded-[1.75rem] md:p-8">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center md:gap-5">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.26em] text-accent md:text-[10px] md:tracking-[0.3em]">Custom</p>
              <h2 className="mt-1 font-heading text-3xl uppercase leading-none md:mt-2 md:text-6xl">Custom protocol?</h2>
              <p className="mt-2 max-w-xl font-body text-xs leading-snug text-foreground/58 md:mt-3 md:text-base md:leading-relaxed">
                Tell us the goal. We will guide the protocol.
              </p>
            </div>
            <PremiumButton
              as={Link}
              to="/book"
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[1rem] bg-foreground px-5 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background md:min-h-[58px] md:rounded-[1.25rem] md:px-6 md:text-[11px] md:tracking-[0.18em]"
            >
              Start <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </PremiumButton>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
