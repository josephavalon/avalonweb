import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronRight,
  Droplets,
  Leaf,
  Minus,
  Plus,
  Sparkles,
} from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import { useSeo } from '@/lib/seo';
import { IV_SESSIONS, IV_ADDONS, IM_SHOTS } from '@/data/catalog';

const EASE = [0.16, 1, 0.3, 1];

// ── Pricing model (confirmed with the owner) ──────────────────────────────
// Per-IV base pricing, no fixed tiers:
//   - Vitamin IV = $250 each.
//   - NAD+ / CBD  = the selected dose price (starts at $350).
//   monthly = perIvPrice x IVs-per-session x sessions-per-month + add-ons.
// Discount is by time commitment: pay upfront for 3 / 6 / 12 months.
// Add-ons use full catalog price; the time discount applies to the whole plan.
const VITAMIN_IV_PRICE = 250;
const SESSION_OPTIONS = [1, 2, 3, 4];

// Upfront terms. 6mo (-8%) and 12mo (-15%) come from the web store; 3mo (-5%)
// is the owner-approved default. Change a discount in one place here.
const TERMS = [
  { key: 'three-month', label: '3 months', months: 3, discount: 0.05 },
  { key: 'six-month', label: '6 months', months: 6, discount: 0.08 },
  { key: 'annual', label: '12 months', months: 12, discount: 0.15 },
];

const money = (value) => `$${Math.round(Number(value || 0)).toLocaleString()}`;

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Therapy categories for steps 3-4.
const IV_VITAMINS = IV_SESSIONS.filter((session) => !session.doses);
const NAD_THERAPY = IV_SESSIONS.find((session) => session.key === 'nad');
const CBD_THERAPY = IV_SESSIONS.find((session) => session.key === 'cbd');

const CATEGORIES = [
  {
    key: 'iv-vitamins',
    label: 'IV Vitamins',
    icon: Droplets,
    blurb: `$${VITAMIN_IV_PRICE} per IV`,
    // Vitamin therapies are a flat $250/IV regardless of which one.
    options: IV_VITAMINS.map((s) => ({ key: s.key, label: s.label, note: s.tag, price: VITAMIN_IV_PRICE, protocol: s.key })),
  },
  {
    key: 'nad',
    label: 'NAD+',
    icon: Sparkles,
    blurb: 'From $350 per dose',
    gated: true,
    options: (NAD_THERAPY?.doses || []).map((d) => ({ key: d.key, label: `NAD+ ${d.label}`, note: `${money(d.price)} / IV`, price: d.price, protocol: 'nad' })),
  },
  {
    key: 'cbd',
    label: 'CBD IV',
    icon: Leaf,
    blurb: 'From $350 per dose',
    gated: true,
    options: (CBD_THERAPY?.doses || []).map((d) => ({ key: d.key, label: `CBD ${d.label}`, note: `${money(d.price)} / IV`, price: d.price, protocol: 'cbd' })),
  },
];

// Add-ons at full catalog price (the time discount applies to the whole plan).
const IV_ADDON_ITEMS = IV_ADDONS
  .filter((a) => !a.group)
  .map((a) => ({ key: slug(a.label), label: a.label, price: a.price, max: 4 }));
const IM_ADDON_ITEMS = IM_SHOTS.map((a) => ({ key: slug(a.label), label: a.label, price: a.price, max: a.max || 4 }));

const STEPS = [
  { key: 'often', label: 'How often' },
  { key: 'ivs', label: 'IVs / session' },
  { key: 'category', label: 'Category' },
  { key: 'therapy', label: 'Therapy' },
  { key: 'addons', label: 'Add-ons' },
  { key: 'review', label: 'Review' },
];

const STEP_TITLES = {
  often: 'How often?',
  ivs: 'IVs per session',
  category: 'Therapy category',
  therapy: 'Choose your therapy',
  addons: 'Add-ons',
  review: 'Review & checkout',
};

