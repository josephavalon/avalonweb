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
  Zap,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE, premiumListContainer, premiumStaggerItem, premiumTap } from '@/lib/motion';
import { IV_SESSIONS } from '@/config/verticals';
import { slugify } from '@/data/products';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const FEATURED_KEYS = ['hydration', 'energy', 'myers', 'recovery', 'nad', 'cbd'];
const HIDDEN_PUBLIC_PROTOCOL_KEYS = new Set([]);
const DOSE_PROTOCOL_KEYS = new Set(['nad', 'cbd']);
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

function includesText(session) {
  if (session.inside) return session.inside;
  if (session.doses?.length) return `${session.doses.length} dose options`;
  return session.desc || session.tagline || 'Clinician-guided protocol';
}

function bookingPathForSession(session) {
  const params = new URLSearchParams();
  if (session.key) params.set('protocol', session.key);
  params.set('time', 'asap');
  return `/book?${params.toString()}`;
}

const DETAIL_SLUG_BY_KEY = {
  hydration: 'hydration-iv',
  myers: 'myers-cocktail-iv',
  postnight: 'post-night-out-iv',
  immunity: 'immunity-iv',
  energy: 'energy-iv',
  recovery: 'recovery-iv',
  beauty: 'beauty-iv',
  jetlag: 'jet-lag-iv',
};

function detailPathForSession(session) {
  if (session.key === 'nad') return '/products/nad/nad-250mg';
  if (session.key === 'cbd') return '/products/cbd/cbd-33mg';
  return `/products/iv-vitamins/${DETAIL_SLUG_BY_KEY[session.key] || slugify(`${session.label} IV`)}`;
}

function doseIntroFor(session) {
  if (session.key === 'nad') return 'Dose menu';
  if (session.key === 'cbd') return 'Approval-gated';
  return 'Dose options';
}

function doseNoteFor(session) {
  if (session.key === 'nad') return 'Higher mg = longer appointment window.';
  if (session.key === 'cbd') return 'Eligibility confirmed before treatment.';
  return '';
}

function compactDuration(value = '') {
  return String(value).replace(/\s*min\b/i, 'm').replace(/\s*hr\b/i, ' hr');
}

