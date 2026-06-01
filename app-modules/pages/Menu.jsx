import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from '@/components/ui/PageTransitionMotion';
import {
  ArrowRight,
  BatteryCharging,
  ChevronDown,
  Clock,
  Droplets,
  FlaskConical,
  Syringe,
  Zap,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE, premiumListContainer, premiumStaggerItem, premiumTap } from '@/lib/motion';
import PremiumButton from '@/components/ui/PremiumButton';
import { IV_ADDONS, IV_SESSIONS, IM_SHOTS } from '@/config/verticals';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const FILTERS = [
  { key: 'all', label: 'All protocols', icon: FlaskConical },
  { key: 'recovery', label: 'Hydration', icon: Droplets },
  { key: 'energy', label: 'Energy', icon: Zap },
  { key: 'advanced', label: 'Longevity', icon: BatteryCharging },
];

const SORTS = [
  { key: 'featured', label: 'Featured' },
  { key: 'price', label: 'Price' },
  { key: 'az', label: 'A-Z' },
];

const HERO_GOALS = [
  { key: 'hydration', label: 'Hydration', icon: Droplets, href: '/book?outcome=recover&protocol=hydration' },
  { key: 'energy', label: 'Energy', icon: Zap, href: '/book?outcome=perform&protocol=energy' },
  { key: 'longevity', label: 'Longevity', icon: BatteryCharging, href: '/book?outcome=longevity&protocol=nad' },
  { key: 'all', label: 'All Protocols', icon: FlaskConical, href: '#protocol-directory' },
];

const FEATURED_KEYS = ['hydration', 'energy', 'myers', 'recovery', 'nad', 'cbd'];
const ADVANCED_KEYS = ['nad', 'cbd', 'exosomes'];
const HIDDEN_PUBLIC_PROTOCOL_KEYS = new Set(['exosomes']);
const PUBLIC_SESSIONS = IV_SESSIONS.filter((session) => !HIDDEN_PUBLIC_PROTOCOL_KEYS.has(session.key));
const DEFAULT_ORDER = new Map(PUBLIC_SESSIONS.map((session, index) => [session.key, index]));
const FEATURED_ORDER = new Map(FEATURED_KEYS.map((key, index) => [key, index]));

const CONTROL_TRANSITION = { duration: 0.48, ease: EASE };
const CARD_TRANSITION = { duration: 0.54, ease: EASE };
const MotionLink = motion.create(Link);

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
  if (session.doses?.length) return `${session.doses.length} dose options`;
  return session.desc || session.tagline || 'Clinician-guided protocol';
}

function categoryFor(session) {
  if (ADVANCED_KEYS.includes(session.key)) return 'advanced';
  return session.category || 'all';
}

function sortSessions(sessions, sort) {
  const list = [...sessions];
  if (sort === 'price') return list.sort((a, b) => priceFor(a) - priceFor(b));
  if (sort === 'az') return list.sort((a, b) => a.label.localeCompare(b.label));
  return list.sort((a, b) => {
    const aFeatured = FEATURED_ORDER.has(a.key) ? FEATURED_ORDER.get(a.key) : 100 + (DEFAULT_ORDER.get(a.key) || 0);
    const bFeatured = FEATURED_ORDER.has(b.key) ? FEATURED_ORDER.get(b.key) : 100 + (DEFAULT_ORDER.get(b.key) || 0);
    return aFeatured - bFeatured;
  });
}

function scrollChipIntoView(event) {
  event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function GoalTile({ item, index }) {
  const Icon = item.icon;
  const content = (
    <motion.span
      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, delay: 0.16 + index * 0.08, ease: EASE }}
      className="group relative flex min-h-[88px] items-center gap-4 overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/42 px-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl transition-colors hover:border-foreground/24 hover:bg-background/54 md:min-h-[116px] md:rounded-[1.6rem] md:px-5"
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.12),transparent_38%),linear-gradient(135deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.028))]" />
      <span className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-foreground/14 bg-foreground/[0.06] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] md:h-16 md:w-16">
        <Icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2.4} />
      </span>
      <span className="relative min-w-0 flex-1 font-heading text-[2.15rem] uppercase leading-none tracking-normal text-foreground md:text-[2.75rem]">
        {item.label}
      </span>
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-background/36 text-foreground transition-transform group-hover:translate-x-1">
        <ArrowRight className="h-5 w-5" strokeWidth={2.35} />
      </span>
    </motion.span>
  );

  if (item.href.startsWith('#')) {
    return (
      <a href={item.href} className="block">
        {content}
      </a>
    );
  }

  return (
    <MotionLink to={item.href} whileTap={premiumTap} className="block">
      {content}
    </MotionLink>
  );
}

