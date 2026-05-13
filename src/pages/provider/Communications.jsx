import React, { useState } from 'react';
import {
  Clock, MessageSquare, Check, RefreshCw, Star, PlusCircle,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { FOLLOWUPS } from '@/data/commandMockData';
import { useToast } from '@/components/ui/use-toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'all',        label: 'All' },
  { id: 'overdue',    label: 'Overdue' },
  { id: 'high',       label: 'High Priority' },
  { id: 'postvisit',  label: 'Post-Visit' },
  { id: 'review',     label: 'Review' },
  { id: 'rebook',     label: 'Rebook' },
  { id: 'membership', label: 'Membership' },
  { id: 'vip',        label: 'VIP' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function isDoneThisWeek(item) {
  if (item.status !== 'Done') return false;
  const d = new Date(item.dueDate || item.due_date);
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);
  return d >= weekAgo;
}

function applyFilter(items, filter) {
  switch (filter) {
    case 'overdue':    return items.filter(f => f.status === 'Overdue');
    case 'high':       return items.filter(f => f.priority === 'High');
    case 'postvisit':  return items.filter(f => f.type === 'Post-visit check-in');
    case 'review':     return items.filter(f => f.type === 'Review request');
    case 'rebook':     return items.filter(f => f.type === 'Rebook prompt');
    case 'membership': return items.filter(f => f.type === 'Membership upsell');
    case 'vip':        return items.filter(f => f.type === 'VIP follow-up');
    default:           return items;
  }
}

// ── StatusPill ────────────────────────────────────────────────────────────────

function StatusPill({ value }) {
  const map = {
    Pending:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Done:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Overdue:  'bg-red-500/15 text-red-400 border-red-500/30',
    High:     'bg-red-500/15 text-red-400 border-red-500/30',
    Medium:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Low:      'bg-foreground/10 text-foreground/50 border-foreground/20',
  };
  const cls = map[value] || 'bg-foreground/10 text-foreground/50 border-foreground/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border ${cls}`}>
      {value}
    </span>
  );
}

// ── ActionBtn ─────────────────────────────────────────────────────────────────

function ActionBtn({ icon: Icon, label, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-body font-medium transition-all active:scale-95"
      style={{
        background:   accent ? 'hsl(var(--accent) / 0.15)'    : 'hsl(var(--foreground) / 0.06)',
        color:        accent ? 'hsl(var(--accent))'            : 'hsl(var(--foreground) / 0.7)',
        border:       accent ? '1px solid hsl(var(--accent) / 0.3)' : '1px solid hsl(var(--foreground) / 0.1)',
      }}
    >
      <Icon className="w-3 h-3 shrink-0" strokeWidth={1.5} />
      {label}
    </button>
  );
}

// ── FollowUpCard ──────────────────────────────────────────────────────────────