function DoseLadder({ session }) {
  if (!session.doses?.length) return null;
  const doseCount = session.doses.length;
  const first = session.doses[0];
  const last = session.doses[doseCount - 1];

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-foreground/10 bg-background/32 p-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
      <div className="mb-2 grid gap-1 px-1 sm:flex sm:items-end sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="font-body text-[9px] font-black uppercase tracking-[0.15em] text-foreground/54">{doseIntroFor(session)}</p>
          {doseNoteFor(session) && (
            <p className="mt-0.5 truncate font-body text-[10px] font-bold leading-none text-foreground/48">{doseNoteFor(session)}</p>
          )}
        </div>
        <p className="shrink-0 font-body text-[9px] font-black uppercase tracking-[0.12em] text-foreground/42">
          {first.label}-{last.label}
        </p>
      </div>
      <div className="grid gap-1.5 md:grid-cols-2">
        {session.doses.map((dose, doseIndex) => (
          <Link
            key={dose.key || dose.label}
            to={`${bookingPathForSession(session)}&dose=${encodeURIComponent(dose.key || dose.label)}`}
            className={`group/dose min-h-[54px] rounded-xl border px-2.5 py-2 text-left transition-colors ${
              doseIndex === 0
                ? 'border-foreground/24 bg-foreground/[0.10]'
                : 'border-foreground/9 bg-background/34 hover:border-foreground/18 hover:bg-background/48'
            }`}
          >
            <span className="block font-body text-xs font-black uppercase leading-none tracking-[0.05em] text-foreground">{dose.label}</span>
            <span className="mt-1 flex items-center justify-between gap-2 font-body text-[10px] font-bold leading-none text-foreground/58">
              <span>{money(dose.price)}</span>
              <span className="truncate text-foreground/42">{compactDuration(dose.duration)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function sortSessions(sessions) {
  return [...sessions].sort((a, b) => {
    const aFeatured = FEATURED_ORDER.has(a.key) ? FEATURED_ORDER.get(a.key) : 100 + (DEFAULT_ORDER.get(a.key) || 0);
    const bFeatured = FEATURED_ORDER.has(b.key) ? FEATURED_ORDER.get(b.key) : 100 + (DEFAULT_ORDER.get(b.key) || 0);
    return aFeatured - bFeatured;
  });
}

function ProtocolCard({ session, index = 0 }) {
  const Icon = session.icon || Droplets;
  const bagSrc = session.image || session.doses?.[0]?.image;

  return (
    <MotionLink
      to={detailPathForSession(session)}
      layout
      variants={premiumStaggerItem}
      transition={{ ...CARD_TRANSITION, delay: Math.min(index * 0.025, 0.12), layout: CARD_TRANSITION }}
      className="av-glass-card group relative min-w-0 overflow-hidden rounded-[1.15rem] border border-foreground/12 bg-background/85 p-2.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl transition-colors hover:border-foreground/24 hover:bg-background/92 md:rounded-[1.35rem] md:p-3"
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.08),transparent_38%)]" />
      <span className="relative flex min-h-[72px] w-full min-w-0 items-center gap-2.5 text-left md:min-h-[84px] md:gap-3">
        <div className="flex h-[3.5rem] w-11 shrink-0 items-center justify-center md:h-[4rem] md:w-12">
          {bagSrc ? (
            <img src={bagSrc} alt="" loading="lazy" className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)]" />
          ) : (
            <Icon className="h-5 w-5 text-foreground md:h-[22px] md:w-[22px]" strokeWidth={2.4} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-heading text-[1.5rem] uppercase leading-none tracking-normal text-foreground md:text-[2rem]">
                {session.label}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 font-body text-xs font-bold text-foreground/78 md:text-sm">
                <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                {session.duration || session.doses?.[0]?.duration || '45-60 min'}
              </p>
              <p className="mt-1 font-heading text-[1.35rem] leading-none text-foreground sm:hidden">{money(priceFor(session))}</p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="font-heading text-[1.85rem] leading-none text-foreground md:text-[2.1rem]">{money(priceFor(session))}</p>
              <p className="font-body text-[9px] font-black uppercase tracking-[0.12em] text-foreground/58">from</p>
            </div>
          </div>
        </div>
        <span className="relative shrink-0 text-foreground/70 transition-transform group-hover:translate-x-1" aria-hidden="true">
          <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
        </span>
      </span>
    </MotionLink>
  );
}

function CustomProtocolRow() {
  return (
    <MotionLink
      to="/custom?mode=subscription"
      whileTap={premiumTap}
      className="av-glass-card group relative min-w-0 overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/85 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl transition-colors hover:border-foreground/24 hover:bg-background/92 md:rounded-[1.6rem] md:p-4"
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.12),transparent_38%),linear-gradient(135deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.028))]" />
      <span className="relative flex min-h-[88px] w-full min-w-0 items-center gap-3 text-left md:min-h-[104px] md:gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-foreground/14 bg-foreground/[0.06] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] md:h-16 md:w-16">
          <FlaskConical className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heading text-[2.05rem] uppercase leading-none tracking-normal text-foreground md:text-[2.95rem]">
            Custom
          </span>
          <span className="mt-1 block font-body text-base font-bold text-foreground/64 md:text-lg">
            Build your own protocol
          </span>
        </span>
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-background/30 text-foreground/72 transition-colors group-hover:border-foreground/28 group-hover:text-foreground">
          <ArrowRight className="h-5 w-5" strokeWidth={2.35} />
        </span>
      </span>
    </MotionLink>
  );
}

function ProtocolList({ id, sessions, includeCustom = false }) {
  return (
    <LayoutGroup id={id}>
      <motion.div
        key={id}
        layout
        initial="hidden"
        animate="show"
        variants={premiumListContainer(0.04, 0.05)}
        className="relative grid grid-cols-1 gap-2 py-3 md:gap-3 md:py-4"
      >
        <AnimatePresence mode="popLayout">
          {sessions.map((session, index) => (
            <ProtocolCard key={session.key} session={session} index={index} />
          ))}
          {includeCustom && <CustomProtocolRow />}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  );
}

