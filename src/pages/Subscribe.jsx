import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BatteryCharging, CalendarDays, Check, ChevronDown,
  CreditCard, Dumbbell, HeartPulse, RefreshCw, ShieldCheck, Sparkles, Users, Zap,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { IV_ADDONS, IV_SESSIONS, IM_SHOTS } from '@/config/verticals';
import { useSeo } from '@/lib/seo';
import Navbar from '@/components/landing/Navbar';

const EASE = [0.16, 1, 0.3, 1];
const DISCOUNT = 0.10;

const STEPS = ['Goal', 'Protocol', 'Add-ons', 'Frequency', 'Checkout'];

const GOALS = [
  { key: 'recovery',    label: 'Recovery',        sub: 'Feel better fast',        icon: HeartPulse,     category: 'recovery' },
  { key: 'energy',      label: 'Energy',           sub: 'Boost and recharge',      icon: Zap,            category: 'energy'   },
  { key: 'immunity',    label: 'Immunity',         sub: 'Support your defense',    icon: ShieldCheck,    category: 'immunity' },
  { key: 'beauty',      label: 'Beauty / Glow',    sub: 'Radiate from within',     icon: Sparkles,       category: 'beauty'   },
  { key: 'performance', label: 'Performance',      sub: 'Optimize your edge',      icon: Dumbbell,       category: 'energy'   },
  { key: 'longevity',   label: 'Longevity',        sub: 'Invest in your future',   icon: BatteryCharging, category: 'energy'  },
];

const FREQUENCIES = [
  { key: 'weekly',      label: 'Weekly',      sub: '4× per month',  multiplier: 4 },
  { key: 'biweekly',   label: 'Bi-Weekly',   sub: '2× per month',  multiplier: 2 },
  { key: 'monthly',    label: 'Monthly',     sub: '1× per month',  multiplier: 1 },
];

const ADDON_GROUPS = [
  {
    key: 'iv',
    title: 'IV Add Ons',
    sub: 'Boost your drip with fluids, antioxidants, and specialty pushes.',
    items: IV_ADDONS.map((addon) => ({ ...addon, cartKey: `iv-${addon.label}`, type: 'addon' })),
  },
  {
    key: 'im',
    title: 'IM Add Ons',
    sub: 'Fast intramuscular shots for targeted support.',
    items: IM_SHOTS.map((shot) => ({ ...shot, cartKey: `im-${shot.label}`, type: 'im' })),
  },
];
const ADDONS = ADDON_GROUPS.flatMap((g) => g.items);

