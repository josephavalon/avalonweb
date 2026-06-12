import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
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
//   One IV per session, so monthly = perIvPrice x sessions-per-month + add-ons.
// Billing term: pay monthly (3-month minimum) or commit upfront for 3 / 6 / 12
// months to save. Add-ons use full catalog price; the term discount applies to
// the whole plan.
const VITAMIN_IV_PRICE = 250;
const SESSION_OPTIONS = [1, 2, 3, 4];

// Terms. Monthly is the low-friction default; 6mo (-8%) and 12mo (-15%) come
// from the web store, 3mo (-5%) is the owner-approved default. One source here.
const TERMS = [
  { key: 'monthly', label: 'Monthly', months: 1, discount: 0 },
  { key: 'three-month', label: '3 months', months: 3, discount: 0.05 },
  { key: 'six-month', label: '6 months', months: 6, discount: 0.08 },
  { key: 'annual', label: '12 months', months: 12, discount: 0.15 },
];

const money = (value) => `$${Math.round(Number(value || 0)).toLocaleString()}`;

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Therapy categories.
const IV_VITAMINS = IV_SESSIONS.filter((session) => !session.doses);
const NAD_THERAPY = IV_SESSIONS.find((session) => session.key === 'nad');
const CBD_THERAPY = IV_SESSIONS.find((session) => session.key === 'cbd');

const CATEGORIES = [
  {
    key: 'iv-vitamins',
    label: 'IV Vitamins',
    icon: Droplets,
    blurb: `$${VITAMIN_IV_PRICE} per IV`,
    options: IV_VITAMINS.map((s) => ({ key: s.key, label: s.label, note: s.tag, price: VITAMIN_IV_PRICE, protocol: s.key, image: s.image })),
  },
  {
    key: 'nad',
    label: 'NAD+',
    icon: Sparkles,
    blurb: 'From $350 per dose',
    gated: true,
    options: (NAD_THERAPY?.doses || []).map((d) => ({ key: d.key, label: `NAD+ ${d.label}`, note: `${money(d.price)} / IV`, price: d.price, protocol: 'nad', image: d.image || NAD_THERAPY?.image })),
  },
  {
    key: 'cbd',
    label: 'CBD IV',
    icon: Leaf,
    blurb: 'From $350 per dose',
    gated: true,
    options: (CBD_THERAPY?.doses || []).map((d) => ({ key: d.key, label: `CBD ${d.label}`, note: `${money(d.price)} / IV`, price: d.price, protocol: 'cbd', image: d.image || CBD_THERAPY?.image })),
  },
];

// Add-ons at full catalog price (the time discount applies to the whole plan).
const IV_ADDON_ITEMS = IV_ADDONS
  .filter((a) => !a.group)
  .map((a) => ({ key: slug(a.label), label: a.label, price: a.price, max: 4, img: a.img }));
const IM_ADDON_ITEMS = IM_SHOTS.map((a) => ({ key: slug(a.label), label: a.label, price: a.price, max: a.max || 4, img: a.img }));

// Collapse dose variants ("Vitamin C IV Push · 5g / 10g / 15g") into one row
// with a strength dropdown; singletons stay as their own stepper. Preserves
// catalog order — a family appears where its first variant does.
function buildAddonRows(items) {
  const rows = [];
  const familyAt = new Map();
  for (const item of items) {
    const sep = item.label.indexOf('·');
    if (sep === -1) {
      rows.push({ type: 'single', item });
      continue;
    }
    const family = item.label.slice(0, sep).trim();
    const variant = item.label.slice(sep + 1).trim();
    const entry = { ...item, variant };
    if (familyAt.has(family)) {
      rows[familyAt.get(family)].variants.push(entry);
    } else {
      familyAt.set(family, rows.length);
      rows.push({ type: 'family', family, variants: [entry] });
    }
  }
  return rows;
}
const IV_ADDON_ROWS = buildAddonRows(IV_ADDON_ITEMS);
const IM_ADDON_ROWS = buildAddonRows(IM_ADDON_ITEMS);

// Six single-decision screens. One screen, one question, one decision.
const STEPS = [
  { key: 'sessions', label: 'Sessions' },
  { key: 'category', label: 'Category' },
  { key: 'therapy', label: 'Therapy' },
  { key: 'addons', label: 'Add-ons' },
  { key: 'term', label: 'Billing' },
  { key: 'review', label: 'Review' },
];

