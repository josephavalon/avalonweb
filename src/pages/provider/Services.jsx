import React, { useState } from 'react';
import {
  Phone, Mail, PlusCircle, Check, X,
  Building2, Calendar, DollarSign, MapPin, Gift,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { MEMBERSHIPS, LEADS } from '@/data/commandMockData';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEAD_FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'hotel',    label: 'Hotel' },
  { id: 'event',    label: 'Event' },
  { id: 'corporate',label: 'Corporate' },
  { id: 'new',      label: 'New' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'won',      label: 'Won' },
  { id: 'lost',     label: 'Lost' },
];

// ── StatusPill ────────────────────────────────────────────────────────────────

function MemberStatusPill({ value }) {
  const map = {
    'New':                  'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'Contacted':            'bg-amber-500/15 text-amber-400 border-amber-500/30',
    'Interested':           'bg-teal-500/15 text-teal-400 border-teal-500/30',
    'Active Placeholder':   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'Paused Placeholder':   'bg-foreground/10 text-foreground/50 border-foreground/20',
    'Cancelled Placeholder':'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const cls = map[value] || 'bg-foreground/10 text-foreground/50 border-foreground/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border ${cls}`}>
      {value}
    </span>
  );
}

function LeadStatusPill({ value }) {
  const map = {
    'New':              'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'Contacted':        'bg-amber-500/15 text-amber-400 border-amber-500/30',
    'Proposal Needed':  'bg-purple-500/15 text-purple-400 border-purple-500/30',
    'Follow-Up':        'bg-amber-500/15 text-amber-400 border-amber-500/30',
    'Won':              'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'Lost':             'bg-foreground/10 text-foreground/50 border-foreground/20',
  };
  const cls = map[value] || 'bg-foreground/10 text-foreground/50 border-foreground/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border ${cls}`}>
      {value}
    </span>
  );
}

function LeadTypeBadge({ type }) {
  const map = {
    Hotel:     'bg-blue-500/15 text-blue-400 border-blue-500/25',
    Event:     'bg-purple-500/15 text-purple-400 border-purple-500/25',
    Corporate: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
    Venue:     'bg-amber-500/15 text-amber-400 border-amber-500/25',
    Gift:      'bg-pink-500/15 text-pink-400 border-pink-500/25',
  };
  const cls = map[type] || 'bg-foreground/10 text-foreground/50 border-foreground/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider border uppercase ${cls}`}>
      {type}
    </span>
  );
}

// ── ActionBtn ─────────────────────────────────────────────────────────────────

function ActionBtn({ icon: Icon, label, onClick, accent, danger }) {
  let bg, color, border;
  if (accent) {
    bg = 'hsl(var(--accent) / 0.15)'; color = 'hsl(var(--accent))'; border = '1px solid hsl(var(--accent) / 0.3)';
  } else if (danger) {
    bg = 'hsl(0 70% 50% / 0.12)'; color = 'hsl(0 70% 55%)'; border = '1px solid hsl(0 70% 50% / 0.25)';
  } else {
    bg = 'hsl(var(--foreground) / 0.06)'; color = 'hsl(var(--foreground) / 0.7)'; border = '1px solid hsl(var(--foreground) / 0.1)';
  }
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-body font-medium transition-all active:scale-95"
      style={{ background: bg, color, border }}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" strokeWidth={1.5} />}
      {label}
    </button>
  );
}

// ── MemberCard ────────────────────────────────────────────────────────────────

