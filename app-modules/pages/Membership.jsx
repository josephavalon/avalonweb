import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  CreditCard,
  Droplets,
  Info,
  Minus,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import CannabisLeaf from '@/components/icons/CannabisLeaf';
import Navbar from '@/components/landing/Navbar';
import { useSeo } from '@/lib/seo';
import { IV_SESSIONS, IV_ADDONS, IM_SHOTS } from '@/data/catalog';
import { PEOPLE_MAX, createPerson, personLabel as personLabelFor, makeVisit, resizeVisits } from '@/lib/peopleState';
import SessionBuilder from '@/components/store/SessionBuilder';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import { apiPost } from '@/lib/apiClient';
import { SUBSCRIPTION_COMMITMENT_SHORT } from '@/lib/subscription';

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
// ── Visit Credit membership model ─────────────────────────────────────────
// We sell VISITS (capacity), not IVs. Each visit carries a $250 "Visit Credit"
// of appointment value. Any service plugs into a visit: cart ≤ credit =
// Included; cart > credit = pay only the difference. This is the extensible
// engine future TRT / exosomes / supplements / labs will plug into.
const VISIT_CREDIT = 250;
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
    // Each option carries the catalog content the "What's inside" disclosure
    // needs (desc / inside / features) so the tile face stays name + price only.
    options: IV_VITAMINS.map((s) => ({ key: s.key, label: s.label, price: VITAMIN_IV_PRICE, protocol: s.key, image: s.image, desc: s.desc || s.tagline, inside: s.inside, features: s.features })),
  },
  {
    key: 'nad',
    label: 'IV NAD+',
    icon: Sparkles,
    blurb: 'From $350 per dose',
    gated: true,
    // Dose rows borrow the parent therapy's content; the dose `note` (e.g.
    // Vitality) surfaces as the per-option "what it does" line.
    options: (NAD_THERAPY?.doses || []).map((d) => ({ key: d.key, label: `NAD+ ${d.label}`, price: d.price, protocol: 'nad', image: d.image || NAD_THERAPY?.image, desc: d.note || NAD_THERAPY?.tagline, inside: NAD_THERAPY?.inside, features: NAD_THERAPY?.features })),
  },
  {
    key: 'cbd',
    label: 'IV CBD',
    icon: CannabisLeaf,
    blurb: 'From $350 per dose',
    gated: true,
    options: (CBD_THERAPY?.doses || []).map((d) => ({ key: d.key, label: `CBD ${d.label}`, price: d.price, protocol: 'cbd', image: d.image || CBD_THERAPY?.image, desc: d.note || CBD_THERAPY?.tagline, inside: CBD_THERAPY?.inside, features: CBD_THERAPY?.features })),
  },
];

// Look up a therapy option (and its category) from any therapyKey. Falls back
// to the first IV vitamin so a brand-new/empty visit still prices + renders.
function findTherapy(therapyKey) {
  for (const cat of CATEGORIES) {
    const opt = cat.options.find((o) => o.key === therapyKey);
    if (opt) return { category: cat, option: opt };
  }
  const cat = CATEGORIES[0];
  return { category: cat, option: cat.options.find((o) => o.key === 'hydration') || cat.options[0] };
}

// Add-ons at full catalog price (the time discount applies to the whole plan).
const IV_ADDON_ITEMS = IV_ADDONS
  .filter((a) => !a.group)
  .map((a) => ({ key: slug(a.label), label: a.label, price: a.price, max: 4, img: a.img }));
const IM_ADDON_ITEMS = IM_SHOTS.map((a) => ({ key: slug(a.label), label: a.label, price: a.price, max: a.max || 4, img: a.img }));

// Price of ONE visit = its IV therapy + its IV add-ons + its IM shots.
// The visits array length already encodes sessions/month, so the plan monthly
// is just the SUM of visitPrice over a person's visits (no ×sessions multiply).
function visitPrice(visit) {
  if (!visit) return 0;
  const { option } = findTherapy(visit.therapyKey);
  const iv = Number(option?.price || VITAMIN_IV_PRICE);
  const ivAdd = IV_ADDON_ITEMS.reduce((sum, item) => sum + (visit.ivQty?.[item.key] || 0) * item.price, 0);
  const imAdd = IM_ADDON_ITEMS.reduce((sum, item) => sum + (visit.imQty?.[item.key] || 0) * item.price, 0);
  return iv + ivAdd + imAdd;
}

// Visit Credit math for ONE visit. `cart` is the raw appointment value
// (visitPrice). The member pays at least the $250 credit; anything over the
// credit is the `upgrade` (the difference they actually pay extra). Below the
// credit the upgrade is $0 → the visit reads "Included".
function visitCredit(visit) {
  const cart = visitPrice(visit);
  const upgrade = Math.max(0, cart - VISIT_CREDIT);
  return {
    cart,
    upgrade,
    included: cart <= VISIT_CREDIT,
    total: VISIT_CREDIT + upgrade, // = max(VISIT_CREDIT, cart)
  };
}

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

// Section titles for the one-screen builder. Titles only — no sub-paragraphs;
// the tile/price/disclosure grammar carries the meaning (menu pattern).
const STEP_TITLES = {
  sessions: 'Sessions',
  therapy: 'Therapy',
  addons: 'Add-ons',
  term: 'Term',
};

// ── Shared bits ───────────────────────────────────────────────────────────

