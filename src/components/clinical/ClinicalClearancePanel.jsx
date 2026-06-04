import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { clinicalStatusTone, evaluateClinicalClearance } from '@/lib/clinicalClearance';

const TONE = {
  ready: {
    icon: CheckCircle2,
    border: 'border-emerald-300/20',
    bg: 'bg-emerald-300/[0.045]',
    text: 'text-emerald-100',
    dot: 'bg-emerald-300',
  },
  action: {
    icon: AlertTriangle,
    border: 'border-amber-300/24',
    bg: 'bg-amber-300/[0.055]',
    text: 'text-amber-100',
    dot: 'bg-amber-300',
  },
  blocked: {
    icon: XCircle,
    border: 'border-red-300/24',
    bg: 'bg-red-300/[0.06]',
    text: 'text-red-100',
    dot: 'bg-red-300',
  },
};

function toneFor(verdict) {
  return TONE[clinicalStatusTone(verdict)] || TONE.action;
}

function Checkpoint({ item, compact }) {
  const tone = item.blocked ? TONE.blocked : item.complete ? TONE.ready : TONE.action;
  const Icon = item.blocked ? XCircle : item.complete ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`rounded-2xl border p-3 ${tone.border} ${tone.bg}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${tone.text}`} strokeWidth={1.8} />
          <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/72">{item.label}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${tone.text} bg-background/30`}>
          {item.status}
        </span>
      </div>
      {!compact && <p className="mt-2 line-clamp-2 font-body text-[11px] leading-relaxed text-foreground/48">{item.detail}</p>}
    </div>
  );
}

export default function ClinicalClearancePanel({
  booking,
  profile,
  title = 'Clinical Gate',
  compact = false,
}) {
  const verdict = evaluateClinicalClearance(booking || {}, { profile });
  const tone = toneFor(verdict);
  const Icon = tone.icon || ShieldCheck;

  return (
    <section className={`rounded-[26px] border p-4 shadow-[0_22px_90px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl ${tone.border} ${tone.bg}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-foreground/10 bg-background/35 text-foreground/70">
          <Icon className={`h-5 w-5 ${tone.text}`} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[10px] uppercase tracking-[0.24em] text-foreground/38">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-3xl uppercase leading-none text-foreground">{verdict.label}</h3>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-body text-[8px] font-semibold uppercase tracking-[0.14em] ${tone.border} ${tone.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              {verdict.dispatchAllowed ? 'Dispatch allowed' : 'No dispatch'}
            </span>
          </div>
          <p className="mt-2 font-body text-xs leading-relaxed text-foreground/56">{verdict.summary}</p>
          {!compact && (
            <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/42">
              {verdict.gfeRoute}
            </p>
          )}
        </div>
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? 'grid-cols-1 md:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-1 md:grid-cols-2'}`}>
        {verdict.checkpoints.map((item) => (
          <Checkpoint key={item.key} item={item} compact={compact} />
        ))}
      </div>

      {!verdict.dispatchAllowed && (
        <div className="mt-3 rounded-2xl border border-foreground/[0.08] bg-background/30 px-3 py-2">
          <p className="font-body text-[10px] uppercase tracking-[0.16em] text-foreground/36">Next</p>
          <p className="mt-1 font-body text-xs leading-relaxed text-foreground/62">{verdict.nextAction}</p>
        </div>
      )}
    </section>
  );
}
