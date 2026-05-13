import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckSquare, CheckCircle, DollarSign,
  AlertCircle, Instagram, Syringe, Users,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';

// ── Report card data ──────────────────────────────────────────────────────────

const REPORT_CARDS = [
  {
    id: 'rc1',
    title: 'Requests This Week',
    value: '12',
    sub: '+3 from last week',
    icon: Calendar,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    bgColor: 'bg-blue-500/08',
  },
  {
    id: 'rc2',
    title: 'Confirmed Visits',
    value: '8',
    sub: '67% confirmation rate',
    icon: CheckSquare,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    bgColor: 'bg-amber-500/08',
  },
  {
    id: 'rc3',
    title: 'Completed Visits',
    value: '5',
    sub: '3 pending',
    icon: CheckCircle,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/20',
    bgColor: 'bg-emerald-500/08',
  },
  {
    id: 'rc4',
    title: 'Est. Revenue',
    value: '$2,840',
    sub: '$660 pending',
    icon: DollarSign,
    color: 'text-accent',
    borderColor: 'border-accent/20',
    bgColor: 'bg-accent/08',
    accentValue: true,
  },
  {
    id: 'rc5',
    title: 'Payment Pending',
    value: '$660',
    sub: '3 visits',
    icon: AlertCircle,
    color: 'text-red-400',
    borderColor: 'border-red-500/20',
    bgColor: 'bg-red-500/08',
  },
  {
    id: 'rc6',
    title: 'Top Source',
    value: 'Instagram',
    sub: '4 requests',
    icon: Instagram,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/20',
    bgColor: 'bg-purple-500/08',
  },
  {
    id: 'rc7',
    title: "Most Requested",
    value: "Myers' Cocktail",
    sub: '3 bookings',
    icon: Syringe,
    color: 'text-teal-400',
    borderColor: 'border-teal-500/20',
    bgColor: 'bg-teal-500/08',
    smallValue: true,
  },
  {
    id: 'rc8',
    title: 'Membership Interest',
    value: '5 leads',
    sub: '2 contacted',
    icon: Users,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    bgColor: 'bg-blue-500/08',
  },
];

const SOURCES = [
  { label: 'Instagram', pct: 33, count: 4 },
  { label: 'Google',    pct: 25, count: 3 },
  { label: 'Hotel',     pct: 17, count: 2 },
  { label: 'Website',   pct: 17, count: 2 },
  { label: 'Referral',  pct: 8,  count: 1 },
];

const THERAPIES = [
  { label: "Myers' Cocktail",  count: 3 },
  { label: 'NAD+ Infusion',    count: 2 },
  { label: 'Performance Drip', count: 2 },
  { label: 'Hydration IV',     count: 2 },
  { label: 'Recovery Drip',    count: 1 },
];

const MAX_THERAPY = Math.max(...THERAPIES.map(t => t.count));

// ── ReportCard ────────────────────────────────────────────────────────────────

function ReportCard({ title, value, sub, icon: Icon, color, borderColor, bgColor, accentValue, smallValue }) {
  return (
    <div
      className={`rounded-xl border p-4 space-y-3 flex flex-col ${borderColor}`}
      style={{ background: 'hsl(var(--foreground) / 0.03)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-body text-[11px] text-foreground/50 tracking-wide leading-tight">{title}</span>
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${bgColor}`}
          style={{ background: undefined }}
        >
          <Icon className={`w-3.5 h-3.5 ${color}`} strokeWidth={1.5} />
        </div>
      </div>
      <div>
        <p
          className={`font-heading tracking-wide leading-none ${smallValue ? 'text-lg' : 'text-2xl'} ${accentValue ? 'text-accent' : 'text-foreground'}`}
          style={accentValue ? { color: 'hsl(var(--accent))' } : undefined}
        >
          {value}
        </p>
        <p className="font-body text-[11px] text-foreground/40 mt-1">{sub}</p>
      </div>
    </div>
  );
}

// ── BarRow ────────────────────────────────────────────────────────────────────

function BarRow({ label, pct, count, max }) {
  const fillPct = max !== undefined ? Math.round((count / max) * 100) : pct;
  return (
    <div className="flex items-center gap-3">
      <span className="font-body text-[12px] text-foreground/60 w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${fillPct}%`, background: 'hsl(var(--accent))' }}
        />
      </div>
      <span className="font-body text-[11px] text-foreground/45 w-6 text-right shrink-0">
        {count}
      </span>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }) {
  return (
    <h2 className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 font-medium mb-3">
      {label}
    </h2>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const Skeleton = () => (
  <div className="p-6 space-y-4 animate-pulse">
    {[1,2,3,4].map(i => (
      <div key={i} className="h-14 rounded-xl bg-foreground/[0.06]" />
    ))}
  </div>
);

export default function Reports() {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, []);

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (loading) return (
    <AdminLayout>
      <Skeleton />
    </AdminLayout>
  );

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="mb-6 space-y-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-heading text-2xl tracking-[0.15em] text-foreground uppercase">
            Reports
          </h1>
          <span
            className="font-body text-[10px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border"
            style={{
              color:       'hsl(var(--foreground) / 0.4)',
              borderColor: 'hsl(var(--foreground) / 0.12)',
              background:  'hsl(var(--foreground) / 0.04)',
            }}
          >
            Manual Data · No Analytics API
          </span>
        </div>
        <p className="font-body text-[12px] text-foreground/45 tracking-wide">
          SF Bay Area Launch Snapshot &nbsp;·&nbsp; {today}
        </p>
      </div>

      {/* 2×4 Card grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {REPORT_CARDS.map(card => (
          <ReportCard key={card.id} {...card} />
        ))}
      </div>

      {/* Source breakdown + Therapy popularity — 2 col on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

        {/* Source breakdown */}
        <div
          className="rounded-xl border p-5"
          style={{
            background:  'hsl(var(--foreground) / 0.03)',
            borderColor: 'hsl(var(--foreground) / 0.08)',
          }}
        >
          <SectionHeader label="Request Sources" />
          <div className="space-y-3">
            {SOURCES.map(s => (
              <BarRow key={s.label} label={s.label} pct={s.pct} count={s.count} />
            ))}
          </div>
          <p className="font-body text-[10px] text-foreground/30 mt-4">
            Based on 12 requests this week.
          </p>
        </div>

        {/* Therapy popularity */}
        <div
          className="rounded-xl border p-5"
          style={{
            background:  'hsl(var(--foreground) / 0.03)',
            borderColor: 'hsl(var(--foreground) / 0.08)',
          }}
        >
          <SectionHeader label="Therapy Popularity" />
          <div className="space-y-3">
            {THERAPIES.map(t => (
              <BarRow key={t.label} label={t.label} count={t.count} max={MAX_THERAPY} />
            ))}
          </div>
          <p className="font-body text-[10px] text-foreground/30 mt-4">
            Based on completed and confirmed visits.
          </p>
        </div>
      </div>

      {/* Launch metrics notice */}
      <div
        className="rounded-xl border px-5 py-4"
        style={{
          background:  'hsl(var(--accent) / 0.05)',
          borderColor: 'hsl(var(--accent) / 0.2)',
        }}
      >
        <p className="font-body text-[12px] leading-relaxed"
          style={{ color: 'hsl(var(--accent) / 0.8)' }}>
          Reports reflect manual data. Analytics automation placeholder enabled after launch.
        </p>
      </div>
    </AdminLayout>
  );
}