function StepProgress({ step }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2">
        {STEPS.map((label, index) => {
          const active = index === step;
          const done   = index < step;
          return (
            <React.Fragment key={label}>
              <div className={`h-3 w-3 rounded-full border transition-all duration-300 ${done || active ? 'bg-foreground border-foreground' : 'bg-transparent border-foreground/15'}`} aria-label={label} />
              {index < STEPS.length - 1 && (
                <div className={`h-px flex-1 transition-colors duration-300 ${index < step ? 'bg-foreground/45' : 'bg-foreground/12'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function OptionCard({ active, icon: Icon, title, sub, meta, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className={`w-full flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all ${
        active
          ? 'border-foreground bg-foreground text-background shadow-[0_18px_45px_hsl(var(--foreground)/0.16)]'
          : 'border-foreground/[0.10] bg-card/[0.72] hover:border-foreground/25'
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${active ? 'border-background/25 bg-background/10' : 'border-foreground/[0.08] bg-foreground/[0.04]'}`}>
        <Icon className="h-4 w-4" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-sm font-semibold tracking-[0.02em]">{title}</span>
        {sub && <span className={`mt-0.5 block font-body text-[11px] ${active ? 'text-background/65' : 'text-foreground/45'}`}>{sub}</span>}
      </span>
      {meta && <span className={`font-body text-xs font-semibold ${active ? 'text-background' : 'text-foreground'}`}>{meta}</span>}
    </motion.button>
  );
}

function AddonGroup({ group, selected, open, onToggleOpen, onToggleAddon }) {
  const selectedCount = group.items.filter((item) => selected.has(item.label)).length;
  return (
    <div className="overflow-hidden rounded-2xl border border-foreground/[0.10] bg-card/[0.72]">
      <button type="button" onClick={onToggleOpen} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left">
        <span>
          <span className="block font-body text-xs font-semibold uppercase tracking-[0.24em] text-foreground">{group.title}</span>
          <span className="mt-1 block font-body text-[11px] leading-relaxed text-foreground/45">{selectedCount ? `${selectedCount} selected` : group.sub}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="font-body text-xs font-semibold text-foreground/45">{group.items.length}</span>
          <ChevronDown className={`h-4 w-4 text-foreground transition-transform duration-300 ${open ? 'rotate-180' : ''}`} strokeWidth={1.8} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: EASE }} className="overflow-hidden border-t border-foreground/[0.08]">
            <div className="px-4 pb-2">
              {group.items.map((addon) => {
                const active = selected.has(addon.label);
                return (
                  <button key={addon.cartKey} type="button" onClick={() => onToggleAddon(addon.label)} className="flex w-full items-center gap-3 border-b border-foreground/[0.07] py-4 text-left last:border-b-0">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? 'border-foreground bg-foreground text-background' : 'border-foreground/18'}`}>
                      {active && <Check className="h-3 w-3" strokeWidth={2.5} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-body text-sm font-semibold text-foreground">{addon.label}</span>
                      {addon.desc && <span className="mt-0.5 block font-body text-[10px] leading-relaxed text-foreground/40">{addon.desc}</span>}
                    </span>
                    <span className="font-body text-sm font-semibold text-foreground">${addon.price}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Frame({ step, title, sub, badge, children, footer }) {
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[hsl(var(--background))] px-6 pb-28 pt-28 md:pt-32">
      <div className="mx-auto max-w-sm">
        <StepProgress step={step} />
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 18, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -18, filter: 'blur(6px)' }}
            transition={{ duration: 0.42, ease: EASE }}
          >
            {badge && (
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-foreground/[0.10] bg-foreground/[0.04] px-3 py-1 font-body text-[10px] font-semibold tracking-[0.18em] uppercase text-foreground/55">
                <RefreshCw className="h-2.5 w-2.5" strokeWidth={2} />
                {badge}
              </span>
            )}
            <h1 className="font-heading text-4xl uppercase leading-[0.9] text-foreground">{title}</h1>
            {sub && <p className="mt-4 font-body text-sm leading-relaxed text-foreground/55">{sub}</p>}
            <div className="mt-7 space-y-3">{children}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      {footer}
    </div>
  );
}

export default function Subscribe() {
  useSeo({
    title: 'Subscribe & Save — Avalon Vitality',
    description: 'Build your recurring IV therapy protocol and save 10% on every visit.',
    path: '/subscribe',
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedKey = searchParams.get('protocol');

  const { addItem, clearItems } = useCart();

  const [step, setStep]           = useState(0);
  const [goal, setGoal]           = useState(GOALS[0]);
  const [protocol, setProtocol]   = useState(
    IV_SESSIONS.find((s) => s.key === preselectedKey) ||
    IV_SESSIONS.find((s) => s.key === 'myers') ||
    IV_SESSIONS[0]
  );
  const [addons, setAddons]       = useState(new Set());
  const [frequency, setFrequency] = useState(FREQUENCIES[2]); // monthly default
  const [openAddonGroups, setOpenAddonGroups] = useState({ iv: false, im: false });

  const recommendedProtocols = useMemo(() => {
    const filtered = IV_SESSIONS.filter((s) => s.category === goal.category);
    return (filtered.length ? filtered : IV_SESSIONS).slice(0, 6);
  }, [goal]);

  const selectedAddons = ADDONS.filter((a) => addons.has(a.label));

  const basePrice     = protocol.price + selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const discounted    = Math.round(basePrice * (1 - DISCOUNT));
  const monthlyTotal  = discounted * frequency.multiplier;

  const toggleAddon = (label) => {
    setAddons((cur) => {
      const next = new Set(cur);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const toggleAddonGroup = (key) =>
    setOpenAddonGroups((cur) => ({ iv: false, im: false, [key]: !cur[key] }));

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const confirmSubscription = () => {
    clearItems();
    addItem({ cartKey: protocol.key, label: protocol.label, price: discounted, type: 'iv', subscription: true, frequency: frequency.key });
    selectedAddons.forEach((a) => {
      addItem({ cartKey: a.cartKey, label: a.type === 'im' ? `IM · ${a.label}` : a.label, price: Math.round(a.price * (1 - DISCOUNT)), type: a.type, subscription: true });
    });
    navigate('/checkout?mode=subscription');
  };

  const footer = (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-6 pb-5">
      <div className="flex gap-3">
        {step > 0 && (
          <button type="button" onClick={back} className="flex h-14 w-14 items-center justify-center rounded-2xl border border-foreground/[0.12] bg-background text-foreground" aria-label="Back">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          onClick={step === STEPS.length - 1 ? confirmSubscription : next}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-foreground font-body text-xs font-semibold uppercase tracking-[0.22em] text-background shadow-[0_18px_50px_hsl(var(--foreground)/0.18)]"
        >
          {step === STEPS.length - 1 ? 'Confirm Subscription' : 'Continue'}
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar showBack />

      {/* Step 0 — Goal */}
      {step === 0 && (
        <Frame step={step} title="What's your goal?" sub="We'll recommend a protocol built around it." badge="Subscribe & Save 10%" footer={footer}>
          {GOALS.map((item) => (
            <OptionCard
              key={item.key}
              active={goal.key === item.key}
              icon={item.icon}
              title={item.label}
              sub={item.sub}
              onClick={() => {
                setGoal(item);
                const match = IV_SESSIONS.find((s) => s.category === item.category);
                if (match) setProtocol(match);
              }}
            />
          ))}
        </Frame>
      )}

      {/* Step 1 — Protocol */}
      {step === 1 && (
        <Frame step={step} title="Choose your protocol" sub="Clinician designed. Results driven." footer={footer}>
          {recommendedProtocols.map((item) => (
            <OptionCard
              key={item.key}
              active={protocol.key === item.key}
              icon={item.icon}
              title={item.label}
              sub={item.tagline}
              meta={`$${Math.round(item.price * (1 - DISCOUNT))}/visit`}
              onClick={() => setProtocol(item)}
            />
          ))}
        </Frame>
      )}

      {/* Step 2 — Add-ons */}
      {step === 2 && (
        <Frame step={step} title="Add-ons" sub="Enhance your results." footer={footer}>
          {ADDON_GROUPS.map((group) => (
            <AddonGroup
              key={group.key}
              group={group}
              selected={addons}
              open={openAddonGroups[group.key]}
              onToggleOpen={() => toggleAddonGroup(group.key)}
              onToggleAddon={toggleAddon}
            />
          ))}
        </Frame>
      )}

      {/* Step 3 — Frequency */}
      {step === 3 && (
        <Frame step={step} title="How often?" sub="Your RN comes to you on your schedule." footer={footer}>
          {FREQUENCIES.map((item) => (
            <OptionCard
              key={item.key}
              active={frequency.key === item.key}
              icon={RefreshCw}
              title={item.label}
              sub={item.sub}
              meta={`$${discounted * item.multiplier}/mo`}
              onClick={() => setFrequency(item)}
            />
          ))}
        </Frame>
      )}

      {/* Step 4 — Review */}
      {step === 4 && (
        <Frame step={step} title="Review & subscribe" sub="10% off every visit, cancel anytime." footer={null}>
          <div className="space-y-4 rounded-2xl border border-foreground/[0.10] bg-card/[0.72] p-5">
            <div className="flex justify-between gap-4">
              <span className="font-body text-sm font-semibold text-foreground">{protocol.label}</span>
              <div className="text-right">
                <span className="block font-body text-sm font-semibold text-foreground">${discounted}</span>
                <span className="block font-body text-[10px] text-foreground/40 line-through">${protocol.price}</span>
              </div>
            </div>
            {selectedAddons.map((addon) => (
              <div key={addon.cartKey} className="flex justify-between gap-4">
                <span className="font-body text-sm text-foreground/65">{addon.label}</span>
                <span className="font-body text-sm text-foreground">${Math.round(addon.price * (1 - DISCOUNT))}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-foreground/[0.10] pt-4">
              <span className="font-body text-sm text-foreground/60">Frequency</span>
              <span className="font-body text-sm font-semibold text-foreground">{frequency.label} ({frequency.sub})</span>
            </div>
            <div className="flex justify-between border-t border-foreground/[0.10] pt-4">
              <span className="font-body text-sm font-semibold text-foreground/60">Savings</span>
              <span className="font-body text-sm font-semibold text-foreground">10% off every visit</span>
            </div>
            <div className="flex items-end justify-between border-t border-foreground/[0.10] pt-4">
              <span className="font-body text-base font-semibold text-foreground">Monthly Total</span>
              <span className="font-heading text-3xl text-foreground">${monthlyTotal}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.10] bg-card/[0.68] p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
              <p className="font-body text-xs text-foreground/60">{frequency.label} · {frequency.sub}</p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <CalendarDays className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
              <p className="font-body text-xs text-foreground/60">First visit scheduled after confirmation</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={confirmSubscription}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 font-body text-xs font-semibold uppercase tracking-[0.22em] text-background"
            >
              <CreditCard className="h-4 w-4" strokeWidth={2} />
              Confirm Subscription
            </button>
            <button
              type="button"
              onClick={back}
              className="flex w-full items-center justify-center rounded-2xl border border-foreground/[0.12] bg-card/[0.68] py-4 font-body text-xs font-semibold uppercase tracking-[0.22em] text-foreground/65"
            >
              Back
            </button>
            <p className="text-center font-body text-[10px] text-foreground/30">
              3-month minimum · Credits roll over · Cancel with 7 days notice
            </p>
          </div>
        </Frame>
      )}
    </div>
  );
}