function FollowUpCard({ item, onStatusChange, toast }) {
  const dueDate  = item.dueDate  || item.due_date;
  const lastVisit = item.lastVisit || item.last_visit;
  const isOverdue = item.status === 'Overdue';
  const isDone    = item.status === 'Done';

  return (
    <div
      className="rounded-xl border p-4 space-y-3 transition-all"
      style={{
        background:   isOverdue ? 'hsl(var(--background))' : 'hsl(var(--foreground) / 0.02)',
        borderColor:  isOverdue ? 'hsl(0 70% 50% / 0.3)'  : 'hsl(var(--foreground) / 0.08)',
        boxShadow:    isOverdue ? '0 0 0 1px hsl(0 70% 50% / 0.1)' : 'none',
        opacity:      isDone ? 0.6 : 1,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body font-semibold text-[13px] text-foreground">{item.client}</span>
          <StatusPill value={item.priority} />
          <StatusPill value={item.status} />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground/50 font-body">
        <span>Last visit: {lastVisit || '—'}</span>
        <span className="text-foreground/25">·</span>
        <span>{item.type}</span>
      </div>

      {/* Due date */}
      <div className="flex items-center gap-1.5">
        <Clock
          className="w-3.5 h-3.5 shrink-0"
          strokeWidth={1.5}
          style={{ color: isOverdue ? 'hsl(0 70% 55%)' : 'hsl(var(--foreground) / 0.4)' }}
        />
        <span
          className="font-body text-[11px]"
          style={{ color: isOverdue ? 'hsl(0 70% 55%)' : 'hsl(var(--foreground) / 0.5)' }}
        >
          Due {dueDate || '—'}{isOverdue ? ' — OVERDUE' : ''}
        </span>
      </div>

      {/* Notes */}
      {item.notes ? (
        <p
          className="font-body text-[11px] text-foreground/55 leading-relaxed border-l-2 pl-3"
          style={{ borderColor: 'hsl(var(--foreground) / 0.1)' }}
        >
          {item.notes}
        </p>
      ) : null}

      {/* Quick actions */}
      {!isDone && (
        <div className="flex flex-wrap gap-2 pt-1">
          <ActionBtn
            icon={MessageSquare}
            label="Text"
            onClick={() => toast({ title: `Text queued`, description: `Message to ${item.client} — coming soon.` })}
          />
          <ActionBtn
            icon={Check}
            label="Mark Done"
            onClick={() => onStatusChange(item.id, 'Done')}
            accent
          />
          <ActionBtn
            icon={PlusCircle}
            label="Add Note"
            onClick={() => toast({ title: `Note`, description: `Notes for ${item.client} — coming soon.` })}
          />
          <ActionBtn
            icon={RefreshCw}
            label="Create Rebook"
            onClick={() => toast({ title: `Rebook`, description: `Rebook flow for ${item.client} — coming soon.` })}
          />
          <ActionBtn
            icon={Star}
            label="Membership Follow-Up"
            onClick={() => toast({ title: `Membership`, description: `Follow-up flow for ${item.client} — coming soon.` })}
          />
        </div>
      )}

      {isDone && (
        <div className="flex items-center gap-1.5 pt-1">
          <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
          <span className="font-body text-[11px] text-emerald-400">Completed</span>
        </div>
      )}
    </div>
  );
}

// ── SummaryChip ───────────────────────────────────────────────────────────────

function SummaryChip({ label, value, color }) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2.5 border"
      style={{
        background:   'hsl(var(--foreground) / 0.03)',
        borderColor:  'hsl(var(--foreground) / 0.08)',
      }}
    >
      <span className="font-body text-[11px] text-foreground/50 tracking-wide">{label}</span>
      <span className={`font-body font-semibold text-[15px] ${color}`}>{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Communications() {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState('all');
  const [items, setItems] = useState(FOLLOWUPS);

  const handleStatusChange = (id, newStatus) => {
    setItems(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
  };

  const filtered = applyFilter(items, activeFilter);

  const overdueCount  = items.filter(f => f.status === 'Overdue').length;
  const dueTodayCount = items.filter(f =>
    isToday(f.dueDate || f.due_date) && f.status !== 'Done'
  ).length;
  const pendingCount  = items.filter(f => f.status === 'Pending').length;
  const doneWeekCount = items.filter(isDoneThisWeek).length;

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="mb-6 space-y-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-heading text-2xl tracking-[0.15em] text-foreground uppercase">
            Follow-Ups
          </h1>
          <span
            className="font-body text-[11px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border"
            style={{
              color:       'hsl(var(--accent))',
              borderColor: 'hsl(var(--accent) / 0.35)',
              background:  'hsl(var(--accent) / 0.08)',
            }}
          >
            {filtered.length}
          </span>
        </div>
        <p className="font-body text-[12px] text-foreground/45 tracking-wide">
          Retention &amp; Recovery Queue
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryChip label="Overdue"       value={overdueCount}  color="text-red-400" />
        <SummaryChip label="Due Today"     value={dueTodayCount} color="text-amber-400" />
        <SummaryChip label="Pending"       value={pendingCount}  color="text-foreground/70" />
        <SummaryChip label="Done This Week" value={doneWeekCount} color="text-emerald-400" />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className="px-3 py-1.5 rounded-full text-[11px] font-body font-medium transition-all"
            style={{
              background:  activeFilter === f.id ? 'hsl(var(--accent) / 0.15)' : 'hsl(var(--foreground) / 0.06)',
              color:       activeFilter === f.id ? 'hsl(var(--accent))'         : 'hsl(var(--foreground) / 0.6)',
              border:      activeFilter === f.id ? '1px solid hsl(var(--accent) / 0.4)' : '1px solid hsl(var(--foreground) / 0.1)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Card list */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{
            background:  'hsl(var(--foreground) / 0.02)',
            borderColor: 'hsl(var(--foreground) / 0.07)',
          }}
        >
          <p className="font-body text-[13px] text-foreground/40">
            No follow-ups pending in this queue. All clients are current.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <FollowUpCard
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
              toast={toast}
            />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
