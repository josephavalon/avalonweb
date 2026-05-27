import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react';

const ICONS = {
  Visit: Clock3,
  Money: CreditCard,
  Location: MapPin,
  Clinical: Stethoscope,
  Order: FileText,
  Nurse: UserCheck,
  Comms: MessageCircle,
  Events: ShieldCheck,
  Care: ShieldCheck,
  Trust: CheckCircle2,
};

const TONE = {
  ready: {
    dot: 'bg-emerald-300',
    border: 'border-emerald-300/18',
    text: 'text-emerald-100',
    bg: 'bg-emerald-300/[0.045]',
  },
  action: {
    dot: 'bg-amber-300',
    border: 'border-amber-300/22',
    text: 'text-amber-100',
    bg: 'bg-amber-300/[0.055]',
  },
  blocked: {
    dot: 'bg-red-300',
    border: 'border-red-300/24',
    text: 'text-red-100',
    bg: 'bg-red-300/[0.06]',
  },
  neutral: {
    dot: 'bg-foreground/32',
    border: 'border-foreground/[0.10]',
    text: 'text-foreground/58',
    bg: 'bg-foreground/[0.03]',
  },
};

function toneClass(tone, part) {
  return TONE[tone]?.[part] || TONE.neutral[part];
}

function SummaryPill({ label, value, tone = 'neutral' }) {
  return (
    <div className={`inline-flex min-h-[34px] items-center gap-2 rounded-full border px-3 ${toneClass(tone, 'border')} ${toneClass(tone, 'bg')}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${toneClass(tone, 'dot')}`} />
      <span className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/42">{label}</span>
      <span className={`font-body text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClass(tone, 'text')}`}>{value}</span>
    </div>
  );
}

function TruthCard({ item, compact = false }) {
  const Icon = ICONS[item.group] || ShieldCheck;
  const body = (
    <article className={`group h-full rounded-[22px] border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 ${toneClass(item.tone, 'border')} ${toneClass(item.tone, 'bg')}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-foreground/10 bg-background/35 text-foreground/62">
          <Icon className="h-4 w-4" strokeWidth={1.7} />
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-body text-[8px] font-semibold uppercase tracking-[0.14em] ${toneClass(item.tone, 'border')} ${toneClass(item.tone, 'text')}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${toneClass(item.tone, 'dot')}`} />
          {item.status}
        </span>
      </div>

      <div className="mt-4">
        <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/35">{item.label}</p>
        <h3 className="mt-1 font-heading text-2xl uppercase leading-none text-foreground">{item.value}</h3>
      </div>

      {!compact && (
        <p className="mt-3 line-clamp-3 font-body text-xs leading-relaxed text-foreground/58">{item.detail}</p>
      )}

      {!compact && (
        <div className="mt-4 space-y-1.5 border-t border-foreground/[0.07] pt-3">
          <p className="font-body text-[9px] uppercase tracking-[0.16em] text-foreground/35">Owner: <span className="text-foreground/60">{item.owner}</span></p>
          <p className="font-body text-[9px] uppercase tracking-[0.16em] text-foreground/35">Updated: <span className="text-foreground/60">{item.updatedLabel}</span></p>
        </div>
      )}

      {!compact && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="line-clamp-2 font-body text-[10px] leading-relaxed text-foreground/42">{item.nextAction}</p>
          {item.actionHref ? (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.04] text-foreground/60 transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </span>
          ) : null}
        </div>
      )}
    </article>
  );

  if (!item.actionHref) return body;
  return (
    <Link to={item.actionHref} aria-label={`${item.label}: ${item.actionLabel || item.value}`} className="block h-full">
      {body}
    </Link>
  );
}

export default function ConsumerTruthLayer({
  truth,
  title = 'Truth Layer',
  eyebrow = 'Consumer OS',
  intro = 'Every consumer promise maps to a status, owner, timestamp, and next action.',
  compact = false,
  limit = null,
  showGroups = true,
  showSummary = true,
  showGuardrail = true,
}) {
  const modules = limit ? truth.modules.slice(0, limit) : truth.modules;
  const grouped = modules.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <section className="rounded-[30px] border border-foreground/[0.10] bg-foreground/[0.025] p-4 shadow-[0_24px_100px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.28em] text-accent/82">{eyebrow}</p>
          <h2 className="mt-2 font-heading text-4xl uppercase leading-none text-foreground md:text-5xl">{title}</h2>
          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-foreground/56">{intro}</p>
        </div>
        {showSummary && (
          <div className="flex flex-wrap gap-2">
            <SummaryPill label="Builds" value={`${truth.count}/${truth.targetCount}`} tone={truth.complete ? 'ready' : 'action'} />
            <SummaryPill label="Ready" value={truth.summary.ready} tone="ready" />
            <SummaryPill label="Action" value={truth.summary.action} tone={truth.summary.action ? 'action' : 'neutral'} />
            {truth.summary.blocked ? <SummaryPill label="Blocked" value={truth.summary.blocked} tone="blocked" /> : null}
          </div>
        )}
      </div>

      {showGuardrail && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-foreground/[0.08] bg-background/32 px-3 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-foreground/40" strokeWidth={1.7} />
          <p className="font-body text-[11px] leading-relaxed text-foreground/48">
            If a status is not backed by a record, it shows as pending, armed, manual, or needed. No fake certainty.
          </p>
        </div>
      )}

      {showGroups ? (
        <div className="mt-6 space-y-6">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-foreground/[0.08]" />
                <span className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">{group}</span>
                <span className="h-px flex-1 bg-foreground/[0.08]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => <TruthCard key={item.key} item={item} compact={compact} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((item) => <TruthCard key={item.key} item={item} compact={compact} />)}
        </div>
      )}
    </section>
  );
}
