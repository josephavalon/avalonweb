import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';

const TONE = {
  ready: 'border-emerald-300/22 bg-emerald-300/[0.06] text-emerald-100',
  action: 'border-foreground/20 bg-foreground/[0.09] text-foreground',
  blocked: 'border-amber-300/24 bg-amber-300/[0.07] text-amber-100',
  neutral: 'border-foreground/12 bg-background/42 text-foreground',
};

export default function CustomerWidget({
  icon: Icon = Check,
  label,
  value,
  state = 'neutral',
  to,
  href,
  className = '',
}) {
  const body = (
    <>
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,hsl(var(--foreground)/0.13),transparent_38%),linear-gradient(145deg,hsl(var(--foreground)/0.07),transparent_58%,hsl(var(--foreground)/0.025))]" />
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-foreground/16 bg-foreground/[0.075] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate font-heading text-[1.7rem] uppercase leading-none tracking-normal">{label}</span>
        {value ? (
          <span className="mt-1 block truncate font-body text-xs font-black uppercase tracking-[0.12em] text-foreground/58">{value}</span>
        ) : null}
      </span>
      {(to || href) ? (
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-background/34 text-foreground/62">
          <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
        </span>
      ) : null}
    </>
  );

  const classes = `av-glass-widget relative flex min-h-[82px] items-center gap-3 overflow-hidden rounded-[1.35rem] border p-3 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_20px_80px_hsl(var(--foreground)/0.07)] backdrop-blur-2xl ${TONE[state] || TONE.neutral} ${className}`;

  if (to) return <Link to={to} className={classes}>{body}</Link>;
  if (href) return <a href={href} className={classes}>{body}</a>;
  return <div className={classes}>{body}</div>;
}