function Foldout({ title, icon: Icon, children, open: controlledOpen, onToggle }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const toggle = onToggle || (() => setLocalOpen((value) => !value));

  return (
    <div className="av-glass-card relative overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/85 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl md:rounded-[1.6rem]">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.08),transparent_38%)]" />
      <button
        type="button"
        onClick={toggle}
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
      {open && (
        <SmoothDisclosure open>
          <div className="relative border-t border-foreground/8 px-4">
            {children}
          </div>
        </SmoothDisclosure>
      )}
    </div>
  );
}

export default function Menu() {
  const [openSections, setOpenSections] = useState({});

  useSeo({
    title: 'Mobile IV Therapy Bay Area — Avalon Vitality',
    description: 'Choose Avalon mobile IV therapy for hydration, recovery, performance, longevity, and future mobile clinical services.',
    path: '/protocols',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'Avalon Vitality IV Therapy',
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

  const filtered = useMemo(() => sortSessions(PUBLIC_SESSIONS), []);
  const vitaminSessions = useMemo(() => filtered.filter((session) => !DOSE_PROTOCOL_KEYS.has(session.key)), [filtered]);
  const nadSessions = useMemo(() => filtered.filter((session) => session.key === 'nad'), [filtered]);
  const cbdSessions = useMemo(() => filtered.filter((session) => session.key === 'cbd'), [filtered]);
  const toggleSection = (key) => setOpenSections((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <Navbar />

      <main className="mx-auto w-full max-w-[calc(100vw-2rem)] overflow-x-hidden px-0 pb-20 pt-24 md:max-w-6xl md:px-8 md:pt-32">
        <section className="relative">
          <div
            className="av-glass-card relative overflow-hidden rounded-[1.55rem] border border-foreground/12 bg-background/38 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_30px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl md:max-w-3xl md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0"
          >
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--foreground)/0.10),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.052),transparent_54%,hsl(var(--foreground)/0.026))] md:hidden" />
            <p className="relative mb-3 font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/58">Choose a therapy base</p>
            <h1 className="relative font-heading text-[4.6rem] uppercase leading-[0.82] tracking-normal text-foreground md:text-display-xl">
              IV Therapy
            </h1>
          </div>
        </section>

        <section className="mt-8 grid gap-2 scroll-mt-44 md:mt-14 md:gap-3">
          <div id="iv-vitamins" className="scroll-mt-44">
            <Foldout title="IV Therapy" icon={Droplets} open={Boolean(openSections.vitamins)} onToggle={() => toggleSection('vitamins')}>
              <ProtocolList id="iv-vitamins-protocols" sessions={vitaminSessions} />
            </Foldout>
          </div>
          <div id="iv-nad" className="scroll-mt-44">
            <Foldout title="IV NAD+" icon={BatteryCharging} open={Boolean(openSections.nad)} onToggle={() => toggleSection('nad')}>
              <ProtocolList id="iv-nad-protocols" sessions={nadSessions} />
            </Foldout>
          </div>
          <div id="iv-cbd" className="scroll-mt-44">
            <Foldout title="CBD IV Therapy" icon={Zap} open={Boolean(openSections.cbd)} onToggle={() => toggleSection('cbd')}>
              <ProtocolList id="iv-cbd-protocols" sessions={cbdSessions} />
            </Foldout>
          </div>
        </section>

        <section id="protocol-directory" className="mt-4 scroll-mt-44 md:mt-6">
          <Foldout title="All Protocols" icon={FlaskConical} open={Boolean(openSections.all)} onToggle={() => toggleSection('all')}>
            <ProtocolList id="all-protocols" sessions={filtered} includeCustom />
          </Foldout>
        </section>

      </main>

      <Footer />
    </div>
  );
}
