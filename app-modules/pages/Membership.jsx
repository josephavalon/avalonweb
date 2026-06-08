import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BatteryCharging,
  Calendar,
  Check,
  ChevronDown,
  Droplets,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Syringe,
  Users,
} from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import { useSeo } from '@/lib/seo';
import { SUBSCRIPTION_TIERS } from '@/config/subscriptionTiers';
import { IV_SESSIONS } from '@/config/verticals';

const EASE = [0.16, 1, 0.3, 1];
const TERMS = [
  { key: 'monthly', label: 'Monthly', detail: '3 mo min', months: 1, discount: 0 },
  { key: 'six-month', label: '6 months', detail: '8% off', months: 6, discount: 0.08 },
  { key: 'annual', label: '12 months', detail: '15% off', months: 12, discount: 0.15 },
];

const PLAN_PRESETS = {
  starter: { sessions: 1, therapy: 'hydration', ivAddons: 1, imShots: 0, cadence: 'Monthly', rollover: true, priority: true, sharing: false, nurse: false, concierge: false },
  pro: { sessions: 2, therapy: 'recovery', ivAddons: 2, imShots: 1, cadence: 'Every 2 weeks', rollover: true, priority: true, sharing: false, nurse: false, concierge: true },
  vip: { sessions: 4, therapy: 'nad', ivAddons: 3, imShots: 2, cadence: 'Weekly', rollover: true, priority: true, sharing: true, nurse: true, concierge: true },
  custom: { sessions: 4, therapy: 'custom', ivAddons: 4, imShots: 4, cadence: 'Fully custom', rollover: true, priority: true, sharing: true, nurse: true, concierge: true },
};

const CADENCES = ['Monthly', 'Every 2 weeks', 'Weekly', 'Fully custom'];
const THERAPIES = [
  { key: 'hydration', label: 'Hydration', icon: Droplets },
  { key: 'myers', label: "Myers'", icon: Sparkles },
  { key: 'recovery', label: 'Recovery', icon: ShieldCheck },
  { key: 'energy', label: 'Energy', icon: BatteryCharging },
  { key: 'nad', label: 'NAD+', icon: BatteryCharging },
  { key: 'custom', label: 'Custom', icon: Sparkles },
];
const FEATURE_CONTROLS = [
  { key: 'rollover', label: 'Credit rollover', icon: Calendar },
  { key: 'priority', label: 'Priority booking', icon: ShieldCheck },
  { key: 'sharing', label: 'Household sharing', icon: Users },
  { key: 'nurse', label: 'Dedicated RN', icon: Syringe },
  { key: 'concierge', label: 'Concierge planning', icon: Sparkles },
];

function currency(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return 'Custom';
  return `$${Math.round(Number(value)).toLocaleString()}`;
}

function estimateMonthly(tier, config) {
  if (tier.custom || !tier.price) return null;
  const sessionDelta = Math.max(0, Number(config.sessions || 0) - Number(tier.sessions || 0)) * 175;
  const addonDelta = Math.max(0, Number(config.ivAddons || 0) - Math.max(1, Number(tier.sessions || 1))) * 25;
  const shotDelta = Math.max(0, Number(config.imShots || 0) - Number.parseInt(tier.shotCredit, 10) || 0) * 35;
  return Number(tier.price || 0) + sessionDelta + addonDelta + shotDelta;
}

function termPrice(monthly, term) {
  if (!monthly) return null;
  return Math.max(0, Math.round(monthly * term.months * (1 - term.discount)));
}

function buildInitialConfig(tier) {
  return { ...(PLAN_PRESETS[tier.key] || PLAN_PRESETS.starter) };
}

function getProtocolForTherapy(key) {
  if (key === 'custom') return 'recovery';
  return IV_SESSIONS.some((item) => item.key === key) ? key : 'recovery';
}

