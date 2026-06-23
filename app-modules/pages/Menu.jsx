import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from '@/components/ui/PageTransitionMotion';
import {
  ArrowRight,
  ChevronDown,
  Droplets,
  FlaskConical,
} from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE, premiumHover, premiumListContainer, premiumStaggerItem, premiumTap } from '@/lib/motion';
import { IV_SESSIONS } from '@/config/verticals';
import { slugify } from '@/data/products';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import ExitStoreDialog from '@/components/store/ExitStoreDialog';
import useBackExitConfirm from '@/hooks/useBackExitConfirm';

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

// Normalize a session (or a single dose of a dose-protocol) into one chip's data.
function protocolItems(sessions, expandDoses = false) {
  return sessions.flatMap((session) => {
    if (expandDoses && session.doses?.length) {
      return session.doses.map((dose) => ({
        key: `${session.key}-${dose.key || dose.label}`,
        label: `${session.label} ${dose.label}`.trim(),
        price: dose.price,
        image: dose.image || session.image,
        icon: session.icon,
        to: `${bookingPathForSession(session)}&dose=${encodeURIComponent(dose.key || dose.label)}`,
      }));
    }
    return [{
      key: session.key,
      label: session.label,
      price: priceFor(session),
      image: session.image || session.doses?.[0]?.image,
      icon: session.icon,
      to: detailPathForSession(session),
    }];
  });
}

function ProtocolCard({ item, index = 0 }) {
  const Icon = item.icon || Droplets;

  return (
    <MotionLink
      to={item.to}
      layout
      variants={premiumStaggerItem}
      whileHover={premiumHover}
      whileTap={premiumTap}
      transition={{ ...CARD_TRANSITION, delay: Math.min(index * 0.025, 0.12), layout: CARD_TRANSITION }}
      className="av-treatment-chip group grid min-h-[88px] grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3.5 rounded-xl border px-3.5 py-2.5 transition-colors duration-base ease-editorial"
    >
      {item.image ? (
        <img src={item.image} alt="" loading="lazy" className="h-[4.5rem] w-14 shrink-0 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]" />
      ) : (
        <span className="flex h-[4.5rem] w-14 items-center justify-center">
          <Icon className="h-6 w-6 text-foreground/45 shrink-0" strokeWidth={1.6} />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-heading text-[1.15rem] uppercase leading-none tracking-[0.04em] text-foreground">{item.label}</p>
        <p className="mt-1 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/50">From {money(item.price)}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-foreground/35 transition-transform duration-base ease-editorial group-hover:translate-x-1 group-hover:text-foreground" strokeWidth={2} />
    </MotionLink>
  );
}

function ProtocolList({ id, sessions, expandDoses = false }) {
  const items = protocolItems(sessions, expandDoses);
  return (
    <LayoutGroup id={id}>
      <motion.div
        key={id}
        layout
        initial="hidden"
        animate="show"
        variants={premiumListContainer(0.04, 0.05)}
        className="relative grid grid-cols-1 gap-2 py-3 md:grid-cols-2 md:gap-3 md:py-4"
      >
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <ProtocolCard key={item.key} item={item} index={index} />
          ))}
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
    <div className="av-treatment-card relative overflow-hidden rounded-[1.35rem] transition-colors md:rounded-[1.6rem]">
      <button
        type="button"
        onClick={toggle}
        className="relative flex min-h-[76px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-foreground/[0.035] md:min-h-[88px] md:px-5"
        aria-expanded={open}
      >
        <span className="av-treatment-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-foreground">
          <Icon className="h-5 w-5 text-foreground/66" strokeWidth={1.8} />
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
  const exitConfirm = useBackExitConfirm();

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
          <div className="relative md:max-w-3xl">
            <p className="relative mb-3 font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/58">Choose a therapy base</p>
            <h1 className="relative font-heading text-[4.6rem] uppercase leading-[0.82] tracking-normal text-foreground md:text-display-xl">
              IV Therapy
            </h1>
          </div>
        </section>

        <section className="mt-8 grid gap-2 scroll-mt-44 md:mt-14 md:gap-3">
          <div id="iv-vitamins" className="scroll-mt-44">
            <Foldout title="IV Vitamins" icon={Droplets} open={Boolean(openSections.vitamins)} onToggle={() => toggleSection('vitamins')}>
              <ProtocolList id="iv-vitamins-protocols" sessions={vitaminSessions} />
            </Foldout>
          </div>
          <div id="iv-nad" className="scroll-mt-44">
            <Foldout title="IV NAD+" icon={FlaskConical} open={Boolean(openSections.nad)} onToggle={() => toggleSection('nad')}>
              <ProtocolList id="iv-nad-protocols" sessions={nadSessions} expandDoses />
            </Foldout>
          </div>
          <div id="iv-cbd" className="scroll-mt-44">
            <Foldout title="IV CBD Therapy" icon={CannabisLeaf} open={Boolean(openSections.cbd)} onToggle={() => toggleSection('cbd')}>
              <ProtocolList id="iv-cbd-protocols" sessions={cbdSessions} expandDoses />
            </Foldout>
          </div>
        </section>

        <section id="protocol-directory" className="mt-4 scroll-mt-44 md:mt-6">
          <Foldout title="View All" icon={FlaskConical} open={Boolean(openSections.all)} onToggle={() => toggleSection('all')}>
            <ProtocolList id="all-protocols" sessions={filtered} />
          </Foldout>
        </section>

      </main>

      <Footer />

      <ExitStoreDialog
        open={exitConfirm.open}
        onKeepShopping={exitConfirm.onKeepShopping}
        onExit={exitConfirm.onExit}
      />
    </div>
  );
}