// Compact dropdown — the builder's default control. Native <select>: one tap,
// zero open/close movement, every choice on one short screen.
function PlanSelect({ value, onChange, ariaLabel, children, icon: Icon }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60" strokeWidth={2} />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={`av-treatment-card w-full appearance-none rounded-xl border py-3 pr-10 font-body text-sm font-black text-foreground focus:border-foreground/45 focus:outline-none md:text-base ${Icon ? 'pl-10' : 'pl-3.5'}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/55" strokeWidth={2} />
    </div>
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
          <p className="mt-0.5 font-body text-[14px] font-bold uppercase tracking-[0.06em] text-foreground/50">{money(price)} / mo</p>
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
              className="appearance-none rounded-lg border border-foreground/18 bg-background/60 py-1 pl-2.5 pr-7 font-body text-[15px] font-bold text-foreground focus:border-foreground/40 focus:outline-none"
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
            <span className="font-body text-[13px] font-bold uppercase tracking-[0.04em] text-foreground/44">
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

// One-screen session picker: a horizontal segmented pill row (1×–4×) instead of
// a vertical wizard list. Big tappable cells, active = filled glass + check.
function SessionSegment({ sessions, onSessions, perIvPrice = VITAMIN_IV_PRICE }) {
  return (
    <div>
      <PlanSelect value={String(sessions)} onChange={(v) => onSessions(Number(v))} ariaLabel="Sessions per month" icon={CalendarClock}>
        {SESSION_OPTIONS.map((n) => (
          <option key={n} value={n} className="bg-background text-foreground">
            {n}× / month · {n} IV {n === 1 ? 'visit' : 'visits'}
          </option>
        ))}
      </PlanSelect>
      <p className="mt-2 font-body text-[15px] font-black uppercase tracking-[0.06em] text-foreground/60">
        From {money(perIvPrice * sessions)}/mo
      </p>
    </div>
  );
}

// A compact, single-line collapsible builder row — mirrors the landing
// "How it works" StepCard grammar: [icon badge] LABEL ........ <value> [chevron].
// Collapsed by default; tapping the header toggles the EXISTING control open via
// SmoothDisclosure. The `value` is a live summary string read from existing
// builder state (no new value state is introduced).
function BuilderRow({ title, value, hint, icon: Icon, open, onToggle, children }) {
  return (
    <div className={`av-treatment-card relative overflow-hidden rounded-[1.05rem] border transition-colors duration-base ease-editorial ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-base ease-editorial md:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="av-treatment-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/12 bg-gradient-to-b from-foreground/[0.11] to-foreground/[0.03] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12)]">
              <Icon className="h-[18px] w-[18px] text-foreground/82" strokeWidth={2} />
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="font-heading text-lg uppercase leading-none tracking-normal text-foreground md:text-xl">{title}</span>
            {hint && (
              <span className="mt-1 truncate font-body text-[12px] font-semibold normal-case tracking-normal text-foreground/45 md:text-[13px]">{hint}</span>
            )}
          </span>
        </div>
        <div className="flex min-w-0 shrink items-center justify-end gap-3">
          {value && (
            <span className="truncate text-right font-body text-[13px] font-semibold text-foreground/64 md:text-sm">{value}</span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-foreground/70 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </div>
      </button>

      <SmoothDisclosure open={open}>
        <div className="border-t border-foreground/[0.08] px-4 pb-4 pt-3.5 md:px-5">
          {children}
        </div>
      </SmoothDisclosure>
    </div>
  );
}

// Sticky mobile CTA: deposit-today + monthly + Start plan. Leads with the $50
// deposit (what they actually pay now), monthly as the secondary number.
function MobileStartBar({ therapyLabel, sessions, monthly, depositToday, onStart, changeMode = false }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-foreground/10 bg-background/92 px-4 pb-[max(env(safe-area-inset-bottom),0.85rem)] pt-3 backdrop-blur-xl md:hidden">
      <p className="mb-2 truncate font-body text-[13px] font-bold uppercase tracking-[0.08em] text-foreground/55" aria-live="polite">
        {therapyLabel} · {sessions}×/mo · {money(monthly)}/mo
      </p>
      <button
        type="button"
        onClick={onStart}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background transition-transform active:scale-[0.99]"
      >
        {changeMode ? 'Update my plan' : `Start plan · ${money(depositToday)} today`} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// One grouped dropdown over every category — selecting an option sets both the
// category and the therapy, so there's a single control to read and tap.
function StepTherapy({ therapyKey, onSelect }) {
  const activeCat = CATEGORIES.find((c) => c.options.some((o) => o.key === therapyKey));
  const activeOpt = activeCat?.options.find((o) => o.key === therapyKey);
  return (
    <div className="grid gap-2">
      <PlanSelect value={therapyKey} onChange={onSelect} ariaLabel="Therapy" icon={Droplets}>
        {CATEGORIES.map((cat) => (
          <optgroup key={cat.key} label={cat.label} className="bg-background text-foreground">
            {cat.options.map((opt) => (
              <option key={opt.key} value={opt.key} className="bg-background text-foreground">
                {opt.label} — {money(opt.price)}
              </option>
            ))}
          </optgroup>
        ))}
      </PlanSelect>
      {activeCat?.gated && (
        <span className="inline-flex w-fit items-center rounded-full border border-amber-300/22 bg-amber-300/[0.07] px-2.5 py-1 font-body text-[13px] font-black uppercase tracking-[0.08em] text-amber-100">
          Clinician-reviewed · dose at consult
        </span>
      )}
    </div>
  );
}

// One visit's therapy + (collapsible) per-visit add-ons. Dense: the grouped IV
// dropdown is always visible; add-ons hide behind a compact toggle so the
// per-visit list stays scannable. `summary` shows live add-on count.
function VisitRow({ index, visit, onTherapy, onIv, onIm }) {
  const [showAddons, setShowAddons] = useState(false);
  const { category } = findTherapy(visit.therapyKey);
  const addonCount =
    IV_ADDON_ITEMS.reduce((s, i) => s + (visit.ivQty?.[i.key] || 0), 0) +
    IM_ADDON_ITEMS.reduce((s, i) => s + (visit.imQty?.[i.key] || 0), 0);
  // Visit Credit framing: show "Included" when the cart fits the $250 credit,
  // or "+$<difference>" when it spills over — never the raw IV price.
  const { included, upgrade } = visitCredit(visit);
  return (
    <div className="av-treatment-card rounded-xl border p-2.5 md:p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-body text-[14px] font-black uppercase tracking-[0.1em] text-foreground/52">
          Visit {index + 1}
        </span>
        {included ? (
          <span className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-emerald-300/90 tabular-nums">
            Included
          </span>
        ) : (
          <span className="font-body text-[13px] font-black uppercase tracking-[0.06em] text-foreground/72 tabular-nums">
            +{money(upgrade)}
          </span>
        )}
      </div>
      <PlanSelect value={visit.therapyKey} onChange={onTherapy} ariaLabel={`Visit ${index + 1} therapy`} icon={Droplets}>
        {CATEGORIES.map((cat) => (
          <optgroup key={cat.key} label={cat.label} className="bg-background text-foreground">
            {cat.options.map((opt) => (
              <option key={opt.key} value={opt.key} className="bg-background text-foreground">
                {opt.label} — {money(opt.price)}
              </option>
            ))}
          </optgroup>
        ))}
      </PlanSelect>
      {category?.gated && (
        <span className="mt-1.5 inline-flex w-fit items-center rounded-full border border-amber-300/22 bg-amber-300/[0.07] px-2.5 py-1 font-body text-[12px] font-black uppercase tracking-[0.08em] text-amber-100">
          Clinician-reviewed · dose at consult
        </span>
      )}
      <button
        type="button"
        onClick={() => setShowAddons((v) => !v)}
        aria-expanded={showAddons}
        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left"
      >
        <span className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-foreground/56">
          Add-ons{addonCount > 0 ? ` · ${addonCount}` : ''}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-foreground/55 transition-transform duration-300 ${showAddons ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      <SmoothDisclosure open={showAddons}>
        <div className="pt-1.5">
          <StepAddons
            ivQty={visit.ivQty || {}}
            imQty={visit.imQty || {}}
            onIv={onIv}
            onIm={onIm}
          />
        </div>
      </SmoothDisclosure>
    </div>
  );
}

// Therapy step. 1 session → a single grouped IV picker. 2+ sessions → one dense
// VisitRow per visit (each its own IV + add-ons). Defaults are uniform: every
// visit seeds from visit 0, so it reads as "same IV every visit" until edited.
function CreditNote() {
  return (
    <p className="font-body text-[13px] font-semibold leading-snug text-foreground/55">
      Each visit includes any service up to {money(VISIT_CREDIT)}. Premium services — you only pay the difference.
    </p>
  );
}

function StepVisits({ sessions, visits, onVisitTherapy, onVisitIv, onVisitIm }) {
  if (sessions <= 1) {
    return (
      <div className="grid gap-2">
        <CreditNote />
        <StepTherapy therapyKey={visits[0]?.therapyKey} onSelect={(key) => onVisitTherapy(0, key)} />
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <CreditNote />
      <p className="font-body text-[13px] font-semibold leading-snug text-foreground/52">
        Each visit can be a different service. They start matched — change any visit to mix it up.
      </p>
      {visits.map((visit, i) => (
        <VisitRow
          key={i}
          index={i}
          visit={visit}
          onTherapy={(key) => onVisitTherapy(i, key)}
          onIv={(k, v) => onVisitIv(i, k, v)}
          onIm={(k, v) => onVisitIm(i, k, v)}
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
        <p className="mb-1.5 font-body text-[14px] font-black uppercase tracking-[0.14em] text-foreground/46">IV add-ons</p>
        <AddonRows rows={IV_ADDON_ROWS} qtyMap={ivQty} onQty={onIv} />
      </div>
      <div>
        <p className="mb-1.5 font-body text-[14px] font-black uppercase tracking-[0.14em] text-foreground/46">IM shots</p>
        <AddonRows rows={IM_ADDON_ROWS} qtyMap={imQty} onQty={onIm} />
      </div>
    </div>
  );
}

function StepTerm({ monthly, termKey, onTerm, upfrontTotal, perMonth }) {
  const term = TERMS.find((t) => t.key === termKey) || TERMS[0];
  const isMonthly = term.key === 'monthly';
  return (
    <div>
      <PlanSelect value={termKey} onChange={onTerm} ariaLabel="Billing term" icon={CreditCard}>
        {TERMS.map((t) => (
          <option key={t.key} value={t.key} className="bg-background text-foreground">
            {t.key === 'monthly' ? 'Monthly' : `${t.label} upfront`}{t.discount ? ` · save ${Math.round(t.discount * 100)}%` : ''}
          </option>
        ))}
      </PlanSelect>
      <p className="mt-2 font-body text-[14px] font-bold uppercase tracking-[0.06em] text-foreground/52">
        {isMonthly ? `${money(monthly)}/mo · ${SUBSCRIPTION_COMMITMENT_SHORT}` : `${money(upfrontTotal)} today · ${money(perMonth)}/mo effective`}
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
      {value && <span className={`shrink-0 font-body text-[13px] font-bold tabular-nums ${muted ? 'text-foreground/46' : 'text-foreground/74'}`}>{value}</span>}
    </div>
  );
}

// The persistent "Your Plan" rail — mirrors the one-time-visit store's order
// rail (dark glass aside) but adopts the builder's live summary: bag, monthly
// price, what's included, and the upfront savings.
function PlanRail({ therapyOption, therapyLabel, sessions, baseMonthly, visitLineItems = [], visitsDiffer = false, monthly, planBase = 0, upgradesTotal = 0, term, perMonth, upfrontTotal, onStart, showStart = true, peopleBreakdown = [], peopleCount = 1 }) {
  const isMonthly = term.key === 'monthly';
  const bag = therapyOption?.image || '/bags/dehydration.webp';
  const saving = Math.round(monthly * term.months - upfrontTotal);
  const isMultiPerson = peopleCount > 1;
  // Billing model (must match PlanCheckout + /api/create-checkout-session):
  // $50/person deposit today, the rest of the first period after the first
  // visit, then the full plan auto-bills every period on the billing date.
  const periodTotal = isMonthly ? monthly : upfrontTotal;
  const depositToday = Math.min(50 * peopleCount, periodTotal);
  const firstVisitBalance = Math.max(0, periodTotal - depositToday);
  const renews = isMonthly ? 'every month' : `every ${term.label.toLowerCase()}`;
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-foreground/10 bg-background/70 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-2.5">
        <p className="font-body text-[14px] font-black uppercase tracking-[0.18em] text-foreground/48">Your plan</p>
        <p className="font-body text-[14px] font-bold uppercase tracking-[0.08em] text-foreground/40">{sessions} {sessions === 1 ? 'visit' : 'visits'} / month</p>
      </div>

      <div className="flex items-center gap-3.5 px-4 pt-3.5">
        <div className="flex h-[5.4rem] w-[4.5rem] shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-background/40">
          <img src={bag} alt={therapyOption?.image && therapyLabel ? `${therapyLabel} IV therapy` : ''} className="h-[4.6rem] w-auto object-contain" />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-[1.55rem] uppercase leading-[0.95] tracking-normal text-foreground">
            {isMultiPerson ? `${peopleCount} patients` : (therapyLabel || '—')}
          </p>
          <p className="mt-1 font-body text-[14px] font-bold uppercase tracking-[0.08em] text-foreground/52">
            {isMultiPerson ? `${sessions} visits/mo · one household` : (visitsDiffer ? `${sessions} visits · mixed IVs` : 'One IV per visit')}
          </p>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-heading text-[2.7rem] leading-none text-foreground">{money(isMonthly ? monthly : perMonth)}</span>
          <span className="font-body text-sm font-bold text-foreground/52">/mo</span>
        </div>
      </div>

      {/* How billing works — deposit today, balance after the first visit, then
          the full plan every period. Same numbers PlanCheckout charges. */}
      <div className="mx-4 mt-2 rounded-xl border border-foreground/12 bg-foreground/[0.04] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-body text-[14px] font-black uppercase tracking-[0.08em] text-foreground/74">Due today</span>
          <span className="font-heading text-[1.3rem] leading-none text-foreground tabular-nums">{money(depositToday)}</span>
        </div>
        <p className="mt-0.5 font-body text-[13px] font-bold uppercase tracking-[0.06em] text-foreground/42">
          $50 deposit{peopleCount > 1 ? ` · ${peopleCount} people` : ' to start'}
        </p>
        <div className="mt-1.5 space-y-1 border-t border-foreground/10 pt-1.5 font-body text-[14px] font-semibold text-foreground/60">
          <div className="flex items-center justify-between gap-2">
            <span>Balance after 1st visit</span>
            <span className="text-foreground/80 tabular-nums">{money(firstVisitBalance)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Then {renews}, billing date</span>
            <span className="text-foreground/80 tabular-nums">{money(periodTotal)}{isMonthly ? '/mo' : ''}</span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid gap-1 border-t border-foreground/10 px-4 pt-2.5">
        <p className="mb-0.5 font-body text-[13px] font-black uppercase tracking-[0.16em] text-foreground/40">
          {sessions} {sessions === 1 ? 'visit' : 'visits'} / month
        </p>
        <RailLine label={`Includes any service up to ${money(VISIT_CREDIT)}/visit`} value={money(planBase)} />
        {isMultiPerson ? (
          peopleBreakdown.map((row) => (
            <RailLine
              key={row.person.id}
              label={`${row.label} · ${row.therapy?.label || 'service pending'}`}
              value={row.upgrades > 0 ? `+${money(row.upgrades)}` : 'Included'}
              muted={row.upgrades <= 0}
            />
          ))
        ) : (
          // One line per visit, framed by the credit: Included or +$difference.
          visitLineItems.map((li) => (
            <RailLine
              key={li.index}
              label={`Visit ${li.index + 1} · ${li.label}`}
              value={li.included ? 'Included' : `+${money(li.upgrade)}`}
              muted={li.included}
            />
          ))
        )}
        {upgradesTotal > 0 && (
          <RailLine label="Premium upgrades" value={`+${money(upgradesTotal)}`} />
        )}
        <RailLine label="Clinical review once a year" />
      </div>

      {!isMonthly && saving > 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-foreground/14 bg-foreground/[0.06] px-3 py-2">
          <p className="font-body text-[15px] font-black text-foreground">You save {money(saving)}</p>
          <p className="font-body text-[14px] font-semibold text-foreground/52">vs. paying monthly over {term.label}</p>
        </div>
      )}

      <div className="px-4 pb-3.5 pt-2.5">
        {showStart && (
          <button
            type="button"
            onClick={onStart}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.08em] text-background transition-transform active:scale-[0.99]"
          >
            Start plan <ArrowRight className="h-4 w-4" />
          </button>
        )}
        <p className={`text-center font-body text-[14px] font-semibold leading-snug text-foreground/52 ${showStart ? 'mt-2' : ''}`}>
          Secure checkout. Cancel anytime after the 3-month minimum.
        </p>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function Subscription() {
  useSeo({
    title: 'Plans - Avalon Vitality',
    description: 'Build a monthly Avalon IV therapy plan one step at a time: choose how often, your therapy, add-ons, and pay monthly or upfront for 3, 6, or 12 months to save.',
    path: '/subscription',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Avalon Vitality IV Therapy Membership',
      description: 'A monthly mobile IV therapy plan: each visit includes any service up to a $250 visit credit, with 1–4 visits per month and up to 4 people on one plan.',
      brand: {
        '@type': 'Brand',
        name: 'Avalon Vitality',
      },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        // Single-person baseline: 1 visit/mo ($250) up to 4 visits/mo ($1,000).
        lowPrice: VITAMIN_IV_PRICE * SESSION_OPTIONS[0],
        highPrice: VITAMIN_IV_PRICE * SESSION_OPTIONS[SESSION_OPTIONS.length - 1],
        offerCount: SESSION_OPTIONS.length,
      },
    },
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Change mode: the portal Memberships page deep-links here as ?change=1 to let
  // an existing member re-open the builder and self-serve a plan change. In this
  // mode the CTA becomes "Update my plan" and Start runs the proration
  // preview/commit flow against /api/me/subscription/change instead of going to
  // the /plan checkout. Normal (signup) flow is untouched.
  const isChangeMode = searchParams.get('change') === '1';
  // change panel: { status:'preview'|'committing'|'error', proration } | null
  const [changePanel, setChangePanel] = useState(null);
  // Sessions/month and term apply to the whole household. Therapy + add-ons +
  // IM shots are PER PERSON — each patient on the plan picks their own protocol.
  // Landing-page tier CTAs deep-link as ?sessions=N (1–4) so the builder opens on
  // the plan the user picked; a bare /subscription still defaults to 2.
  const [sessions, setSessions] = useState(() => {
    const raw = Number(searchParams.get('sessions'));
    return Number.isInteger(raw) && raw >= 1 && raw <= 4 ? raw : 2;
  });
  // The ACTIVE person's per-visit plan. Each visit = { categoryKey, therapyKey,
  // ivQty, imQty }. Length tracks sessions/month; seeded uniform from visit 0.
  const [visits, setVisits] = useState(() =>
    resizeVisits({ visits: [makeVisit({ categoryKey: 'iv-vitamins', therapyKey: 'hydration' })] }, sessions)
  );
  const [termKey, setTermKey] = useState('monthly');
  // Roster. The ACTIVE person's selections live in the top-level state above;
  // every other person's selections are stashed inside their people[] entry.
  // Switching active person swaps those two columns.
  const [people, setPeople] = useState(() => [createPerson(0)]);
  const [activePersonId, setActivePersonId] = useState(() => people[0].id);
  // Which builder row is expanded. Sessions opens first (matches the mockup);
  // tapping a row toggles it, one open at a time. Visual-only — no plan state.
  const [openStep, setOpenStep] = useState(null); // load with every step collapsed
  const toggleStep = (key) => setOpenStep((current) => (current === key ? null : key));

  // Sessions/month resizes the ACTIVE person's visits array (grow = copy visit 0
  // = uniform-by-default; shrink = truncate). Other people resize on switch-in.
  const changeSessions = (next) => {
    const n = Math.max(1, Math.min(4, Number(next) || 1));
    setSessions(n);
    setVisits((prev) => resizeVisits({ visits: prev }, n));
  };

  const switchActivePerson = (nextId) => {
    if (!nextId || nextId === activePersonId) return;
    const target = people.find((p) => p.id === nextId);
    if (!target) return;
    setPeople((prev) => prev.map((p) => p.id === activePersonId ? { ...p, visits } : p));
    setActivePersonId(nextId);
    setVisits(resizeVisits(target, sessions));
  };

  const addNewPerson = () => {
    if (people.length >= PEOPLE_MAX) return;
    const fresh = createPerson(people.length);
    fresh.visits = resizeVisits({ visits: [makeVisit({ categoryKey: 'iv-vitamins', therapyKey: 'hydration' })] }, sessions);
    setPeople((prev) => {
      const stashed = prev.map((p) => p.id === activePersonId ? { ...p, visits } : p);
      return [...stashed, fresh];
    });
    setActivePersonId(fresh.id);
    setVisits(resizeVisits(fresh, sessions));
  };

  const deletePerson = (idToRemove) => {
    if (people.length <= 1) return;
    const filtered = people.filter((p) => p.id !== idToRemove);
    if (idToRemove === activePersonId) {
      const next = filtered[0];
      setVisits(resizeVisits(next, sessions));
      setActivePersonId(next.id);
    }
    setPeople(filtered);
  };

  // Per-visit editors for the active person. Picking a therapy also records the
  // visit's category (for pricing/gating). Add-on edits patch that visit's qty.
  const setVisitTherapy = (visitIndex, optKey) => {
    const cat = CATEGORIES.find((c) => c.options.some((o) => o.key === optKey)) || CATEGORIES[0];
    setVisits((prev) => prev.map((v, i) => i === visitIndex ? { ...v, categoryKey: cat.key, therapyKey: optKey } : v));
  };
  const setVisitIv = (visitIndex, key, value) => {
    setVisits((prev) => prev.map((v, i) => i === visitIndex ? { ...v, ivQty: { ...v.ivQty, [key]: value } } : v));
  };
  const setVisitIm = (visitIndex, key, value) => {
    setVisits((prev) => prev.map((v, i) => i === visitIndex ? { ...v, imQty: { ...v.imQty, [key]: value } } : v));
  };

  const term = TERMS.find((t) => t.key === termKey) || TERMS[0];
  // Visit 0 drives the rail header image/label + the collapsed-row summary.
  const { option: therapyOption } = findTherapy(visits[0]?.therapyKey);
  const perIvPrice = Number(therapyOption?.price || VITAMIN_IV_PRICE);

  // Per-visit line breakdown for the active person (one row per visit). Each
  // line carries the Visit Credit verdict so the rail can render "Included" or
  // "+$<difference>" instead of the raw price.
  const visitLineItems = useMemo(
    () => visits.map((v, i) => {
      const { option } = findTherapy(v.therapyKey);
      const { included, upgrade } = visitCredit(v);
      return { index: i, label: option?.label || '—', included, upgrade };
    }),
    [visits]
  );
  const visitsDiffer = useMemo(() => {
    const sig = (v) => JSON.stringify([v.therapyKey, v.ivQty, v.imQty]);
    return visits.some((v) => sig(v) !== sig(visits[0]));
  }, [visits]);

  // personMonthly under the Visit Credit model: each visit is floored at the
  // $250 credit, so `total` = Σ max(VISIT_CREDIT, cart) = base + upgrades. The
  // visits array length IS sessions, so base = sessions × $250 per person.
  // Plan monthly = sum across all people; the term discount applies to that.
  const personMonthly = (person) => {
    const pv = resizeVisits(person, sessions);
    const base = pv.length * VISIT_CREDIT;
    const total = pv.reduce((sum, v) => sum + visitCredit(v).total, 0);
    const upgrades = total - base;
    const { option } = findTherapy(pv[0]?.therapyKey);
    return { therapy: option, visits: pv, total, base, upgrades };
  };
  // Snapshot the OTHER people's stashed selections + the active person's live
  // visits to compute total monthly.
  const peopleSnapshot = people.map((p) => p.id === activePersonId ? { ...p, visits } : p);
  const peopleBreakdown = peopleSnapshot.map((p, index) => {
    const m = personMonthly(p);
    return { ...m, person: p, index, label: personLabelFor(p, index) };
  });
  const peopleCount = peopleBreakdown.length;
  // Plan economics under the Visit Credit model:
  //   planBase     = Σ (people's visits × $250)  — the membership price.
  //   monthly      = Σ max(VISIT_CREDIT, cart)    — base + premium upgrades.
  //   upgradesTotal= monthly − planBase           — extra paid above credits.
  const monthly = peopleBreakdown.reduce((sum, row) => sum + row.total, 0);
  const planBase = peopleBreakdown.reduce((sum, row) => sum + row.base, 0);
  const upgradesTotal = monthly - planBase;
  const baseMonthly = peopleBreakdown.find((r) => r.person.id === activePersonId)?.total || 0;
  // Roster rows for the "YOUR SESSION" builder. Plans show a per-person monthly.
  const sessionPeople = peopleBreakdown.map((row) => ({
    id: row.person.id,
    index: row.index,
    label: row.label,
    productLabel: row.therapy?.label || '',
    priceLabel: `${money(row.total)}/mo`,
    filled: Boolean(row.therapy),
  }));
  const upfrontTotal = Math.round(monthly * term.months * (1 - term.discount));
  const perMonth = Math.round(upfrontTotal / term.months);
  const addOnCount = visits.reduce(
    (sum, v) =>
      sum +
      IV_ADDON_ITEMS.reduce((s, i) => s + (v.ivQty?.[i.key] || 0), 0) +
      IM_ADDON_ITEMS.reduce((s, i) => s + (v.imQty?.[i.key] || 0), 0),
    0
  );

  // Collapsed-row summary strings — each reads existing builder state, no new
  // value state. Mirrors the labels shown in the target mockup.
  const sessionsSummary = `${sessions}× / Month · ${sessions} IV ${sessions === 1 ? 'Visit' : 'Visits'}`;
  const peopleSummary = peopleCount > 1 ? `${peopleCount} people` : 'Just me';
  // Therapy summary: "Hydration" when uniform, "Hydration +2 more" when mixed.
  const therapySummary = visitsDiffer
    ? `${therapyOption?.label || '—'} +${sessions - 1} more`
    : (therapyOption?.label || '—');
  const addonsSummary = addOnCount > 0 ? `${addOnCount} selected` : 'None selected';
  const termSummary = term.label;
  // $50/person deposit due today (matches PlanRail + PlanCheckout).
  const depositToday = Math.min(50 * peopleCount, term.key === 'monthly' ? monthly : upfrontTotal);

  const startPlan = () => {
    // Plans use their OWN checkout (/plan → subscription mode + membership Acuity
    // type), intentionally NOT the one-time 5-step /book flow. The plan manifest
    // carries each person's protocol so /plan can render a per-person summary
    // and /api/create-checkout-session can scale the $50 deposit per person.
    // Each person now carries a `visits` array so per-visit IV detail flows to
    // checkout (Phase B wires display/Acuity). The legacy top-level fields
    // (therapyKey/ivPrice/ivQty/imQty) are kept from visit 0 for back-compat
    // with PlanCheckout's per-person summary.
    const planManifest = peopleBreakdown.map((row) => {
      const v0 = row.visits[0] || makeVisit();
      const { option: v0opt } = findTherapy(v0.therapyKey);
      return {
        id: row.person.id,
        label: row.label,
        name: row.person.name || '',
        dob: row.person.dob || '',
        therapyKey: v0.therapyKey,
        therapyLabel: v0opt?.label || '',
        ivPrice: Number(v0opt?.price || VITAMIN_IV_PRICE),
        monthly: row.total,
        // Visit Credit economics for this person (membership base vs upgrades).
        base: row.base,
        upgrades: row.upgrades,
        ivQty: v0.ivQty || {},
        imQty: v0.imQty || {},
        visits: row.visits.map((v) => {
          const { option } = findTherapy(v.therapyKey);
          // Resolve add-on labels here (the builder has the catalog) so checkout
          // + the nurse-facing Acuity note can itemize without re-importing it.
          const addons = [
            ...IV_ADDON_ITEMS.filter((it) => (v.ivQty?.[it.key] || 0) > 0).map((it) => ({ label: it.label, qty: v.ivQty[it.key] })),
            ...IM_ADDON_ITEMS.filter((it) => (v.imQty?.[it.key] || 0) > 0).map((it) => ({ label: it.label, qty: v.imQty[it.key] })),
          ];
          // Per-visit Visit Credit verdict so checkout can show Included vs the
          // premium difference without re-deriving the credit math.
          const { included, upgrade } = visitCredit(v);
          return {
            therapyKey: v.therapyKey,
            therapyLabel: option?.label || '',
            ivPrice: Number(option?.price || VITAMIN_IV_PRICE),
            credit: VISIT_CREDIT,
            included,
            upgrade,
            ivQty: v.ivQty || {},
            imQty: v.imQty || {},
            addons,
          };
        }),
      };
    });
    const params = new URLSearchParams({
      price: String(Math.round(monthly)),
      term: term.key,
      protocol: therapyOption?.protocol || 'recovery',
      sessions: String(sessions),
      people: String(peopleCount),
    });
    // Always pass the manifest now (even single-person) so per-visit detail
    // flows to /plan. PlanCheckout tolerates the extra `visits` field.
    params.set('plan', encodeURIComponent(JSON.stringify(planManifest)));
    navigate(`/plan?${params.toString()}`);
  };

  // ── Change-mode: proration preview + commit ───────────────────────────────
  // The custom plan the builder describes (computed monthly + total visits per
  // cycle + term) is sent to /api/me/subscription/change as targetPlan:'custom'.
  // Total visits per cycle = sessions × people on the plan (matches the
  // per-cycle credit grant). The recurring price the change uses is the SAME
  // periodic charge PlanRail shows: monthly for monthly term, the upfront total
  // for committed terms.
  const visitsPerCycle = Math.max(1, sessions * peopleCount);
  const changePriceDollars = term.key === 'monthly' ? Math.round(monthly) : Math.round(upfrontTotal);
  const planNameForChange = `${peopleCount > 1 ? `${peopleCount}-person` : 'Custom'} ${sessions}×`;

  const buildCustomBody = () => ({
    priceDollars: changePriceDollars,
    visitsPerCycle,
    name: planNameForChange,
    billing: term.key,
  });

  const previewChange = async () => {
    setChangePanel({ status: 'loading', proration: null });
    try {
      const data = await apiPost('/api/me/subscription/change', {
        targetPlan: 'custom',
        action: 'preview',
        custom: buildCustomBody(),
      });
      setChangePanel({ status: 'preview', proration: data?.proration || null });
    } catch (err) {
      setChangePanel({ status: 'error', error: err?.body?.error || err?.message || 'Could not preview the change.' });
    }
  };

  const commitChange = async () => {
    setChangePanel((p) => ({ ...(p || {}), status: 'committing' }));
    try {
      await apiPost('/api/me/subscription/change', {
        targetPlan: 'custom',
        action: 'commit',
        custom: buildCustomBody(),
      });
      navigate('/members/memberships');
    } catch (err) {
      setChangePanel({ status: 'error', error: err?.body?.error || err?.message || 'Could not update the plan.' });
    }
  };

  // In change mode the primary CTA opens the proration preview; otherwise it's
  // the normal checkout hand-off.
  const onPrimaryCta = isChangeMode ? previewChange : startPlan;
  const primaryCtaLabel = isChangeMode ? 'Update my plan' : 'Continue to checkout';

  const rail = (
    <PlanRail
      therapyOption={therapyOption}
      therapyLabel={therapyOption?.label}
      sessions={sessions}
      baseMonthly={baseMonthly}
      visitLineItems={visitLineItems}
      visitsDiffer={visitsDiffer}
      monthly={monthly}
      planBase={planBase}
      upgradesTotal={upgradesTotal}
      term={term}
      perMonth={perMonth}
      upfrontTotal={upfrontTotal}
      onStart={startPlan}
      showStart={false}
      peopleBreakdown={peopleBreakdown}
      peopleCount={peopleCount}
    />
  );

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden bg-transparent text-foreground">
      <header>
        <Navbar />
      </header>
      <main id="plans-builder" className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[5.25rem] md:pt-[5.75rem]">
        <div className="mb-3 text-center md:mb-3 md:text-left">
          <h1 className="font-heading text-[2.3rem] uppercase leading-[0.86] tracking-normal text-foreground md:text-[2.8rem]">Choose your plan</h1>
          <p className="mt-1 font-body text-sm font-semibold text-foreground/68">Up to 4 people on one plan. Cancel anytime.</p>
        </div>

        <div className="flex flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_21rem] md:items-start md:gap-7 lg:grid-cols-[minmax(0,1fr)_23rem]">
          {/* Left — the one-screen builder: every decision stacked as a section */}
          <div className="flex flex-1 flex-col">
            {/* How it works — compact intro at the very top of the builder. */}
            <div className="mb-2.5 flex items-center gap-2.5 rounded-[1.05rem] border border-foreground/10 bg-foreground/[0.03] px-3.5 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.05]">
                <Info className="h-4 w-4 text-foreground/55" strokeWidth={2} />
              </span>
              <p className="min-w-0 font-body text-[13px] font-semibold leading-snug text-foreground/60">
                <span className="font-black uppercase tracking-[0.06em] text-foreground/80">How it works · </span>
                Each visit includes any service up to {money(VISIT_CREDIT)} — pay only the difference for premium services.
              </p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="av-glass-card flex flex-col gap-1.5 rounded-[1.3rem] border bg-background/82 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl"
            >
              <BuilderRow
                title={STEP_TITLES.sessions}
                value={sessionsSummary}
                hint="Choose how many visits per month."
                icon={CalendarClock}
                open={openStep === 'sessions'}
                onToggle={() => toggleStep('sessions')}
              >
                <SessionSegment sessions={sessions} onSessions={changeSessions} perIvPrice={perIvPrice} />
              </BuilderRow>

              <BuilderRow
                title="Who's on it"
                value={peopleSummary}
                hint="Add up to 3 more people."
                icon={Users}
                open={openStep === 'people'}
                onToggle={() => toggleStep('people')}
              >
                <SessionBuilder
                  people={sessionPeople}
                  activePersonId={activePersonId}
                  onSelect={switchActivePerson}
                  onAdd={addNewPerson}
                  onRemove={deletePerson}
                  addLabel="Add another person"
                />
              </BuilderRow>

              <BuilderRow
                title={STEP_TITLES.therapy}
                value={therapySummary}
                hint="Change your therapy for any visit."
                icon={Droplets}
                open={openStep === 'therapy'}
                onToggle={() => toggleStep('therapy')}
              >
                <StepVisits
                  sessions={sessions}
                  visits={visits}
                  onVisitTherapy={setVisitTherapy}
                  onVisitIv={setVisitIv}
                  onVisitIm={setVisitIm}
                />
              </BuilderRow>

              {/* Single-visit plans keep a standalone Add-ons row (edits visit 0).
                  Multi-visit plans fold add-ons INTO each visit row above. */}
              {sessions <= 1 && (
                <BuilderRow
                  title={STEP_TITLES.addons}
                  value={addonsSummary}
                  hint="Pay only the difference for premium services."
                  icon={Sparkles}
                  open={openStep === 'addons'}
                  onToggle={() => toggleStep('addons')}
                >
                  <StepAddons
                    ivQty={visits[0]?.ivQty || {}}
                    imQty={visits[0]?.imQty || {}}
                    onIv={(key, v) => setVisitIv(0, key, v)}
                    onIm={(key, v) => setVisitIm(0, key, v)}
                  />
                </BuilderRow>
              )}

              <BuilderRow
                title={STEP_TITLES.term}
                value={termSummary}
                hint="Cancel or change anytime."
                icon={CreditCard}
                open={openStep === 'term'}
                onToggle={() => toggleStep('term')}
              >
                <StepTerm monthly={monthly} termKey={termKey} onTerm={setTermKey} upfrontTotal={upfrontTotal} perMonth={perMonth} />
              </BuilderRow>
            </motion.div>

            {/* Desktop primary CTA at the foot of the builder column. */}
            <button
              type="button"
              onClick={onPrimaryCta}
              className="mt-2 hidden min-h-[50px] w-full items-center justify-center gap-2 rounded-[1.05rem] border border-foreground/82 bg-foreground px-4 font-body text-sm font-black uppercase tracking-[0.1em] text-background transition-transform active:scale-[0.99] md:flex"
            >
              {primaryCtaLabel} <ArrowRight className="h-4 w-4" />
            </button>

            {/* Mobile: full plan rail (info only), then a sticky price + Start plan bar */}
            <div className="mt-5 md:hidden">
              <PlanRail
                therapyOption={therapyOption}
                therapyLabel={therapyOption?.label}
                sessions={sessions}
                baseMonthly={baseMonthly}
                visitLineItems={visitLineItems}
                visitsDiffer={visitsDiffer}
                monthly={monthly}
                planBase={planBase}
                upgradesTotal={upgradesTotal}
                term={term}
                perMonth={perMonth}
                upfrontTotal={upfrontTotal}
                onStart={startPlan}
                showStart={false}
                peopleBreakdown={peopleBreakdown}
                peopleCount={peopleCount}
              />
            </div>
            <MobileStartBar
              therapyLabel={therapyOption?.label}
              sessions={sessions}
              monthly={monthly}
              depositToday={depositToday}
              onStart={onPrimaryCta}
              changeMode={isChangeMode}
            />
          </div>

          {/* Right — the persistent "Your Plan" rail (desktop only) */}
          <aside className="hidden md:sticky md:top-[5.75rem] md:block">{rail}</aside>
        </div>
      </main>

      {/* Change-mode confirm panel: shows the live Stripe proration before the
          member commits the plan change. Portaled so it overlays the builder. */}
      {isChangeMode && changePanel && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center">
              <div className="w-full max-w-md overflow-hidden rounded-[1.25rem] border border-foreground/12 bg-background/95 shadow-[0_28px_110px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                <div className="border-b border-foreground/10 px-5 py-4">
                  <p className="font-heading text-xl uppercase leading-none tracking-normal text-foreground">Update your plan</p>
                  <p className="mt-1.5 font-body text-[13px] font-semibold text-foreground/55">
                    {planNameForChange} · {visitsPerCycle} {visitsPerCycle === 1 ? 'visit' : 'visits'} / cycle · {money(changePriceDollars)}{term.key === 'monthly' ? '/mo' : ` per ${term.label.toLowerCase()}`}
                  </p>
                </div>

                <div className="px-5 py-4">
                  {changePanel.status === 'loading' ? (
                    <p className="font-body text-sm font-semibold text-foreground/60">Calculating proration.</p>
                  ) : changePanel.status === 'error' ? (
                    <p className="font-body text-sm font-semibold text-rose-300">
                      {changePanel.error || 'Something went wrong. Try again or contact Avalon.'}
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-2 font-body text-[13px]">
                        {(changePanel.proration?.items || []).map((line, idx) => (
                          <div key={idx} className="flex items-baseline justify-between gap-3 border-b border-foreground/10 pb-1.5">
                            <span className="text-foreground/55">{line.description || (line.proration ? 'Proration' : 'Line item')}</span>
                            <span className="font-bold tabular-nums text-foreground/80">
                              {line.amount < 0 ? '− ' : '+ '}{money(Math.abs(line.amount))}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-baseline justify-between gap-3 pt-1">
                          <span className="font-heading text-lg uppercase text-foreground">Charged today</span>
                          <span className="font-heading text-lg uppercase tabular-nums text-foreground">
                            {money(Math.max(0, changePanel.proration?.amountDue || 0))}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 font-body text-[12px] font-semibold text-foreground/52">
                        Then {money(changePriceDollars)}{term.key === 'monthly' ? '/mo' : ` per ${term.label.toLowerCase()}`} at your next renewal. Cancel or change anytime.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-foreground/10 px-5 py-4">
                  {changePanel.status === 'preview' ? (
                    <button
                      type="button"
                      onClick={commitChange}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-[11px] font-black uppercase tracking-[0.12em] text-background"
                    >
                      Confirm change
                    </button>
                  ) : changePanel.status === 'committing' ? (
                    <button
                      type="button"
                      disabled
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-foreground/40 bg-foreground/70 px-4 font-body text-[11px] font-black uppercase tracking-[0.12em] text-background opacity-70"
                    >
                      Updating.
                    </button>
                  ) : changePanel.status === 'error' ? (
                    <button
                      type="button"
                      onClick={previewChange}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-foreground/82 bg-foreground px-4 font-body text-[11px] font-black uppercase tracking-[0.12em] text-background"
                    >
                      Try again
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setChangePanel(null)}
                    disabled={changePanel.status === 'committing'}
                    className="flex min-h-[44px] items-center justify-center rounded-xl border border-foreground/14 bg-foreground/[0.05] px-4 font-body text-[11px] font-black uppercase tracking-[0.12em] text-foreground disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