function MemberCard({ item, onStatusChange }) {
  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        background:  'hsl(var(--foreground) / 0.02)',
        borderColor: 'hsl(var(--foreground) / 0.08)',
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body font-semibold text-[13px] text-foreground">{item.name}</span>
          <MemberStatusPill value={item.status} />
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border"
            style={{ background: 'hsl(var(--accent) / 0.08)', color: 'hsl(var(--accent))', borderColor: 'hsl(var(--accent) / 0.25)' }}
          >
            {item.plan}
          </span>
        </div>
        <span className="font-body text-[11px] text-foreground/40">
          {item.credits} credit{item.credits !== 1 ? 's' : ''} placeholder
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground/50 font-body">
        <span>Last contact: {item.lastContact || item.last_contact || '—'}</span>
        {item.nextAction && (
          <>
            <span className="text-foreground/25">·</span>
            <span>Next: {item.nextAction || item.next_action}</span>
          </>
        )}
      </div>

      {item.notes ? (
        <p className="font-body text-[11px] text-foreground/50 leading-relaxed border-l-2 pl-3"
          style={{ borderColor: 'hsl(var(--foreground) / 0.1)' }}>
          {item.notes}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <ActionBtn
          icon={Phone}
          label="Contact"
          onClick={() => alert(`Contacting ${item.name}…`)}
        />
        <ActionBtn
          icon={Check}
          label="Mark Interested"
          onClick={() => onStatusChange(item.id, 'Interested')}
          accent
        />
        <ActionBtn
          icon={Check}
          label="Mark Active Placeholder"
          onClick={() => onStatusChange(item.id, 'Active Placeholder')}
        />
        <ActionBtn
          icon={PlusCircle}
          label="Add Note"
          onClick={() => alert(`Add note for ${item.name}…`)}
        />
      </div>
    </div>
  );
}

// ── LeadCard ──────────────────────────────────────────────────────────────────

function LeadCard({ item, onStatusChange }) {
  const eventDate = item.eventDate || item.event_date;
  const estValue  = item.value || item.est_value;

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        background:  'hsl(var(--foreground) / 0.02)',
        borderColor: 'hsl(var(--foreground) / 0.08)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <LeadTypeBadge type={item.type} />
          <span className="font-body font-semibold text-[13px] text-foreground">{item.org}</span>
          <LeadStatusPill value={item.status} />
        </div>
        {estValue && (
          <span className="font-body text-[12px] font-semibold"
            style={{ color: 'hsl(var(--accent))' }}>
            ${Number(estValue).toLocaleString()}
          </span>
        )}
      </div>

      {/* Contact + meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground/50 font-body">
        <span>{item.contact}</span>
        {eventDate && eventDate !== 'Ongoing' && (
          <>
            <span className="text-foreground/25">·</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" strokeWidth={1.5} />
              {eventDate}
            </span>
          </>
        )}
        {item.source && (
          <>
            <span className="text-foreground/25">·</span>
            <span>Source: {item.source}</span>
          </>
        )}
      </div>

      {/* Next step */}
      {item.nextStep && (
        <p className="font-body text-[11px] text-foreground/55 leading-relaxed border-l-2 pl-3"
          style={{ borderColor: 'hsl(var(--accent) / 0.25)' }}>
          {item.nextStep}
        </p>
      )}

      {/* Notes */}
      {item.notes && (
        <p className="font-body text-[11px] text-foreground/40 leading-relaxed">
          {item.notes}
        </p>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <ActionBtn
          icon={Mail}
          label="Contact"
          onClick={() => alert(`Contacting ${item.org}…`)}
        />
        <ActionBtn
          icon={PlusCircle}
          label="Add Note"
          onClick={() => alert(`Add note for ${item.org}…`)}
        />
        <ActionBtn
          label="Mark Proposal Needed"
          onClick={() => onStatusChange(item.id, 'Proposal Needed')}
          accent
        />
        <ActionBtn
          icon={Check}
          label="Mark Won"
          onClick={() => onStatusChange(item.id, 'Won')}
        />
        <ActionBtn
          icon={X}
          label="Mark Lost"
          onClick={() => onStatusChange(item.id, 'Lost')}
          danger
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Services() {
  const [activeTab, setActiveTab] = useState('memberships');
  const [leadFilter, setLeadFilter] = useState('all');
  const [members, setMembers] = useState(MEMBERSHIPS);
  const [leads, setLeads] = useState(LEADS);

  const handleMemberStatusChange = (id, newStatus) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
  };

  const handleLeadStatusChange = (id, newStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
  };

  const filteredLeads = leads.filter(l => {
    if (leadFilter === 'all')      return true;
    if (leadFilter === 'hotel')    return l.type === 'Hotel';
    if (leadFilter === 'event')    return l.type === 'Event';
    if (leadFilter === 'corporate')return l.type === 'Corporate';
    if (leadFilter === 'new')      return l.status === 'New';
    if (leadFilter === 'proposal') return l.status === 'Proposal Needed';
    if (leadFilter === 'won')      return l.status === 'Won';
    if (leadFilter === 'lost')     return l.status === 'Lost';
    return true;
  });

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="mb-6 space-y-1">
        <h1 className="font-heading text-2xl tracking-[0.15em] text-foreground uppercase">
          Memberships &amp; Leads
        </h1>
        <p className="font-body text-[12px] text-foreground/45 tracking-wide">
          Manual Pipeline Tracker
        </p>
      </div>

      {/* Tab toggle */}
      <div
        className="inline-flex rounded-xl p-1 mb-6"
        style={{ background: 'hsl(var(--foreground) / 0.06)' }}
      >
        {[
          { id: 'memberships', label: 'Memberships' },
          { id: 'leads',       label: 'Leads' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-lg text-[12px] font-body font-medium transition-all"
            style={{
              background: activeTab === tab.id ? 'hsl(var(--background))' : 'transparent',
              color:      activeTab === tab.id ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.5)',
              boxShadow:  activeTab === tab.id ? '0 1px 3px hsl(var(--foreground) / 0.1)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Memberships tab */}
      {activeTab === 'memberships' && (
        <div className="space-y-3">
          {members.length === 0 ? (
            <EmptyState text="No membership records found." />
          ) : (
            members.map(m => (
              <MemberCard key={m.id} item={m} onStatusChange={handleMemberStatusChange} />
            ))
          )}
        </div>
      )}

      {/* Leads tab */}
      {activeTab === 'leads' && (
        <>
          {/* Lead filter chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            {LEAD_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setLeadFilter(f.id)}
                className="px-3 py-1.5 rounded-full text-[11px] font-body font-medium transition-all"
                style={{
                  background:  leadFilter === f.id ? 'hsl(var(--accent) / 0.15)' : 'hsl(var(--foreground) / 0.06)',
                  color:       leadFilter === f.id ? 'hsl(var(--accent))'         : 'hsl(var(--foreground) / 0.6)',
                  border:      leadFilter === f.id ? '1px solid hsl(var(--accent) / 0.4)' : '1px solid hsl(var(--foreground) / 0.1)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredLeads.length === 0 ? (
              <EmptyState text="No leads in this filter." />
            ) : (
              filteredLeads.map(l => (
                <LeadCard key={l.id} item={l} onStatusChange={handleLeadStatusChange} />
              ))
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}

function EmptyState({ text }) {
  return (
    <div
      className="rounded-xl border p-10 text-center"
      style={{
        background:  'hsl(var(--foreground) / 0.02)',
        borderColor: 'hsl(var(--foreground) / 0.07)',
      }}
    >
      <p className="font-body text-[13px] text-foreground/40">{text}</p>
    </div>
  );
}