const STEP_TITLES = {
  sessions: 'How many sessions?',
  category: 'Therapy category',
  therapy: 'Choose your therapy',
  addons: 'Add-ons',
  term: 'Billing term',
  review: 'Review & checkout',
};

const STEP_SUBS = {
  sessions: 'How many IV visits each month.',
  category: 'Pick your therapy family.',
  therapy: 'Your primary IV for every session.',
  addons: 'Optional — boost any session, or continue to skip.',
  term: 'Pay monthly, or commit upfront to save.',
  review: 'Confirm your plan and start.',
};

// ── Shared bits ───────────────────────────────────────────────────────────

function StepHeader({ index, title, sub }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-foreground/24 font-heading text-[15px] leading-none text-foreground md:h-9 md:w-9 md:text-[18px]">
        {index + 1}
      </span>
      <div className="min-w-0">
        <h2 className="font-heading text-[1.7rem] uppercase leading-[0.95] tracking-normal text-foreground md:text-[2.1rem]">{title}</h2>
        {sub && <p className="mt-1 font-body text-xs font-semibold leading-snug text-foreground/56 md:text-sm">{sub}</p>}
      </div>
    </div>
  );
}

function SummaryRow({ dt, dd, bold, border }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${border ? 'border-t border-foreground/10 pt-1.5' : ''}`}>
      <dt className="font-bold text-foreground/64">{dt}</dt>
      <dd className={`text-right ${bold ? 'font-black text-foreground' : 'font-bold text-foreground/72'}`}>{dd}</dd>
    </div>
  );
}

function SelectRow({ label, sub, price, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`av-treatment-card flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-left transition-colors md:min-h-[62px] md:px-4 ${
        active ? 'is-open border-foreground/46 bg-foreground/[0.12]' : 'hover:border-foreground/24'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm font-black text-foreground md:text-base">{label}</span>
        {sub && <span className="mt-0.5 block truncate font-body text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/50">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {price && <span className="whitespace-nowrap font-body text-sm font-black text-foreground md:text-base">{price}</span>}
        {active && <Check className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2.7} />}
      </span>
    </button>
  );
}

function AddonThumb({ img }) {
  if (!img) return null;
  return (
    <span className="flex h-12 w-9 shrink-0 items-center justify-center">
      <img src={img} alt="" loading="lazy" className="h-full w-auto object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]" />
    </span>
  );
}

function QtyStepper({ label, price, value, max, onChange, img }) {
  return (
    <div className="av-treatment-card flex items-center justify-between gap-2 rounded-xl border p-2.5 md:p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <AddonThumb img={img} />
        <div className="min-w-0">
          <p className="truncate font-body text-[13px] font-black text-foreground md:text-sm">{label}</p>
          <p className="mt-0.5 font-body text-[11px] font-bold uppercase tracking-[0.06em] text-foreground/50">{money(price)} / mo</p>
        </div>
      </div>
      <Stepper label={label} value={value} max={max} onChange={onChange} />
    </div>
  );
}

function Stepper({ label, value, max, onChange }) {
  return (
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
  );
}

