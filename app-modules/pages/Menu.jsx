import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

const HERO_GOALS = [
  { key: 'hydration', label: 'Hydration', icon: Droplets, href: '/book?protocol=hydration&time=asap' },
  { key: 'energy', label: 'Energy', icon: Zap, href: '/book?protocol=energy&time=asap' },
  { key: 'longevity', label: 'NAD+', icon: BatteryCharging, href: '/book?protocol=nad&time=asap' },
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
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
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

function GoalTile({ item, index }) {
  const Icon = item.icon;
  const content = (
    <motion.span
      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, delay: 0.16 + index * 0.08, ease: EASE }}
      className="av-glass-card group relative flex min-h-[54px] min-w-0 items-center gap-2 overflow-hidden rounded-full border border-foreground/12 bg-background/42 px-2.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl transition-colors hover:border-foreground/24 hover:bg-background/54 md:min-h-[116px] md:gap-3 md:rounded-[1.6rem] md:px-4 lg:gap-4 lg:px-5"
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.12),transparent_38%),linear-gradient(135deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.028))]" />
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.06] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] md:h-12 md:w-12 md:rounded-2xl">
        <Icon className="h-4.5 w-4.5 md:h-5 md:w-5" strokeWidth={2.4} />
      </span>
      <span className="relative min-w-0 flex-1 truncate font-body text-[9px] font-black uppercase leading-none tracking-[0.1em] text-foreground md:whitespace-normal md:text-clip md:font-heading md:text-[1.55rem] md:leading-[0.9] md:tracking-normal lg:text-[1.8rem]">
        {item.label}
      </span>
      <span className="relative hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-background/36 text-foreground transition-transform group-hover:translate-x-1 sm:flex md:h-9 md:w-9">
        <ArrowRight className="h-4 w-4" strokeWidth={2.35} />
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
      className="av-glass-card group relative min-w-0 overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/44 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl transition-colors hover:border-foreground/24 hover:bg-background/56 md:rounded-[1.6rem] md:p-4"
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.12),transparent_38%),linear-gradient(135deg,hsl(var(--foreground)/0.055),transparent_55%,hsl(var(--foreground)/0.028))]" />
      <div className="relative flex min-w-0 items-start gap-3 md:gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-foreground/14 bg-foreground/[0.06] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] md:h-16 md:w-16">
          <Icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-heading text-[2.05rem] uppercase leading-none tracking-normal text-foreground md:text-[2.95rem]">
                {session.label}
              </h2>
              <p className="mt-1 flex items-center gap-2 font-body text-base font-bold text-foreground/78 md:text-lg">
                <Clock className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                {session.duration || session.doses?.[0]?.duration || '45-60 min'}
              </p>
              <p className="mt-1 font-heading text-[1.85rem] leading-none text-foreground sm:hidden">{money(priceFor(session))}</p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
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
          <DoseLadder session={session} />
          <div className="mt-4">
            <Link
              to={bookingPathForSession(session)}
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
    <div className="av-glass-card relative overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/44 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl md:rounded-[1.6rem]">
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

  const filtered = useMemo(() => sortSessions(PUBLIC_SESSIONS), []);
  const visibleSessions = showAllProtocols ? filtered : filtered.slice(0, 6);
  const standardAddons = IV_ADDONS.filter((item) => !item.group).slice(0, 8);
  const shotPreview = IM_SHOTS.slice(0, 8);

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <Navbar />

      <main className="mx-auto w-full max-w-[calc(100vw-2rem)] overflow-x-hidden px-0 pb-20 pt-24 md:max-w-6xl md:px-8 md:pt-32">
        <section className="relative">
          <motion.div
            initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, ease: EASE }}
            className="av-glass-card relative overflow-hidden rounded-[1.55rem] border border-foreground/12 bg-background/38 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_30px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl md:max-w-3xl md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0"
          >
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--foreground)/0.10),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.052),transparent_54%,hsl(var(--foreground)/0.026))] md:hidden" />
            <p className="relative mb-3 font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/58">Choose a therapy base</p>
            <h1 className="relative font-heading text-[4.6rem] uppercase leading-[0.82] tracking-normal text-foreground md:text-display-xl">
              Protocols
            </h1>
          </motion.div>

          <div className="mt-5 grid min-w-0 grid-cols-2 gap-2 md:mt-10 md:grid-cols-4 md:gap-3">
            {HERO_GOALS.map((item, index) => (
              <GoalTile key={item.key} item={item} index={index} />
            ))}
          </div>
        </section>

        <section id="protocol-directory" className="mt-8 scroll-mt-28 md:mt-14">
          <div className="relative min-w-0 overflow-hidden rounded-[1.55rem] border border-foreground/12 bg-background/34 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_30px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl md:rounded-[1.9rem] md:p-5">
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--foreground)/0.10),transparent_34%),linear-gradient(145deg,hsl(var(--foreground)/0.052),transparent_54%,hsl(var(--foreground)/0.026))]" />
            <div className="relative mb-4">
              <h2 className="font-heading text-[3rem] uppercase leading-none tracking-normal text-foreground md:text-[4.75rem]">IV</h2>
            </div>

            <LayoutGroup id="menu-protocols">
              <motion.div
                key={showAllProtocols ? 'all-open' : 'all-preview'}
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

        <section className="av-glass-card mt-4 overflow-hidden rounded-[1.35rem] border border-foreground/12 bg-background/44 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_22px_86px_hsl(var(--foreground)/0.075)] backdrop-blur-2xl md:mt-6 md:rounded-[1.6rem] md:p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <h2 className="font-heading text-[2.7rem] uppercase leading-none tracking-normal md:text-[4rem]">Custom?</h2>
            <PremiumButton
              as={Link}
              to="/custom?mode=subscription"
              className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-full bg-foreground px-6 font-body text-xs font-black uppercase tracking-[0.14em] text-background"
            >
              Build Custom <ArrowRight className="h-4 w-4" strokeWidth={2.35} />
            </PremiumButton>
          </div>
        </section>
      </main>

      {typeof document !== 'undefined' && createPortal(<div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/[0.10] bg-background/94 px-4 pt-3 backdrop-blur-2xl md:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.85rem)' }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-body text-[10px] font-black uppercase tracking-[0.24em] text-foreground/38">Start</p>
            <p className="mt-1 truncate font-body text-sm font-semibold text-foreground">Book from $50 deposit</p>
          </div>
          <Link
            to="/book"
            className="flex min-h-[60px] min-w-[148px] items-center justify-center gap-2 rounded-[1.35rem] bg-foreground px-5 font-body text-[11px] font-black uppercase tracking-[0.18em] text-background"
          >
            Book <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        </div>
      </div>, document.body)}

      <Footer />
    </div>
  );
}