const STEP_SUBS = {
  often: 'How many IV visits each month.',
  ivs: 'How many drips per visit.',
  category: 'Pick your therapy family.',
  therapy: 'Select your primary therapy.',
  addons: 'Customize with boosts and shots.',
  review: 'Confirm and start your plan.',
};

// ── Shared bits ───────────────────────────────────────────────────────────

function StepHeader({ index, title, sub }) {
  return (
    <div className="mb-3">
      <p className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground/46">
        Step {index + 1} of {STEPS.length}
      </p>
      <h2 className="mt-1 font-heading text-[1.6rem] uppercase leading-[0.92] tracking-normal text-foreground">{title}</h2>
      {sub && <p className="mt-1 font-body text-xs font-semibold leading-snug text-foreground/56">{sub}</p>}
    </div>
  );
}

function SelectRow({ label, sub, price, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`av-treatment-card flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border px-3 text-left transition-colors ${
        active ? 'is-open border-foreground/46 bg-foreground/[0.12]' : 'hover:border-foreground/24'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm font-black text-foreground">{label}</span>
        {sub && <span className="mt-0.5 block truncate font-body text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/50">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {price && <span className="whitespace-nowrap font-body text-sm font-black text-foreground">{price}</span>}
        {active && <Check className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2.7} />}
      </span>
    </button>
  );
}

function QtyStepper({ label, price, value, max, onChange }) {
  return (
    <div className="av-treatment-card flex items-center justify-between gap-2 rounded-xl border p-2.5">
      <div className="min-w-0">
        <p className="truncate font-body text-[13px] font-black text-foreground">{label}</p>
        <p className="mt-0.5 font-body text-[11px] font-bold uppercase tracking-[0.06em] text-foreground/50">{money(price)} / mo</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/16 bg-background/40 text-foreground disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-5 text-center font-body text-base font-black text-foreground" aria-live="polite" aria-atomic="true">
          <span className="sr-only">{label}: </span>{value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/16 bg-background/40 text-foreground disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Step bodies (shared between desktop columns and mobile screens) ─────────

function StepOften({ sessions, onSessions }) {
  return (
    <div className="grid gap-2">
      {SESSION_OPTIONS.map((n) => (
        <SelectRow
          key={n}
          label={`${n} ${n === 1 ? 'session' : 'sessions'} / month`}
          price={`from ${money(VITAMIN_IV_PRICE * n)}/mo`}
          active={sessions === n}
          onClick={() => onSessions(n)}
        />
      ))}
      <p className="mt-1 font-body text-[11px] font-semibold leading-snug text-foreground/46">Sessions roll over 30 days. Cancel or pause anytime.</p>
    </div>
  );
}

function StepIvs({ ivs, onIvs }) {
  return (
    <div className="grid gap-2">
      {[1, 2, 3, 4].map((n) => (
        <SelectRow
          key={n}
          label={`${n} IV ${n === 1 ? 'bag' : 'bags'} / session`}
          sub={n === 1 ? null : `${n}× the per-IV price`}
          active={ivs === n}
          onClick={() => onIvs(n)}
        />
      ))}
      <p className="mt-1 font-body text-[11px] font-semibold leading-snug text-foreground/46">More IVs per visit, more value. Your nurse confirms what's clinically appropriate.</p>
    </div>
  );
}

function StepCategory({ categoryKey, onCategory }) {
  return (
    <div className="grid gap-2">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const active = categoryKey === cat.key;
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => onCategory(cat.key)}
            aria-pressed={active}
            className={`av-treatment-card flex min-h-[64px] w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors ${
              active ? 'is-open border-foreground/46 bg-foreground/[0.12]' : 'hover:border-foreground/24'
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/16 bg-background/40 text-foreground/82">
              <Icon className="h-4 w-4" strokeWidth={2.3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-body text-sm font-black text-foreground">{cat.label}</span>
              <span className="mt-0.5 block truncate font-body text-[11px] font-bold uppercase tracking-[0.06em] text-foreground/50">{cat.options.length} options · {cat.blurb}</span>
            </span>
            {active ? <Check className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2.7} /> : <ChevronRight className="h-4 w-4 shrink-0 text-foreground/40" />}
          </button>
        );
      })}
    </div>
  );
}

