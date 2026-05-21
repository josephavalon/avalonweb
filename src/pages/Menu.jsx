import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Clock, ChevronDown } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE } from '@/lib/motion';
import { IV_SESSIONS, IV_ADDONS, IM_SHOTS } from '@/config/verticals';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, delay, ease: EASE },
});

// Group add-ons by `group` key for NAD+/CBD, leave others ungrouped
function groupAddons(addons) {
  const groups = {};
  const standalone = [];
  addons.forEach((a) => {
    if (a.group) {
      if (!groups[a.group]) groups[a.group] = [];
      groups[a.group].push(a);
    } else {
      standalone.push(a);
    }
  });
  return { standalone, groups };
}

// ── Components ─────────────────────────────────────────────────────────────────

function SectionLabel({ eyebrow, heading }) {
  return (
    <div className="mb-10 md:mb-14">
      <motion.p {...fadeUp(0)} className="font-body text-[10px] tracking-[0.35em] uppercase text-accent mb-3">
        {eyebrow}
      </motion.p>
      <motion.h2 {...fadeUp(0.06)} className="font-heading text-4xl md:text-6xl text-foreground tracking-wide uppercase leading-none">
        {heading}
      </motion.h2>
    </div>
  );
}

function DripCard({ session, i }) {
  const [open, setOpen] = useState(false);
  const [selectedDose, setSelectedDose] = useState(session.doses?.[0] ?? null);
  const Icon = session.icon;
  const ingredients = session.inside ? session.inside.split(' · ') : [];
  const displayPrice = selectedDose ? selectedDose.price : session.price;
  const displayDuration = selectedDose ? selectedDose.duration : session.duration;
  const bookKey = selectedDose ? selectedDose.key : session.key;

  return (
    <motion.div
      {...fadeUp(0.04 + i * 0.04)}
      className="border border-foreground/[0.08] rounded-2xl bg-foreground/[0.02] overflow-hidden hover:border-foreground/[0.12] transition-colors"
    >
      {/* Accordion header — always visible */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-foreground/[0.02] transition-colors"
        aria-expanded={open}
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-foreground/[0.05] border border-foreground/[0.08] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-accent" strokeWidth={1.5} />
        </div>

        {/* Name + tag */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading text-xl md:text-2xl text-foreground tracking-wide uppercase leading-tight">
              {session.label}
            </h3>
            {session.tag && (
              <span className="font-body text-[9px] tracking-[0.2em] uppercase text-accent/80 border border-accent/25 rounded-full px-2 py-0.5 shrink-0">
                {session.tag}
              </span>
            )}
          </div>
          <p className="font-heading text-lg text-foreground tracking-wide mt-0.5">
            {session.doses ? 'From ' : ''}<span>${displayPrice.toLocaleString()}</span>
            <span className="font-body text-[10px] text-foreground/35 tracking-normal ml-1">/ session</span>
          </p>
        </div>

        {/* Duration + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1 text-foreground/30">
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            <span className="font-body text-[10px]">{displayDuration}</span>
          </div>
          <ChevronDown
            className="w-4 h-4 text-foreground/30 transition-transform duration-300"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            strokeWidth={1.8}
          />
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-foreground/[0.06] px-5 pt-4 pb-5 space-y-4">

              {/* Duration on mobile */}
              <div className="sm:hidden flex items-center gap-1 text-foreground/30">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                <span className="font-body text-[10px]">{displayDuration}</span>
              </div>

              {/* Tagline */}
              <p className="font-body text-sm text-foreground/55 leading-relaxed">{session.tagline}</p>

              {/* Dose selector — inline radio chips */}
              {session.doses && (
                <div>
                  <p className="font-body text-[10px] tracking-[0.22em] uppercase text-foreground/30 mb-2">Select dose</p>
                  <div className="flex flex-wrap gap-2">
                    {session.doses.map((dose) => {
                      const active = selectedDose?.key === dose.key;
                      return (
                        <button
                          key={dose.key}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedDose(dose); }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-body text-xs transition-all ${
                            active
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-foreground/[0.12] text-foreground/60 hover:border-foreground/30 hover:text-foreground'
                          }`}
                        >
                          <span className="font-semibold">{dose.label}</span>
                          <span className={active ? 'text-background/55' : 'text-foreground/35'}>${dose.price.toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ingredients */}
              {ingredients.length > 0 && (
                <div>
                  <p className="font-body text-[10px] tracking-[0.22em] uppercase text-foreground/30 mb-2">Ingredients</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ingredients.map((ing) => (
                      <span key={ing} className="font-body text-[10px] px-2.5 py-1 rounded-full border border-foreground/[0.08] text-foreground/55 bg-foreground/[0.03]">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="flex items-center gap-3 pt-1">
                <Link
                  to={`/therapies/${session.key}`}
                  className="flex-1 flex items-center justify-center font-body text-[11px] tracking-[0.18em] uppercase py-3 px-4 rounded-xl border border-foreground/[0.10] text-foreground/60 hover:text-foreground hover:border-foreground/25 transition-colors"
                >
                  Details
                </Link>
                <Link
                  to="/book"
                  className="flex-1 flex items-center justify-center gap-2 font-body text-[11px] tracking-[0.18em] uppercase py-3 px-4 rounded-xl bg-accent/10 border border-accent/30 text-accent hover:bg-accent/15 transition-colors"
                >
                  Book
                  <ArrowRight className="w-3 h-3" strokeWidth={2} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AddonRow({ addon, i }) {
  return (
    <motion.div
      {...fadeUp(0.03 + i * 0.03)}
      className="flex items-start justify-between gap-4 py-4 border-b border-foreground/[0.06] last:border-0"
    >
      <div className="flex-1">
        <p className="font-body text-sm text-foreground font-medium">{addon.label}</p>
        {addon.desc && (
          <p className="font-body text-[11px] text-foreground/40 mt-0.5 leading-relaxed">{addon.desc}</p>
        )}
      </div>
      <span className="font-heading text-lg text-foreground tracking-wide shrink-0">${addon.price}</span>
    </motion.div>
  );
}

function AddonGroup({ name, items, startIdx }) {
  return (
    <div className="mb-2 rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-foreground/[0.06] bg-foreground/[0.03]">
        <p className="font-body text-[10px] tracking-[0.2em] uppercase text-accent">
          {name === 'nad' ? 'NAD+ — Dose Tiers' : 'CBD IV — Dose Tiers'}
        </p>
      </div>
      <div className="px-4">
        {items.map((addon, i) => (
          <AddonRow key={addon.label} addon={addon} i={startIdx + i} />
        ))}
      </div>
    </div>
  );
}

function ShotRow({ shot, i }) {
  const Icon = shot.icon;
  return (
    <motion.div
      {...fadeUp(0.03 + i * 0.03)}
      className="flex items-center justify-between gap-4 py-4 border-b border-foreground/[0.06] last:border-0"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-foreground/[0.04] border border-foreground/[0.07] flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-foreground/50" strokeWidth={1.5} />
          </div>
        )}
        <div>
          <p className="font-body text-sm text-foreground font-medium">{shot.label}</p>
          {shot.desc && (
            <p className="font-body text-[11px] text-foreground/40 mt-0.5">{shot.desc}</p>
          )}
        </div>
      </div>
      <span className="font-heading text-lg text-foreground tracking-wide shrink-0">${shot.price}</span>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Menu() {
  useSeo({
    title: 'Full Menu — Avalon Vitality IV Therapy',
    description: 'Browse every IV drip, add-on, and IM shot offered by Avalon Vitality. Mobile IV therapy in San Francisco and the Bay Area.',
    path: '/menu',
  });

  const { standalone: standaloneAddons, groups: addonGroups } = groupAddons(IV_ADDONS);

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="pt-32 md:pt-40 pb-12 md:pb-16 px-6 md:px-16 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <motion.p {...fadeUp(0)} className="font-body text-[10px] tracking-[0.35em] uppercase text-accent mb-4">
            IV Therapy · San Francisco
          </motion.p>
          <motion.h1 {...fadeUp(0.06)} className="font-heading text-5xl md:text-8xl text-foreground tracking-wide uppercase leading-none mb-5">
            FULL MENU
          </motion.h1>
          <motion.p {...fadeUp(0.12)} className="font-body text-base md:text-lg text-foreground/50 max-w-xl leading-relaxed mb-8">
            Every protocol, add-on, and IM shot — physician-formulated and delivered to your location by licensed RNs.
          </motion.p>
          <motion.div {...fadeUp(0.16)} className="flex items-center gap-4">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 font-body text-[11px] tracking-[0.2em] uppercase px-6 py-3 rounded-full bg-accent text-background hover:bg-accent/90 transition-colors"
            >
              Book Now
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
            <span className="font-body text-[11px] text-foreground/30 tracking-[0.1em] uppercase">Same-day available</span>
          </motion.div>
        </div>
      </section>

      {/* ── IV Drips ──────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-6 md:px-16 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <SectionLabel eyebrow="IV Therapy" heading="IV DRIPS" />
          <div className="space-y-2">
            {IV_SESSIONS.map((session, i) => (
              <DripCard key={session.key} session={session} i={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Add-Ons ───────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-6 md:px-16 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <SectionLabel eyebrow="Customize your drip" heading="IV ADD-ONS" />
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* Standalone add-ons */}
            <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] overflow-hidden">
              <div className="px-4 py-3 border-b border-foreground/[0.06] bg-foreground/[0.03]">
                <p className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/45">Standard Add-Ons</p>
              </div>
              <div className="px-4">
                {standaloneAddons.map((addon, i) => (
                  <AddonRow key={addon.label} addon={addon} i={i} />
                ))}
              </div>
            </div>

            {/* Dose-tiered groups (NAD+, CBD) */}
            <div className="space-y-4">
              {Object.entries(addonGroups).map(([groupKey, items], gi) => (
                <AddonGroup key={groupKey} name={groupKey} items={items} startIdx={gi * 3} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── IM Shots ──────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-6 md:px-16">
        <div className="max-w-6xl mx-auto">
          <SectionLabel eyebrow="Stand-alone or added to any drip" heading="IM SHOTS" />
          <div className="max-w-2xl">
            <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] overflow-hidden">
              <div className="px-4 py-3 border-b border-foreground/[0.06] bg-foreground/[0.03]">
                <p className="font-body text-[10px] tracking-[0.2em] uppercase text-foreground/45">Intramuscular Injections</p>
              </div>
              <div className="px-4">
                {IM_SHOTS.map((shot, i) => (
                  <ShotRow key={shot.label} shot={shot} i={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
