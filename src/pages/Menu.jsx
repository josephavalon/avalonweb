import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Droplets,
  Heart,
  Syringe,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE } from '@/lib/motion';
import { IV_ADDONS, IV_SESSIONS, IM_SHOTS } from '@/config/verticals';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'energy', label: 'Energy' },
  { key: 'immunity', label: 'Immunity' },
  { key: 'beauty', label: 'Glow' },
  { key: 'travel', label: 'Travel' },
  { key: 'advanced', label: 'Advanced' },
];

const HERO_GOALS = [
  { label: 'Need it today', body: 'Hydration, recovery, post-night-out, travel support.', icon: Clock, href: '/store' },
  { label: 'Not sure', body: 'Tell us the outcome and we will guide the protocol.', icon: Heart, href: '/store' },
];

const FEATURED_KEYS = ['myers', 'hydration', 'recovery', 'immunity'];
const ADVANCED_KEYS = ['nad', 'cbd', 'exosomes'];

function priceFor(session) {
  return session.price || session.doses?.[0]?.price || 0;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function productHrefForSession(session) {
  const routes = {
    hydration: '/products/iv-vitamins/hydration',
    energy: '/products/iv-vitamins/energy',
    immunity: '/products/iv-vitamins/immunity',
    beauty: '/products/iv-vitamins/beauty',
    recovery: '/products/iv-vitamins/recovery',
    jetlag: '/products/iv-vitamins/jet-lag',
    myers: '/products/iv-vitamins/myers-cocktail',
    postnight: '/products/iv-vitamins/post-night-out',
    nad: '/products/nad/nad-250mg',
    cbd: '/products/cbd/cbd-33mg',
    exosomes: '/products/exosomes/exosomes-30b-units',
  };
  return routes[session.key] ?? `/therapies/${session.key}`;
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

function OutcomeCard({ item }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      className="group flex min-h-[86px] flex-col justify-between rounded-[1.1rem] border border-foreground/[0.10] bg-foreground/[0.035] p-3 transition-colors hover:border-foreground/[0.20] hover:bg-foreground/[0.055] md:min-h-[112px] md:rounded-[1.35rem] md:p-4"
    >
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-accent md:h-5 md:w-5" strokeWidth={1.55} />
        <ArrowRight className="h-3.5 w-3.5 text-foreground/28 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/55 md:h-4 md:w-4" strokeWidth={1.8} />
      </div>
      <div>
        <p className="font-heading text-xl uppercase leading-none text-foreground md:text-2xl">{item.label}</p>
        <p className="mt-1 line-clamp-2 font-body text-[11px] leading-snug text-foreground/50 md:mt-2 md:text-xs md:leading-relaxed">{item.body}</p>
      </div>
    </Link>
  );
}

function ProtocolCard({ session, compact = false }) {
  const Icon = session.icon || Droplets;
  return (
    <article className="rounded-[1.1rem] border border-foreground/[0.10] bg-foreground/[0.035] p-3 md:rounded-[1.45rem] md:p-4">
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
              to={`/store?protocol=${session.key}`}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-foreground font-body text-[10px] font-semibold uppercase tracking-[0.17em] text-background md:min-h-[48px] md:rounded-2xl"
            >
              Start <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function CompactRow({ item, type = 'addon' }) {
  const Icon = type === 'shot' ? (item.icon || Syringe) : Droplets;
  return (
    <Link
      to={`/store?${type}=${encodeURIComponent(item.label)}`}
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
    </Link>
  );
}

function Foldout({ title, sub, icon: Icon, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[1.1rem] border border-foreground/[0.10] bg-foreground/[0.03] md:rounded-[1.45rem]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[64px] w-full items-center gap-3 px-3 text-left md:min-h-[76px] md:gap-4 md:px-4"
        aria-expanded={open}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.08] bg-background/45 text-accent md:h-11 md:w-11 md:rounded-2xl">
          <Icon className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.6} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[10px] uppercase tracking-[0.24em] text-foreground/38">{title}</span>
          <span className="mt-0.5 block font-body text-xs text-foreground/58 md:mt-1 md:text-sm">{sub}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-foreground/35 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.8} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-foreground/[0.06] px-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Menu() {
  const [filter, setFilter] = useState('all');

  useSeo({
    title: 'Mobile IV Menu — Avalon Vitality',
    description: 'A simple client menu for Avalon Vitality mobile IV therapy, add-ons, IM shots, subscriptions, and custom protocols.',
    path: '/menu',
  });

  const featured = FEATURED_KEYS.map((key) => IV_SESSIONS.find((item) => item.key === key)).filter(Boolean);
  const filtered = useMemo(() => {
    if (filter === 'all') return IV_SESSIONS;
    return IV_SESSIONS.filter((session) => categoryFor(session) === filter);
  }, [filter]);
  const standardAddons = IV_ADDONS.filter((item) => !item.group).slice(0, 8);
  const shotPreview = IM_SHOTS.slice(0, 8);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar showBack />

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-20 md:px-8 md:pt-28">
        <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-end md:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.62, ease: EASE }}
          >
            <p className="font-body text-[9px] uppercase tracking-[0.3em] text-accent md:text-[10px] md:tracking-[0.34em]">Client Menu</p>
            <h1 className="mt-2 font-heading text-[3.35rem] uppercase leading-[0.84] tracking-tight md:mt-4 md:text-[7.8rem]">
              Choose<br />By Feel.
            </h1>
            <p className="mt-3 max-w-md font-body text-sm leading-snug text-foreground/58 md:mt-5 md:text-lg md:leading-relaxed">
              Browse the menu in plain language. When you are ready, the store turns it into a simple guided booking.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-2">
            {HERO_GOALS.map((item) => (
              <OutcomeCard key={item.label} item={item} />
            ))}
          </div>
        </section>

        <section className="mt-5 grid gap-2 md:mt-10 md:grid-cols-4 md:gap-3">
          {featured.map((session) => (
            <ProtocolCard key={session.key} session={session} compact />
          ))}
        </section>

        <section className="mt-8 md:mt-14">
          <div className="mb-3 flex flex-col gap-3 md:mb-5 md:flex-row md:items-end md:justify-between md:gap-4">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.25em] text-foreground/38 md:text-[10px] md:tracking-[0.3em]">Protocols</p>
              <h2 className="mt-1 font-heading text-4xl uppercase leading-none md:mt-2 md:text-7xl">IV Menu</h2>
            </div>
            <Link
              to="/store"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-foreground px-5 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background md:min-h-[48px] md:text-[11px] md:tracking-[0.18em]"
            >
              Simple Store <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>

          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mb-4">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`min-h-[40px] shrink-0 rounded-full border px-3.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em] md:min-h-[44px] md:px-4 md:text-[11px] md:tracking-[0.14em] ${
                  filter === item.key
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-foreground/[0.12] text-foreground/58'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-2 md:gap-3">
            {filtered.map((session) => (
              <ProtocolCard key={session.key} session={session} />
            ))}
          </div>
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

        <section className="mt-8 overflow-hidden rounded-[1.35rem] border border-accent/18 bg-accent/[0.07] p-4 md:mt-14 md:rounded-[1.75rem] md:p-8">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center md:gap-5">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.26em] text-accent md:text-[10px] md:tracking-[0.3em]">Custom</p>
              <h2 className="mt-1 font-heading text-3xl uppercase leading-none md:mt-2 md:text-6xl">Need something built?</h2>
              <p className="mt-2 max-w-xl font-body text-xs leading-snug text-foreground/58 md:mt-3 md:text-base md:leading-relaxed">
                Tell us the outcome, timing, and number of people. We will guide the protocol before your visit is confirmed.
              </p>
            </div>
            <Link
              to="/store"
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[1rem] bg-foreground px-5 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background md:min-h-[58px] md:rounded-[1.25rem] md:px-6 md:text-[11px] md:tracking-[0.18em]"
            >
              Build Custom <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