function StepTherapy({ category, therapyKey, onTherapy }) {
  if (!category) return null;
  return (
    <div className="grid gap-2">
      {category.gated && (
        <p className="rounded-lg border border-amber-300/22 bg-amber-300/[0.07] px-3 py-2 font-body text-[11px] font-bold leading-snug text-amber-100">
          Priced per dose · clinician-reviewed. Final dosing and billing are confirmed at your consult.
        </p>
      )}
      {category.options.map((opt) => (
        <SelectRow
          key={opt.key}
          label={opt.label}
          sub={opt.note}
          active={therapyKey === opt.key}
          onClick={() => onTherapy(opt.key)}
        />
      ))}
    </div>
  );
}

function StepAddons({ ivQty, imQty, onIv, onIm }) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="mb-1.5 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/46">IV add-ons</p>
        <div className="grid gap-1.5">
          {IV_ADDON_ITEMS.map((item) => (
            <QtyStepper key={item.key} label={item.label} price={item.price} value={ivQty[item.key] || 0} max={item.max} onChange={(v) => onIv(item.key, v)} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/46">IM shots</p>
        <div className="grid gap-1.5">
          {IM_ADDON_ITEMS.map((item) => (
            <QtyStepper key={item.key} label={item.label} price={item.price} value={imQty[item.key] || 0} max={item.max} onChange={(v) => onIm(item.key, v)} />
          ))}
        </div>
      </div>
      <p className="font-body text-[11px] font-semibold leading-snug text-foreground/46">Add-ons billed monthly. Your time-commitment discount applies to the whole plan.</p>
    </div>
  );
}

function StepReview({ sessions, ivs, category, therapyLabel, perIvPrice, baseMonthly, lineItems, monthly, term, onTerm, upfrontTotal, perMonth, onStart }) {
  return (
    <div className="flex flex-col lg:h-full lg:min-h-0">
      <div className="pr-0.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <p className="font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/46">Plan summary</p>
        <dl className="mt-2 grid gap-1.5 font-body text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-bold text-foreground/64">Therapy</dt>
            <dd className="text-right font-black text-foreground">{therapyLabel || '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-bold text-foreground/64">Per IV{category?.gated ? ' (dose)' : ''}</dt>
            <dd className="text-right font-bold text-foreground/72">{money(perIvPrice)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-bold text-foreground/64">IVs × sessions</dt>
            <dd className="text-right font-bold text-foreground/72">{ivs} × {sessions} / mo</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-foreground/10 pt-1.5">
            <dt className="font-bold text-foreground/64">Therapy / mo</dt>
            <dd className="text-right font-bold text-foreground/72">{money(baseMonthly)}</dd>
          </div>
          {lineItems.length > 0 && (
            <div className="mt-1 border-t border-foreground/10 pt-1.5">
              <p className="mb-1 font-body text-[10px] font-black uppercase tracking-[0.14em] text-foreground/40">Add-ons</p>
              {lineItems.map((li) => (
                <div key={li.key} className="flex items-baseline justify-between gap-3">
                  <dt className="truncate font-bold text-foreground/64">{li.qty}× {li.label}</dt>
                  <dd className="shrink-0 text-right font-bold text-foreground/72">{money(li.price * li.qty)}</dd>
                </div>
              ))}
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-foreground/10 pt-1.5">
            <dt className="font-black text-foreground">Monthly</dt>
            <dd className="text-right font-black text-foreground">{money(monthly)}</dd>
          </div>
        </dl>

        <div className="mt-3">
          <p className="mb-1.5 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/46">Pay upfront, save more</p>
          <div className="grid grid-cols-3 gap-1.5">
            {TERMS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onTerm(t.key)}
                aria-pressed={term.key === t.key}
                className={`av-treatment-card rounded-lg border px-2 py-2 text-center transition-colors ${
                  term.key === t.key ? 'is-open border-foreground/46 bg-foreground/[0.12]' : 'hover:border-foreground/24'
                }`}
              >
                <span className="block font-body text-[12px] font-black text-foreground">{t.label}</span>
                <span className="mt-0.5 block font-body text-[10px] font-black uppercase tracking-[0.04em] text-foreground/52">Save {Math.round(t.discount * 100)}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-[1rem] border border-foreground/12 bg-background/40 p-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground/48">Due today</p>
          <p className="font-heading text-[2rem] leading-none text-foreground">{money(upfrontTotal)}</p>
        </div>
        <p className="mt-1.5 font-body text-xs font-bold leading-snug text-foreground/60">
          {term.months} months upfront · {money(perMonth)}/mo effective · {money(monthly)}/mo at list
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background transition-transform active:scale-[0.99]"
        >
          Start plan <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-2 text-center font-body text-[11px] font-semibold text-foreground/44">Clinical review before treatment · Secure checkout</p>
      </div>
    </div>
  );
}

function MobileProgress({ step }) {
  return (
    <div className="flex items-center gap-1 px-3" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <span key={s.key} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-foreground' : 'bg-foreground/18'}`} />
      ))}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function Subscription() {
  useSeo({
    title: 'Plans - Avalon Vitality',
    description: 'Build a monthly Avalon IV therapy plan: choose how often, your therapy, add-ons, and pay upfront for 3, 6, or 12 months to save.',
    path: '/subscription',
  });

  const navigate = useNavigate();
  const [sessions, setSessions] = useState(2);
  const [ivs, setIvs] = useState(1);
  const [categoryKey, setCategoryKey] = useState('iv-vitamins');
  const [therapyKey, setTherapyKey] = useState('hydration');
  const [ivQty, setIvQty] = useState({});
  const [imQty, setImQty] = useState({});
  const [termKey, setTermKey] = useState('three-month');
  const [mobileStep, setMobileStep] = useState(0);

  const term = TERMS.find((t) => t.key === termKey) || TERMS[0];
  const category = CATEGORIES.find((c) => c.key === categoryKey) || CATEGORIES[0];
  const therapyOption = category.options.find((o) => o.key === therapyKey) || category.options[0];

  // When the category changes, snap the therapy to that category's first option.
  const selectCategory = (key) => {
    setCategoryKey(key);
    const next = CATEGORIES.find((c) => c.key === key);
    if (next && !next.options.some((o) => o.key === therapyKey)) {
      setTherapyKey(next.options[0]?.key || '');
    }
  };

  const lineItems = useMemo(() => {
    const items = [];
    for (const item of IV_ADDON_ITEMS) {
      const qty = ivQty[item.key] || 0;
      if (qty > 0) items.push({ key: item.key, label: item.label, price: item.price, qty });
    }
    for (const item of IM_ADDON_ITEMS) {
      const qty = imQty[item.key] || 0;
      if (qty > 0) items.push({ key: item.key, label: item.label, price: item.price, qty });
    }
    return items;
  }, [ivQty, imQty]);

  // Per-IV pricing: vitamin = $250, NAD+/CBD = dose price. Multiplied by IVs/session
  // and sessions/month. Add-ons are flat monthly. Time commitment discounts the plan.
  const perIvPrice = Number(therapyOption?.price || VITAMIN_IV_PRICE);
  const baseMonthly = perIvPrice * ivs * sessions;
  const addOnsTotal = lineItems.reduce((sum, li) => sum + li.price * li.qty, 0);
  const monthly = baseMonthly + addOnsTotal;
  const upfrontTotal = Math.round(monthly * term.months * (1 - term.discount));
  const perMonth = Math.round(upfrontTotal / term.months);

  const startPlan = () => {
    // Bill the builder's computed monthly via the custom-price checkout path.
    const params = new URLSearchParams({
      reset: '1',
      subscription: 'custom',
      price: String(Math.round(monthly)),
      term: term.key,
      protocol: therapyOption?.protocol || 'recovery',
      ivs: String(ivs),
      time: 'asap',
    });
    navigate(`/book?${params.toString()}`);
  };

  const stepBodies = {
    often: <StepOften sessions={sessions} onSessions={setSessions} />,
    ivs: <StepIvs ivs={ivs} onIvs={setIvs} />,
    category: <StepCategory categoryKey={categoryKey} onCategory={selectCategory} />,
    therapy: <StepTherapy category={category} therapyKey={therapyKey} onTherapy={setTherapyKey} />,
    addons: (
      <StepAddons
        ivQty={ivQty}
        imQty={imQty}
        onIv={(key, v) => setIvQty((c) => ({ ...c, [key]: v }))}
        onIm={(key, v) => setImQty((c) => ({ ...c, [key]: v }))}
      />
    ),
    review: (
      <StepReview
        sessions={sessions}
        ivs={ivs}
        category={category}
        therapyLabel={therapyOption?.label}
        perIvPrice={perIvPrice}
        baseMonthly={baseMonthly}
        lineItems={lineItems}
        monthly={monthly}
        term={term}
        onTerm={setTermKey}
        upfrontTotal={upfrontTotal}
        perMonth={perMonth}
        onStart={startPlan}
      />
    ),
  };

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header>
        <Navbar />
      </header>
      <main id="plans-builder" className="mx-auto w-full max-w-[calc(100vw-1.5rem)] px-0 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[5.25rem] md:max-w-[1600px] md:px-4 md:pb-6 md:pt-24">
        <div className="mb-3 px-3 md:mb-4 md:px-0">
          <h1 className="font-heading text-[2.6rem] uppercase leading-[0.86] tracking-normal text-foreground md:text-[3.4rem]">Build your plan</h1>
          <p className="mt-1 font-body text-sm font-semibold text-foreground/56">Six quick steps. Real per-IV pricing. Pay upfront for 3, 6, or 12 months to save.</p>
        </div>

        {/* ── Desktop: six columns side by side ── */}
        <div className="hidden lg:grid lg:grid-cols-6 lg:items-stretch lg:gap-3" style={{ height: 'calc(100svh - 12rem)' }}>
          {STEPS.map((step, index) => (
            <motion.section
              key={step.key}
              initial={{ opacity: 1, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: EASE, delay: index * 0.03 }}
              className="av-glass-card flex min-h-0 flex-col overflow-hidden rounded-[1.1rem] border bg-background/52 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl"
            >
              <StepHeader index={index} title={STEP_TITLES[step.key]} sub={STEP_SUBS[step.key]} />
              <div className="min-h-0 flex-1 overflow-y-auto">{stepBodies[step.key]}</div>
            </motion.section>
          ))}
        </div>

        {/* ── Mobile: one step per screen ── */}
        <div className="lg:hidden">
          <MobileProgress step={mobileStep} />
          <motion.section
            key={STEPS[mobileStep].key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="av-glass-card mx-3 mt-2 rounded-[1.1rem] border bg-background/52 p-3.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl"
          >
            <StepHeader index={mobileStep} title={STEP_TITLES[STEPS[mobileStep].key]} sub={STEP_SUBS[STEPS[mobileStep].key]} />
            {stepBodies[STEPS[mobileStep].key]}
          </motion.section>

          {(mobileStep > 0 || STEPS[mobileStep].key !== 'review') && (
            <div className="sticky bottom-0 mt-3 flex items-center gap-2 bg-gradient-to-t from-background/90 to-transparent px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
              {mobileStep > 0 && (
                <button
                  type="button"
                  onClick={() => setMobileStep((s) => Math.max(0, s - 1))}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-foreground/16 bg-background/50 px-4 font-body text-sm font-black uppercase tracking-[0.06em] text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              {STEPS[mobileStep].key !== 'review' && (
                <button
                  type="button"
                  onClick={() => setMobileStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