function StepRail() {
  return (
    <div className="mt-3 flex items-center gap-0">
      {['Plan', 'Customize', 'Term', 'Book'].map((item, index) => (
        <React.Fragment key={item}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-body text-[10px] font-black ${
            index === 1 ? 'border-foreground bg-foreground text-background' : 'border-foreground/18 bg-background/34 text-foreground/62'
          }`}>
            {index + 1}
          </span>
          {index < 3 && <span className="h-px flex-1 bg-foreground/16" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function PlanCard({ tier, active, monthly, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`av-treatment-card relative grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-[1rem] border px-3 py-2.5 text-left transition-colors md:min-h-[92px] md:px-4 ${
        active ? 'is-open border-foreground/46 bg-foreground/[0.12]' : ''
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate font-heading text-[1.7rem] uppercase leading-none text-foreground md:text-[2.2rem]">{tier.name}</span>
        <span className="mt-1 block truncate font-body text-[10px] font-black uppercase tracking-[0.12em] text-foreground/54 md:text-xs">
          {tier.custom ? 'Every feature custom' : tier.note}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-body text-lg font-black leading-none text-foreground md:text-2xl">{currency(monthly)}</span>
        <span className="mt-1 block font-body text-[8px] font-black uppercase tracking-[0.1em] text-foreground/44 md:text-[10px]">
          {tier.custom ? 'Design' : '/ mo'}
        </span>
      </span>
    </button>
  );
}

function OptionButton({ active, label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`av-treatment-card flex min-h-[56px] min-w-0 items-center justify-between gap-2 rounded-[0.9rem] border px-2.5 text-left transition-colors md:min-h-[62px] md:px-3 ${
        active ? 'is-open border-foreground/46 bg-foreground/[0.12]' : ''
      }`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-foreground/78" strokeWidth={2.35} />}
        <span className="min-w-0 whitespace-normal font-body text-[10px] font-black uppercase leading-tight tracking-[0.03em] text-foreground/74 md:text-[11px]">{label}</span>
      </span>
      {active && <Check className="h-4 w-4 shrink-0" strokeWidth={2.7} />}
    </button>
  );
}

function Stepper({ label, value, min = 0, max = 12, onChange }) {
  return (
    <div className="av-treatment-card rounded-[0.95rem] border p-2.5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="whitespace-normal font-body text-[9px] font-black uppercase leading-tight tracking-[0.03em] text-foreground/56 md:text-[10px]">{label}</p>
          <p className="mt-1 font-body text-[1.8rem] font-black leading-none text-foreground md:text-[2rem]">{value}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/14 bg-background/34 text-foreground"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/14 bg-background/34 text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MobilePlansFlow({
  tiers,
  activeTier,
  activeTerm,
  activeConfig,
  monthly,
  dueToday,
  configs,
  onTier,
  onTerm,
  onConfig,
  onSubmit,
}) {
  const [mobileStep, setMobileStep] = useState('plan');
  const steps = [
    { key: 'plan', label: 'Plan' },
    { key: 'term', label: 'Term' },
    { key: 'therapy', label: 'Therapy' },
    { key: 'features', label: 'Features' },
  ];
  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === mobileStep));
  const advance = () => {
    if (activeIndex >= steps.length - 1) onSubmit();
    else setMobileStep(steps[activeIndex + 1].key);
  };

  const renderMobileOptions = () => {
    if (mobileStep === 'term') {
      return (
        <div className="grid gap-1.5">
          <p className="font-body text-[8px] font-black uppercase tracking-[0.18em] text-foreground/48">Choose term</p>
          {TERMS.map((term) => (
            <button
              key={term.key}
              type="button"
              onClick={() => onTerm(term.key)}
              aria-pressed={activeTerm.key === term.key}
              className={`av-treatment-card grid min-h-[56px] grid-cols-[1fr_auto] items-center gap-2 rounded-xl border px-3 text-left ${activeTerm.key === term.key ? 'is-open border-foreground/46 bg-foreground/[0.12]' : ''}`}
            >
              <span>
                <span className="block font-body text-[10px] font-black uppercase tracking-[0.1em] text-foreground/76">{term.label}</span>
                <span className="mt-0.5 block font-body text-[8px] font-black uppercase tracking-[0.08em] text-foreground/46">{term.detail}</span>
              </span>
              {activeTerm.key === term.key && <Check className="h-4 w-4" strokeWidth={2.7} />}
            </button>
          ))}
        </div>
      );
    }

    if (mobileStep === 'therapy') {
      return (
        <div className="grid gap-1.5">
          <p className="font-body text-[8px] font-black uppercase tracking-[0.18em] text-foreground/48">Customize therapy</p>
          <div className="grid grid-cols-2 gap-1.5">
            {THERAPIES.map((therapy) => {
              const Icon = therapy.icon;
              return (
                <button
                  key={therapy.key}
                  type="button"
                  onClick={() => onConfig({ therapy: therapy.key })}
                  className={`av-treatment-card flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 font-body text-[8px] font-black uppercase tracking-[0.06em] text-foreground/72 ${activeConfig.therapy === therapy.key ? 'is-open border-foreground/46 bg-foreground/[0.12]' : ''}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{therapy.label}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ['IV / mo', 'sessions', 1],
              ['Add-ons', 'ivAddons', 0],
              ['IM shots', 'imShots', 0],
            ].map(([label, key, min]) => (
              <div key={key} className="av-treatment-card rounded-xl border p-2">
                <p className="truncate font-body text-[7px] font-black uppercase tracking-[0.06em] text-foreground/48">{label}</p>
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <button type="button" onClick={() => onConfig({ [key]: Math.max(min, activeConfig[key] - 1) })} className="flex h-7 w-7 items-center justify-center rounded-full border border-foreground/14"><Minus className="h-3 w-3" /></button>
                  <span className="font-body text-xl font-black leading-none text-foreground">{activeConfig[key]}</span>
                  <button type="button" onClick={() => onConfig({ [key]: Math.min(activeTier.custom ? 12 : 8, activeConfig[key] + 1) })} className="flex h-7 w-7 items-center justify-center rounded-full border border-foreground/14"><Plus className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (mobileStep === 'features') {
      return (
        <div className="grid gap-1.5">
          <p className="font-body text-[8px] font-black uppercase tracking-[0.18em] text-foreground/48">Every feature</p>
          <div className="grid grid-cols-2 gap-1.5">
            {FEATURE_CONTROLS.map((feature) => {
              const Icon = feature.icon;
              return (
                <button
                  key={feature.key}
                  type="button"
                  onClick={() => onConfig({ [feature.key]: !activeConfig[feature.key] })}
                  className={`av-treatment-card flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-2.5 text-left ${activeConfig[feature.key] ? 'is-open border-foreground/46 bg-foreground/[0.12]' : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-foreground/76" />
                    <span className="font-body text-[7px] font-black uppercase leading-tight tracking-[0.04em] text-foreground/70">{feature.label}</span>
                  </span>
                  {activeConfig[feature.key] && <Check className="h-4 w-4 shrink-0" strokeWidth={2.7} />}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-1.5">
        <p className="font-body text-[8px] font-black uppercase tracking-[0.18em] text-foreground/48">Choose plan</p>
        {tiers.map((tier) => (
          <button
            key={tier.key}
            type="button"
            onClick={() => onTier(tier)}
            aria-pressed={activeTier.key === tier.key}
            className={`av-treatment-card grid min-h-[58px] grid-cols-[1fr_auto] items-center gap-2 rounded-xl border px-3 text-left ${activeTier.key === tier.key ? 'is-open border-foreground/46 bg-foreground/[0.12]' : ''}`}
          >
            <span className="min-w-0">
              <span className="block truncate font-heading text-[1.55rem] uppercase leading-none text-foreground">{tier.name}</span>
              <span className="mt-0.5 block truncate font-body text-[8px] font-black uppercase tracking-[0.08em] text-foreground/50">{tier.custom ? 'Every feature custom' : tier.note}</span>
            </span>
            <span className="font-body text-lg font-black leading-none text-foreground">{currency(estimateMonthly(tier, configs[tier.key] || buildInitialConfig(tier)))}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <section className="grid h-full min-h-0 gap-1.5 overflow-hidden md:hidden">
      <div className="av-glass-card grid min-h-0 grid-rows-[auto_auto_1fr_auto] gap-1.5 overflow-hidden rounded-[1.2rem] border bg-background/58 p-2.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl">
        <div>
          <p className="font-body text-[8px] font-black uppercase tracking-[0.18em] text-foreground/50">{activeIndex + 1} of 4 · {steps[activeIndex].label}</p>
          <h1 className="mt-0.5 font-heading text-[2.45rem] uppercase leading-none text-foreground">Plans</h1>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {steps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              onClick={() => setMobileStep(step.key)}
              aria-pressed={mobileStep === step.key}
              className={`av-treatment-card min-h-[34px] rounded-lg border px-1 text-center font-body text-[7px] font-black uppercase tracking-[0.06em] ${mobileStep === step.key ? 'is-open border-foreground/46 bg-foreground/[0.12] text-foreground' : 'text-foreground/54'}`}
            >
              {index + 1}. {step.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 overflow-hidden">
          {renderMobileOptions()}
        </div>

        <div className="av-treatment-card grid min-h-[56px] grid-cols-[1fr_auto] items-center gap-2 rounded-xl border px-3">
          <div className="min-w-0">
            <p className="truncate font-body text-[7px] font-black uppercase tracking-[0.12em] text-foreground/50">{activeTier.name} · {activeTerm.label} · {activeConfig.cadence}</p>
            <p className="mt-0.5 font-body text-xl font-black leading-none text-foreground">{currency(dueToday || monthly)}</p>
          </div>
          <button
            type="button"
            onClick={advance}
            className="flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-[10px] font-black uppercase tracking-[0.08em] text-background"
          >
            {activeIndex >= steps.length - 1 ? 'Book' : 'Next'} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function Subscription() {
  useSeo({
    title: 'Plans - Avalon Vitality',
    description: 'Customize Avalon monthly IV therapy plans with therapy focus, cadence, add-ons, IM shots, and concierge features.',
    path: '/subscription',
  });

  const navigate = useNavigate();
  const [activeTierKey, setActiveTierKey] = useState('pro');
  const [activeTermKey, setActiveTermKey] = useState('monthly');
  const [configs, setConfigs] = useState(() => (
    SUBSCRIPTION_TIERS.reduce((next, tier) => {
      next[tier.key] = buildInitialConfig(tier);
      return next;
    }, {})
  ));

  const activeTier = SUBSCRIPTION_TIERS.find((tier) => tier.key === activeTierKey) || SUBSCRIPTION_TIERS[1];
  const activeTerm = TERMS.find((term) => term.key === activeTermKey) || TERMS[0];
  const activeConfig = configs[activeTier.key] || buildInitialConfig(activeTier);
  const monthly = useMemo(() => estimateMonthly(activeTier, activeConfig), [activeTier, activeConfig]);
  const dueToday = termPrice(monthly, activeTerm);

  const updateConfig = (patch) => {
    setConfigs((current) => ({
      ...current,
      [activeTier.key]: {
        ...(current[activeTier.key] || buildInitialConfig(activeTier)),
        ...patch,
      },
    }));
  };

  const selectTier = (tier) => {
    setActiveTierKey(tier.key);
    setConfigs((current) => current[tier.key] ? current : { ...current, [tier.key]: buildInitialConfig(tier) });
  };

  const startPlan = () => {
    const params = new URLSearchParams({
      reset: '1',
      subscription: activeTier.key,
      term: activeTerm.key,
      protocol: getProtocolForTherapy(activeConfig.therapy),
      time: 'asap',
    });
    navigate(`/book?${params.toString()}`);
  };

  return (
    <div className="app-shell relative isolate h-[100svh] w-full overflow-hidden bg-transparent text-foreground">
      <Navbar />
      <main className="mx-auto h-[100svh] min-h-0 w-full max-w-[calc(100vw-2rem)] overflow-hidden pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-[5.25rem] md:max-w-[1540px] md:px-4 md:pb-3 md:pt-24">
        <MobilePlansFlow
          tiers={SUBSCRIPTION_TIERS}
          activeTier={activeTier}
          activeTerm={activeTerm}
          activeConfig={activeConfig}
          monthly={monthly}
          dueToday={dueToday}
          configs={configs}
          onTier={selectTier}
          onTerm={setActiveTermKey}
          onConfig={updateConfig}
          onSubmit={startPlan}
        />
        <section className="mx-auto hidden h-[calc(100svh-7rem)] min-h-0 gap-3 md:grid md:grid-cols-[minmax(300px,420px)_minmax(0,1fr)_minmax(320px,420px)] md:gap-4">
          <motion.aside
            initial={{ opacity: 1, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="av-glass-card relative overflow-hidden rounded-[1.2rem] border bg-background/58 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-4"
          >
            <p className="font-body text-[9px] font-black uppercase tracking-[0.2em] text-foreground/48">1 of 4 · Plans</p>
            <h1 className="mt-2 font-heading text-[3.8rem] uppercase leading-[0.82] text-foreground md:text-[5.4rem]">Plans</h1>
            <StepRail />
            <div className="mt-4 grid gap-2">
              {SUBSCRIPTION_TIERS.map((tier) => (
                <PlanCard
                  key={tier.key}
                  tier={tier}
                  active={activeTier.key === tier.key}
                  monthly={estimateMonthly(tier, configs[tier.key] || buildInitialConfig(tier))}
                  onClick={() => selectTier(tier)}
                />
              ))}
            </div>
          </motion.aside>

          <motion.section
            initial={{ opacity: 1, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE, delay: 0.03 }}
            className="av-glass-card relative min-h-0 overflow-y-auto rounded-[1.2rem] border bg-background/50 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-body text-[9px] font-black uppercase tracking-[0.2em] text-foreground/48">2 of 4 · Customize</p>
                <h2 className="mt-2 font-heading text-[2.8rem] uppercase leading-none text-foreground md:text-[4rem]">{activeTier.name}</h2>
              </div>
              <span className="rounded-full border border-foreground/12 bg-background/34 px-3 py-2 font-body text-[10px] font-black uppercase tracking-[0.12em] text-foreground/64">
                {activeTier.custom ? 'Every feature' : 'Editable'}
              </span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <p className="font-body text-[9px] font-black uppercase tracking-[0.18em] text-foreground/48">Cadence</p>
                <div className="grid grid-cols-1 gap-1.5 2xl:grid-cols-2">
                  {CADENCES.map((cadence) => (
                    <OptionButton
                      key={cadence}
                      label={cadence}
                      icon={Calendar}
                      active={activeConfig.cadence === cadence}
                      onClick={() => updateConfig({ cadence })}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="font-body text-[9px] font-black uppercase tracking-[0.18em] text-foreground/48">IV focus</p>
                <div className="grid grid-cols-1 gap-1.5 2xl:grid-cols-2">
                  {THERAPIES.map((therapy) => (
                    <OptionButton
                      key={therapy.key}
                      label={therapy.label}
                      icon={therapy.icon}
                      active={activeConfig.therapy === therapy.key}
                      onClick={() => updateConfig({ therapy: therapy.key })}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-1 2xl:grid-cols-3">
              <Stepper label="IV sessions" value={activeConfig.sessions} min={1} max={activeTier.custom ? 12 : 8} onChange={(sessions) => updateConfig({ sessions })} />
              <Stepper label="IV add-ons" value={activeConfig.ivAddons} min={0} max={activeTier.custom ? 12 : 8} onChange={(ivAddons) => updateConfig({ ivAddons })} />
              <Stepper label="IM shots" value={activeConfig.imShots} min={0} max={activeTier.custom ? 12 : 8} onChange={(imShots) => updateConfig({ imShots })} />
            </div>

            <div className="mt-3">
              <p className="font-body text-[9px] font-black uppercase tracking-[0.18em] text-foreground/48">Plan features</p>
              <div className="mt-2 grid grid-cols-1 gap-1.5 2xl:grid-cols-5">
                {FEATURE_CONTROLS.map((feature) => (
                  <OptionButton
                    key={feature.key}
                    label={feature.label}
                    icon={feature.icon}
                    active={Boolean(activeConfig[feature.key])}
                    onClick={() => updateConfig({ [feature.key]: !activeConfig[feature.key] })}
                  />
                ))}
              </div>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 1, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE, delay: 0.06 }}
            className="av-glass-card relative overflow-hidden rounded-[1.2rem] border bg-background/58 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-4"
          >
            <p className="font-body text-[9px] font-black uppercase tracking-[0.2em] text-foreground/48">3 of 4 · Term</p>
            <div className="mt-3 grid gap-2">
              {TERMS.map((term) => (
                <OptionButton
                  key={term.key}
                  label={`${term.label} · ${term.detail}`}
                  icon={ChevronDown}
                  active={activeTerm.key === term.key}
                  onClick={() => setActiveTermKey(term.key)}
                />
              ))}
            </div>

            <div className="mt-4 rounded-[1rem] border border-foreground/12 bg-background/36 p-3">
              <p className="font-body text-[9px] font-black uppercase tracking-[0.18em] text-foreground/48">Due today</p>
              <p className="mt-2 font-body text-[2.4rem] font-black leading-none text-foreground">{currency(dueToday || monthly)}</p>
              <p className="mt-2 font-body text-sm font-bold leading-snug text-foreground/62">
                {activeTier.custom ? 'Final pricing is designed with Avalon.' : `${currency(monthly)} monthly estimate.`}
              </p>
              <div className="mt-3 grid gap-2 font-body text-xs font-bold text-foreground/66">
                <span>{activeConfig.sessions} IV sessions / mo</span>
                <span>{activeConfig.ivAddons} IV add-ons / mo</span>
                <span>{activeConfig.imShots} IM shots / mo</span>
                <span>{activeConfig.cadence}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={startPlan}
              className="mt-3 hidden min-h-[58px] w-full items-center justify-center gap-3 rounded-xl border border-foreground/82 bg-foreground px-5 font-body text-sm font-black uppercase tracking-[0.08em] text-background md:flex"
            >
              {activeTier.custom ? 'Build custom plan' : 'Start plan'} <ArrowRight className="h-5 w-5" />
            </button>
          </motion.aside>
        </section>
      </main>
    </div>
  );
}