// A dose-variant family: pick the strength from a dropdown, then set quantity.
// The qty is tracked per variant (so multiple strengths can be added), but the
// stepper shows the selected one. Other strengths with a qty surface as a hint.
function AddonFamilyRow({ family, variants, qtyMap, onQty }) {
  const initial = variants.find((v) => (qtyMap[v.key] || 0) > 0) || variants[0];
  const [selKey, setSelKey] = useState(initial.key);
  const sel = variants.find((v) => v.key === selKey) || variants[0];
  const value = qtyMap[sel.key] || 0;
  const otherActive = variants.filter((v) => v.key !== sel.key && (qtyMap[v.key] || 0) > 0);
  return (
    <div className="av-treatment-card flex items-center justify-between gap-2 rounded-xl border p-2.5 md:p-3">
      <AddonThumb img={variants[0]?.img} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-[13px] font-black text-foreground md:text-sm">{family}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="relative">
            <select
              value={selKey}
              onChange={(e) => setSelKey(e.target.value)}
              aria-label={`${family} strength`}
              className="appearance-none rounded-lg border border-foreground/18 bg-background/60 py-1 pl-2.5 pr-7 font-body text-[12px] font-bold text-foreground focus:border-foreground/40 focus:outline-none"
            >
              {variants.map((v) => (
                <option key={v.key} value={v.key} className="bg-background text-foreground">
                  {v.variant} · {money(v.price)}/mo
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/50" />
          </div>
          {otherActive.length > 0 && (
            <span className="font-body text-[10px] font-bold uppercase tracking-[0.04em] text-foreground/44">
              + {otherActive.map((v) => `${v.variant}×${qtyMap[v.key]}`).join(', ')}
            </span>
          )}
        </div>
      </div>
      <Stepper label={`${family} ${sel.variant}`} value={value} max={sel.max} onChange={(v) => onQty(sel.key, v)} />
    </div>
  );
}

// ── Step bodies ───────────────────────────────────────────────────────────

function StepSessions({ sessions, onSessions }) {
  return (
    <div className="grid gap-2">
      {SESSION_OPTIONS.map((n) => (
        <SelectRow
          key={n}
          label={`${n} ${n === 1 ? 'session' : 'sessions'} / month`}
          sub={`${n} IV ${n === 1 ? 'visit' : 'visits'} a month`}
          price={`from ${money(VITAMIN_IV_PRICE * n)}/mo`}
          active={sessions === n}
          onClick={() => onSessions(n)}
        />
      ))}
      <p className="mt-1 font-body text-[11px] font-semibold leading-snug text-foreground/46">Each session is one IV visit at your home or office. Sessions roll over while your plan is active. 3-month minimum, then pause or cancel anytime.</p>
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
            className={`av-treatment-card flex min-h-[64px] w-full items-center gap-3 rounded-xl border px-3.5 text-left transition-colors md:min-h-[72px] md:px-4 ${
              active ? 'is-open border-foreground/46 bg-foreground/[0.12]' : 'hover:border-foreground/24'
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/16 bg-background/40 text-foreground/82">
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-body text-sm font-black text-foreground md:text-base">{cat.label}</span>
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

function AddonRows({ rows, qtyMap, onQty }) {
  return (
    <div className="grid gap-1.5">
      {rows.map((row) =>
        row.type === 'family' ? (
          <AddonFamilyRow key={row.family} family={row.family} variants={row.variants} qtyMap={qtyMap} onQty={onQty} />
        ) : (
          <QtyStepper
            key={row.item.key}
            label={row.item.label}
            price={row.item.price}
            value={qtyMap[row.item.key] || 0}
            max={row.item.max}
            img={row.item.img}
            onChange={(v) => onQty(row.item.key, v)}
          />
        )
      )}
    </div>
  );
}

function StepAddons({ ivQty, imQty, onIv, onIm }) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="mb-1.5 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/46">IV add-ons</p>
        <AddonRows rows={IV_ADDON_ROWS} qtyMap={ivQty} onQty={onIv} />
      </div>
      <div>
        <p className="mb-1.5 font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/46">IM shots</p>
        <AddonRows rows={IM_ADDON_ROWS} qtyMap={imQty} onQty={onIm} />
      </div>
      <p className="font-body text-[11px] font-semibold leading-snug text-foreground/46">Add-ons billed monthly. Your time-commitment discount applies to the whole plan.</p>
    </div>
  );
}

function StepTerm({ monthly, termKey, onTerm }) {
  return (
    <div className="grid gap-2">
      {TERMS.map((t) => {
        const total = Math.round(monthly * t.months * (1 - t.discount));
        const eff = Math.round(total / t.months);
        const active = termKey === t.key;
        const isMonthly = t.key === 'monthly';
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onTerm(t.key)}
            aria-pressed={active}
            className={`av-treatment-card flex min-h-[62px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-left transition-colors md:min-h-[70px] md:px-4 ${
              active ? 'is-open border-foreground/46 bg-foreground/[0.12]' : 'hover:border-foreground/24'
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-body text-sm font-black text-foreground md:text-base">{isMonthly ? 'Monthly' : `${t.label} upfront`}</span>
                {!isMonthly && <span className="rounded-full bg-foreground/16 px-2 py-0.5 font-body text-[10px] font-black uppercase tracking-[0.04em] text-foreground">Save {Math.round(t.discount * 100)}%</span>}
              </span>
              <span className="mt-0.5 block font-body text-[11px] font-bold uppercase tracking-[0.06em] text-foreground/52">
                {isMonthly ? 'Billed monthly · 3-month minimum, then flexible' : `${money(eff)}/mo effective · charged once today`}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-right">
                <span className="block whitespace-nowrap font-body text-sm font-black text-foreground md:text-base">{isMonthly ? `${money(monthly)}/mo` : money(total)}</span>
                {!isMonthly && <span className="block font-body text-[10px] font-bold uppercase tracking-[0.04em] text-foreground/46">due today</span>}
              </span>
              {active && <Check className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2.7} />}
            </span>
          </button>
        );
      })}
      <p className="mt-1 font-body text-[11px] font-semibold leading-snug text-foreground/46">Monthly has a 3-month minimum. After that, pause or cancel anytime. Upfront terms charge once today, then renew at the same term.</p>
    </div>
  );
}

function StepReview({ sessions, category, therapyLabel, perIvPrice, baseMonthly, lineItems, monthly, term, upfrontTotal, perMonth, onStart }) {
  const isMonthly = term.key === 'monthly';
  return (
    <div className="flex flex-col">
      <p className="font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/46">Plan summary</p>
      <dl className="mt-2 grid gap-1.5 font-body text-[13px] md:text-sm">
        <SummaryRow dt="Therapy" dd={therapyLabel || '—'} bold />
        <SummaryRow dt={`Per IV${category?.gated ? ' (dose)' : ''}`} dd={money(perIvPrice)} />
        <SummaryRow dt="Sessions" dd={`${sessions} / month`} />
        <SummaryRow dt="Therapy / mo" dd={money(baseMonthly)} border />
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

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-foreground/12 bg-background/40 px-3 py-2">
        <span className="font-body text-xs font-bold text-foreground/64">Billing</span>
        <span className="text-right font-body text-xs font-black text-foreground">{isMonthly ? 'Monthly · 3-mo minimum, then flexible' : `${term.label} upfront · save ${Math.round(term.discount * 100)}%`}</span>
      </div>

      <div className="mt-3 rounded-[1rem] border border-foreground/12 bg-background/40 p-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground/48">Due today</p>
          <p className="font-heading text-[2.1rem] leading-none text-foreground">{money(isMonthly ? monthly : upfrontTotal)}</p>
        </div>
        <p className="mt-1.5 font-body text-xs font-bold leading-snug text-foreground/60">
          {isMonthly
            ? `${money(monthly)}/mo · billed monthly · pause or cancel anytime after 3 months`
            : `${term.months} months upfront · ${money(perMonth)}/mo effective · renews at ${term.label}`}
        </p>
        <p className="mt-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-3 py-2 font-body text-[11px] font-bold leading-snug text-foreground/58">
          Licensed RN visits. Intake and clinical review happen before treatment.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-3 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background transition-transform active:scale-[0.99]"
        >
          Start plan <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-2 text-center font-body text-[11px] font-semibold text-foreground/44">Clinical review before treatment · Secure checkout</p>
      </div>
    </div>
  );
}

function Progress({ step }) {
  return (
    <div>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s.key} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-foreground' : 'bg-foreground/16'}`} />
        ))}
      </div>
      <p className="mt-2 text-center font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground/52" aria-live="polite">
        Step {step + 1} of {STEPS.length} · {STEP_TITLES[STEPS[step].key]}
      </p>
    </div>
  );
}