function ProtocolCard({ session, index = 0 }) {
  const Icon = session.icon || Droplets;
  const pieces = includesText(session).split(' · ').filter(Boolean).slice(0, 3);

  return (
    <motion.article
      layout
      variants={premiumStaggerItem}
      transition={{ ...CARD_TRANSITION, delay: Math.min(index * 0.025, 0.12), layout: CARD_TRANSITION }}
      className="group relative overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/44 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl transition-colors hover:border-foreground/24 hover:bg-background/56 md:rounded-[1.6rem] md:p-4"
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.12),transparent_38%),linear-gradient(135deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.028))]" />
      <div className="relative flex items-start gap-3 md:gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-foreground/14 bg-foreground/[0.06] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] md:h-16 md:w-16">
          <Icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-heading text-[2.35rem] uppercase leading-none tracking-normal text-foreground md:text-[2.95rem]">
                {session.label}
              </h2>
              <p className="mt-1 flex items-center gap-2 font-body text-base font-bold text-foreground/78 md:text-lg">
                <Clock className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                {session.duration || session.doses?.[0]?.duration || '45-60 min'}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-heading text-[2.25rem] leading-none text-foreground md:text-[2.75rem]">{money(priceFor(session))}</p>
              <p className="font-body text-[10px] font-black uppercase tracking-[0.12em] text-foreground/58">from</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pieces.map((item) => (
              <span key={item} className="rounded-full border border-foreground/10 bg-foreground/[0.045] px-2.5 py-1 font-body text-[11px] font-bold text-foreground/72">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-[0.82fr_1fr] gap-2">
            <Link
              to={productHrefForSession(session)}
              className="flex min-h-[52px] items-center justify-center rounded-full border border-foreground/14 px-4 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/76 transition-colors hover:border-foreground/28 hover:text-foreground"
            >
              Details
            </Link>
            <Link
              to={`/book?protocol=${session.key}`}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-foreground px-4 font-body text-[11px] font-black uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-90"
            >
              Book <ArrowRight className="h-4 w-4" strokeWidth={2.35} />
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function CompactRow({ item, type = 'addon' }) {
  const Icon = type === 'shot' ? (item.icon || Syringe) : Droplets;
  return (
    <MotionLink
      to="/book"
      className="flex min-h-[64px] items-center gap-3 border-b border-foreground/8 py-3 last:border-b-0"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-foreground/12 bg-foreground/[0.055] text-foreground">
        <Icon className="h-5 w-5" strokeWidth={2.35} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-base font-extrabold text-foreground">{item.label}</span>
        <span className="mt-0.5 block truncate font-body text-sm font-semibold text-foreground/64">{item.desc || 'Add to visit'}</span>
      </span>
      <span className="shrink-0 font-heading text-2xl text-foreground">{money(item.price)}</span>
    </MotionLink>
  );
}

function Foldout({ title, icon: Icon, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/44 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl md:rounded-[1.6rem]">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.12),transparent_38%),linear-gradient(135deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.028))]" />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex min-h-[76px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-foreground/[0.035] md:min-h-[88px] md:px-5"
        aria-expanded={open}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-foreground/12 bg-foreground/[0.055] text-foreground">
          <Icon className="h-5 w-5" strokeWidth={2.35} />
        </span>
        <span className="min-w-0 flex-1 font-heading text-[2.1rem] uppercase leading-none tracking-normal text-foreground md:text-[2.55rem]">{title}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={CONTROL_TRANSITION} className="shrink-0 text-foreground/72" aria-hidden="true">
          <ChevronDown className="h-5 w-5" strokeWidth={2.2} />
        </motion.span>
      </button>
      <SmoothDisclosure open={open}>
        <div className="relative border-t border-foreground/8 px-4">
          {children}
        </div>
      </SmoothDisclosure>
    </div>
  );
}

export default function Menu() {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('featured');
  const [showAllProtocols, setShowAllProtocols] = useState(false);

  useSeo({
    title: 'Protocols — Avalon Vitality',
    description: 'Choose an Avalon protocol for hydration, recovery, performance, longevity, and future mobile clinical services.',
    path: '/protocols',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'Avalon Vitality Protocols',
      url: 'https://www.avalonvitality.co/protocols',
      itemListElement: PUBLIC_SESSIONS.map((session) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: session.name || session.label,
          description: session.description || session.desc || session.tagline || includesText(session),
          provider: { '@type': 'MedicalBusiness', name: 'Avalon Vitality' },
        },
        priceCurrency: 'USD',
        price: String(priceFor(session)),
      })),
    },
  });

  const filtered = useMemo(() => {
    const sessions = filter === 'all' ? PUBLIC_SESSIONS : PUBLIC_SESSIONS.filter((session) => categoryFor(session) === filter);
    return sortSessions(sessions, sort);
  }, [filter, sort]);
  const visibleSessions = showAllProtocols ? filtered : filtered.slice(0, 6);
  const standardAddons = IV_ADDONS.filter((item) => !item.group).slice(0, 8);
  const shotPreview = IM_SHOTS.slice(0, 8);

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 md:px-8 md:pt-32">
        <section className="relative">
          <motion.div
            initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, ease: EASE }}
            className="max-w-3xl"
          >
            <h1 className="font-heading text-display-xl uppercase leading-[0.86] tracking-normal text-foreground">
              Choose Your<br />Protocol
            </h1>
          </motion.div>

          <div className="mt-7 grid gap-2 md:mt-10 md:grid-cols-4 md:gap-3">
            {HERO_GOALS.map((item, index) => (
              <GoalTile key={item.key} item={item} index={index} />
            ))}
          </div>
        </section>

        <section id="protocol-directory" className="mt-8 scroll-mt-28 md:mt-14">
          <div className="relative overflow-hidden rounded-[1.55rem] border border-foreground/12 bg-background/34 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_30px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl md:rounded-[1.9rem] md:p-5">
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--foreground)/0.10),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.052),transparent_54%,hsl(var(--foreground)/0.026))]" />
            <div className="relative mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="font-heading text-[3rem] uppercase leading-none tracking-normal text-foreground md:text-[4.75rem]">Protocols</h2>
              <div className="grid grid-cols-2 gap-2 md:w-[23rem]">
                <label className="relative block">
                  <span className="sr-only">Filter protocols</span>
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    className="min-h-[54px] w-full rounded-full border border-foreground/12 bg-background/46 px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-foreground outline-none backdrop-blur-xl"
                  >
                    {FILTERS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </label>
                <label className="relative block">
                  <span className="sr-only">Sort protocols</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className="min-h-[54px] w-full rounded-full border border-foreground/12 bg-background/46 px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-foreground outline-none backdrop-blur-xl"
                  >
                    {SORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <LayoutGroup id="menu-filter-rails">
              <div className="relative mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {FILTERS.map((item) => {
                  const active = filter === item.key;
                  const Icon = item.icon;
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
                      className={`relative isolate flex min-h-[52px] shrink-0 items-center gap-2 overflow-hidden rounded-full border px-4 font-body text-xs font-black uppercase tracking-[0.1em] transition-colors ${active ? 'border-foreground bg-foreground text-background' : 'border-foreground/12 bg-background/38 text-foreground/72 hover:border-foreground/24 hover:text-foreground'}`}
                    >
                      <Icon className="relative z-10 h-4 w-4" strokeWidth={2.35} />
                      <span className="relative z-10">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </LayoutGroup>

            <LayoutGroup id="menu-protocols">
              <motion.div
                key={`${filter}-${sort}-${showAllProtocols}`}
                layout
                initial="hidden"
                animate="show"
                variants={premiumListContainer(0.04, 0.05)}
                className="relative grid gap-2 md:grid-cols-2 md:gap-3"
              >
                <AnimatePresence mode="popLayout">
                  {visibleSessions.map((session, index) => (
                    <ProtocolCard key={session.key} session={session} index={index} />
                  ))}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>

            {filtered.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllProtocols((value) => !value)}
                className="relative mt-3 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/42 font-body text-xs font-black uppercase tracking-[0.14em] text-foreground transition-colors hover:border-foreground/28 hover:bg-background/54"
              >
                {showAllProtocols ? 'Show less' : `View all ${filtered.length}`} <ArrowRight className={`h-4 w-4 transition-transform ${showAllProtocols ? '-rotate-90' : 'rotate-90'}`} strokeWidth={2.35} />
              </button>
            )}
          </div>
        </section>

        <section className="mt-4 grid gap-2 md:mt-6 md:grid-cols-2 md:gap-3">
          <Foldout title="IV Add-Ons" icon={Droplets}>
            {standardAddons.map((item) => <CompactRow key={item.label} item={item} />)}
          </Foldout>
          <Foldout title="IM Add-Ons" icon={Syringe}>
            {shotPreview.map((item) => <CompactRow key={item.label} item={item} type="shot" />)}
          </Foldout>
        </section>

        <section className="mt-4 overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/44 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl md:mt-6 md:rounded-[1.6rem] md:p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <h2 className="font-heading text-[2.7rem] uppercase leading-none tracking-normal md:text-[4rem]">Custom?</h2>
            <PremiumButton
              as={Link}
              to="/book?outcome=longevity&subscription=custom"
              className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-full bg-foreground px-6 font-body text-xs font-black uppercase tracking-[0.14em] text-background"
            >
              Build Custom <ArrowRight className="h-4 w-4" strokeWidth={2.35} />
            </PremiumButton>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