function SummaryBar({ therapyLabel, sessions, addOnCount, monthly }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-foreground/12 bg-background/82 px-3.5 py-2.5 backdrop-blur-xl">
      <p className="min-w-0 truncate font-body text-[12px] font-bold text-foreground/64">
        {therapyLabel} · {sessions}×/mo{addOnCount > 0 ? ` · +${addOnCount} add-on${addOnCount > 1 ? 's' : ''}` : ''}
      </p>
      <p className="shrink-0 font-body text-sm font-black text-foreground" aria-live="polite">
        {money(monthly)}<span className="text-foreground/50">/mo</span>
      </p>
    </div>
  );
}

function RailLine({ label, value, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex min-w-0 items-baseline gap-1.5">
        <Check className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-foreground/52" strokeWidth={2.6} />
        <span className="truncate font-body text-[13px] font-bold text-foreground/74">{label}</span>
      </span>
      {value && <span className={`shrink-0 font-body text-[13px] font-bold ${muted ? 'text-foreground/46' : 'text-foreground/74'}`}>{value}</span>}
    </div>
  );
}

// The persistent "Your Plan" rail — mirrors the one-time-visit store's order
// rail (dark glass aside) but adopts the builder's live summary: bag, monthly
// price, what's included, and the upfront savings.
function PlanRail({ therapyOption, therapyLabel, sessions, baseMonthly, lineItems, monthly, term, perMonth, upfrontTotal, onStart, isLast }) {
  const isMonthly = term.key === 'monthly';
  const bag = therapyOption?.image || '/bags/dehydration.png';
  const saving = Math.round(monthly * term.months - upfrontTotal);
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-foreground/10 bg-background/70 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
        <p className="font-body text-[11px] font-black uppercase tracking-[0.18em] text-foreground/48">Your plan</p>
        <p className="font-body text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/40">{sessions}× / month</p>
      </div>

      <div className="flex items-center gap-3.5 px-4 pt-4">
        <div className="flex h-[6.5rem] w-20 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-background/40">
          <img src={bag} alt="" className="h-[5.6rem] w-auto object-contain" />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-[1.55rem] uppercase leading-[0.95] tracking-normal text-foreground">{therapyLabel || '—'}</p>
          <p className="mt-1 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/52">One IV per visit</p>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-heading text-[2.7rem] leading-none text-foreground">{money(isMonthly ? monthly : perMonth)}</span>
          <span className="font-body text-sm font-bold text-foreground/52">/mo</span>
        </div>
        {!isMonthly && (
          <p className="mt-1.5 font-body text-[11px] font-bold uppercase tracking-[0.06em] text-foreground/50">{money(upfrontTotal)} due today · {term.label}</p>
        )}
      </div>

      <div className="mt-4 grid gap-1.5 border-t border-foreground/10 px-4 pt-3.5">
        <p className="mb-0.5 font-body text-[10px] font-black uppercase tracking-[0.16em] text-foreground/40">Included</p>
        <RailLine label={`${sessions}× ${therapyLabel}`} value={money(baseMonthly)} />
        {lineItems.map((li) => (
          <RailLine key={li.key} label={`${li.qty}× ${li.label}`} value={money(li.price * li.qty)} />
        ))}
        <RailLine label="Concierge mobile visits" />
        <RailLine label="Clinical review each visit" />
      </div>

      {!isMonthly && saving > 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-foreground/14 bg-foreground/[0.06] px-3 py-2">
          <p className="font-body text-[12px] font-black text-foreground">You save {money(saving)}</p>
          <p className="font-body text-[11px] font-semibold text-foreground/52">vs. paying monthly over {term.label}</p>
        </div>
      )}

      {isLast ? (
        <button
          type="button"
          onClick={onStart}
          className="mx-4 mb-4 mt-4 flex min-h-[52px] w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background transition-transform active:scale-[0.99]"
        >
          Start plan <ArrowRight className="h-4 w-4" />
        </button>
      ) : (
        <p className="px-4 pb-4 pt-3 font-body text-[11px] font-semibold leading-snug text-foreground/44">Cancel or pause anytime after the 3-month minimum.</p>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function Subscription() {
  useSeo({
    title: 'Plans - Avalon Vitality',
    description: 'Build a monthly Avalon IV therapy plan one step at a time: choose how often, your therapy, add-ons, and pay monthly or upfront for 3, 6, or 12 months to save.',
    path: '/subscription',
  });

  const navigate = useNavigate();
  const [sessions, setSessions] = useState(2);
  const [categoryKey, setCategoryKey] = useState('iv-vitamins');
  const [therapyKey, setTherapyKey] = useState('hydration');
  const [ivQty, setIvQty] = useState({});
  const [imQty, setImQty] = useState({});
  const [termKey, setTermKey] = useState('monthly');
  const [step, setStep] = useState(0);

  const ivs = 1; // One IV per session.
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

  // Per-IV pricing: vitamin = $250, NAD+/CBD = dose price. One IV per session,
  // multiplied by sessions/month. Add-ons are flat monthly. The time commitment
  // discounts the whole plan.
  const perIvPrice = Number(therapyOption?.price || VITAMIN_IV_PRICE);
  const baseMonthly = perIvPrice * ivs * sessions;
  const addOnsTotal = lineItems.reduce((sum, li) => sum + li.price * li.qty, 0);
  const monthly = baseMonthly + addOnsTotal;
  const upfrontTotal = Math.round(monthly * term.months * (1 - term.discount));
  const perMonth = Math.round(upfrontTotal / term.months);
  const addOnCount = lineItems.reduce((sum, li) => sum + li.qty, 0);

  const startPlan = () => {
    // Plans use their OWN checkout (/plan → subscription mode + membership Acuity
    // type), intentionally NOT the one-time 5-step /book flow.
    const params = new URLSearchParams({
      price: String(Math.round(monthly)),
      term: term.key,
      protocol: therapyOption?.protocol || 'recovery',
      sessions: String(sessions),
    });
    navigate(`/plan?${params.toString()}`);
  };

  const stepKey = STEPS[step].key;
  const isLast = stepKey === 'review';

  const bodies = {
    sessions: <StepSessions sessions={sessions} onSessions={setSessions} />,
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
    term: <StepTerm monthly={monthly} termKey={termKey} onTerm={setTermKey} />,
    review: (
      <StepReview
        sessions={sessions}
        category={category}
        therapyLabel={therapyOption?.label}
        perIvPrice={perIvPrice}
        baseMonthly={baseMonthly}
        lineItems={lineItems}
        monthly={monthly}
        term={term}
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
      <main id="plans-builder" className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[5.25rem] md:pt-28">
        <div className="mb-4 text-center md:mb-7 md:text-left">
          <h1 className="font-heading text-[2.6rem] uppercase leading-[0.86] tracking-normal text-foreground md:text-[3.4rem]">Build your plan</h1>
          <p className="mt-1.5 font-body text-sm font-semibold text-foreground/56 md:text-base">One choice at a time. Real per-IV pricing. Cancel or pause anytime.</p>
        </div>

        <div className="flex flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_21rem] md:items-start md:gap-7 lg:grid-cols-[minmax(0,1fr)_23rem]">
          {/* Left — the builder */}
          <div className="flex flex-1 flex-col">
            <Progress step={step} />

            <div className="mt-3 flex-1">
              <motion.section
                key={stepKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="av-glass-card rounded-[1.3rem] border bg-background/82 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl md:p-7"
              >
                <StepHeader index={step} title={STEP_TITLES[stepKey]} sub={STEP_SUBS[stepKey]} />
                <div className="mt-4 md:mt-5">{bodies[stepKey]}</div>
              </motion.section>
            </div>

            {/* Nav controls — sticky on mobile, static under the card on desktop */}
            <div className="sticky bottom-0 z-10 -mx-4 mt-3 bg-gradient-to-t from-background via-background/92 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),0.85rem)] pt-3 md:static md:mx-0 md:bg-none md:px-0 md:pb-0 md:pt-4">
              {!isLast && (
                <div className="md:hidden">
                  <SummaryBar therapyLabel={therapyOption?.label} sessions={sessions} addOnCount={addOnCount} monthly={monthly} />
                </div>
              )}
              <div className="flex items-center gap-2.5">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-foreground/16 bg-background/50 px-4 font-body text-sm font-black uppercase tracking-[0.06em] text-foreground transition-colors hover:border-foreground/30"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                )}
                {!isLast && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                    className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background transition-transform active:scale-[0.99]"
                  >
                    {stepKey === 'term' ? 'Review plan' : 'Continue'} <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right — the persistent "Your Plan" rail (desktop only) */}
          <aside className="hidden md:block md:sticky md:top-28">
            <PlanRail
              therapyOption={therapyOption}
              therapyLabel={therapyOption?.label}
              sessions={sessions}
              baseMonthly={baseMonthly}
              lineItems={lineItems}
              monthly={monthly}
              term={term}
              perMonth={perMonth}
              upfrontTotal={upfrontTotal}
              onStart={startPlan}
              isLast={isLast}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
