import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Plus, ChevronRight, Check, Clock,
  MapPin, Phone, Mail, Tag, Calendar, DollarSign,
  User, Activity, FileText, Edit2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { CLIENTS, APPOINTMENTS, INVOICES, getClientName } from '@/data/adminMockData';

// ─── Constants ────────────────────────────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1];

const TAG_STYLES = {
  vip:       { bg: 'rgba(201,168,76,0.15)',  color: '#c9a84c',  label: 'VIP' },
  recurring: { bg: 'rgba(100,160,255,0.12)', color: '#64a0ff',  label: 'Recurring' },
  athlete:   { bg: 'rgba(160,100,255,0.12)', color: '#a064ff',  label: 'Athlete' },
  corporate: { bg: 'rgba(0,200,180,0.12)',   color: '#00c8b4',  label: 'Corporate' },
};

const AVATAR_COLORS = [
  '#c9a84c', '#64a0ff', '#a064ff', '#00c8b4',
  '#ff6464', '#64dc82', '#ff9f43', '#54a0ff',
];

const TAG_FILTERS = ['All', 'VIP', 'Recurring', 'Athlete', 'Corporate'];

const SOURCES = ['website', 'referral', 'instagram', 'google', 'yelp', 'corporate', 'other'];

function avatarColor(name) {
  const code = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[code];
}

function TagPill({ tag }) {
  const s = TAG_STYLES[tag] || { bg: 'rgba(255,255,255,0.08)', color: '#ffffff', label: tag };
  return (
    <span
      className="text-[10px] tracking-[0.12em] uppercase font-medium px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function IntakeBadge({ completed }) {
  return completed ? (
    <span className="flex items-center gap-1 text-[10px] tracking-[0.12em] uppercase font-medium px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(100,220,130,0.12)', color: '#64dc82' }}>
      <Check className="w-2.5 h-2.5" strokeWidth={2.5} /> Complete
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[10px] tracking-[0.12em] uppercase font-medium px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c' }}>
      <Clock className="w-2.5 h-2.5" strokeWidth={2.5} /> Pending
    </span>
  );
}

function Avatar({ first, last, size = 36 }) {
  const initials = `${first[0]}${last[0]}`.toUpperCase();
  const color = avatarColor(first);
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-medium"
      style={{ width: size, height: size, background: color + '22', color, border: `1px solid ${color}44`, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n) {
  return '$' + Number(n).toLocaleString('en-US');
}

// ─── Add Client Modal ──────────────────────────────────────────────────────────
function AddClientModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    city: '', source: 'website', tags: [],
  });
  const [errors, setErrors] = useState({});

  function toggle(tag) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  }

  function validate() {
    const e = {};
    if (!form.first_name.trim()) e.first_name = 'Required';
    if (!form.last_name.trim()) e.last_name = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    return e;
  }

  function submit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onAdd({
      ...form,
      id: 'c' + Date.now(),
      zip: '',
      intake_completed: false,
      is_active: true,
      total_spent: 0,
      visit_count: 0,
      last_visit: null,
      created_at: new Date().toISOString().slice(0, 10),
    });
    onClose();
  }

  const inputStyle = {
    background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#ffffff',
    padding: '10px 12px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
  };

  const labelStyle = { fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#ffffff', marginBottom: 6, display: 'block' };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium" style={{ color: '#c9a84c' }}>Clients</p>
            <h2 className="font-heading text-xl text-white tracking-wider">ADD NEW CLIENT</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>First Name</label>
              <input
                style={{ ...inputStyle, borderColor: errors.first_name ? '#ff5050' : 'rgba(255,255,255,0.1)' }}
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="Alex"
              />
              {errors.first_name && <p className="text-[11px] text-red-400 mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                style={{ ...inputStyle, borderColor: errors.last_name ? '#ff5050' : 'rgba(255,255,255,0.1)' }}
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Chen"
              />
              {errors.last_name && <p className="text-[11px] text-red-400 mt-1">{errors.last_name}</p>}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              style={{ ...inputStyle, borderColor: errors.email ? '#ff5050' : 'rgba(255,255,255,0.1)' }}
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="client@email.com"
            />
            {errors.email && <p className="text-[11px] text-red-400 mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                style={inputStyle}
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(415) 555-0000"
              />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input
                style={inputStyle}
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="San Francisco"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Source</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
            >
              {SOURCES.map(s => <option key={s} value={s} style={{ background: '#1a1a1a' }}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Tags</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TAG_STYLES).map(([key, s]) => {
                const active = form.tags.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    className="text-[10px] tracking-[0.12em] uppercase font-medium px-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: active ? s.bg : 'rgba(255,255,255,0.05)',
                      color: active ? s.color : '#ffffff',
                      border: `1px solid ${active ? s.color + '44' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: '#c9a84c', color: '#0A0A0A' }}
            >
              Add Client
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Client Drawer ─────────────────────────────────────────────────────────────
function ClientDrawer({ client, onClose, onToggleActive, onMarkIntakeComplete }) {
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(false);

  const appts = APPOINTMENTS
    .filter(a => a.client_id === client.id)
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
    .slice(0, 3);

  const invoices = INVOICES
    .filter(i => i.client_id === client.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  const INVOICE_STATUS_STYLE = {
    paid:    { bg: 'rgba(100,220,130,0.12)', color: '#64dc82' },
    draft:   { bg: 'rgba(255,255,255,0.06)', color: '#ffffff' },
    sent:    { bg: 'rgba(100,160,255,0.12)', color: '#64a0ff' },
    overdue: { bg: 'rgba(255,80,80,0.12)',   color: '#ff5050' },
  };

  const APPT_STATUS_STYLE = {
    scheduled:   { color: '#64a0ff' },
    confirmed:   { color: '#64dc82' },
    completed:   { color: '#64dc82' },
    cancelled:   { color: '#ff5050' },
    in_progress: { color: '#c9a84c' },
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{ width: 420, background: '#0f0f0f', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium" style={{ color: '#c9a84c' }}>Client Profile</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(e => !e)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5 text-white" />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Identity */}
          <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3 mb-4">
              <Avatar first={client.first_name} last={client.last_name} size={52} />
              <div>
                <h3 className="font-heading text-2xl text-white tracking-wider">{client.first_name.toUpperCase()} {client.last_name.toUpperCase()}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-white capitalize">{client.source}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                  <span className="text-xs text-white">Since {formatDate(client.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#c9a84c' }} />
                <span className="text-sm text-white">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#c9a84c' }} />
                  <span className="text-sm text-white">{client.phone}</span>
                </div>
              )}
              {client.city && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#c9a84c' }} />
                  <span className="text-sm text-white">{client.city}{client.zip ? ` ${client.zip}` : ''}</span>
                </div>
              )}
            </div>

            {client.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {client.tags.map(t => <TagPill key={t} tag={t} />)}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Visits', value: client.visit_count, icon: Activity },
              { label: 'Total Spent', value: formatCurrency(client.total_spent), icon: DollarSign },
              { label: 'Last Visit', value: client.last_visit ? new Date(client.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—', icon: Calendar },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="px-4 py-4 text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <Icon className="w-3.5 h-3.5 mx-auto mb-1.5" style={{ color: '#c9a84c' }} />
                <p className="text-lg font-light text-white">{value}</p>
                <p className="text-[10px] tracking-[0.15em] uppercase text-white mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Active toggle */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-sm font-medium text-white">Account Active</span>
            <button onClick={() => onToggleActive(client.id)} className="transition-opacity hover:opacity-80">
              {client.is_active
                ? <ToggleRight className="w-7 h-7" style={{ color: '#64dc82' }} />
                : <ToggleLeft className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.3)' }} />
              }
            </button>
          </div>

          {/* Intake */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase font-medium" style={{ color: '#c9a84c' }}>Intake Form</p>
              <div className="mt-1"><IntakeBadge completed={client.intake_completed} /></div>
            </div>
            {!client.intake_completed && (
              <button
                onClick={() => onMarkIntakeComplete(client.id)}
                className="text-[11px] tracking-[0.12em] uppercase font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)' }}
              >
                Mark Complete
              </button>
            )}
          </div>

          {/* Recent Appointments */}
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium mb-3 text-white">
              <Calendar className="w-3 h-3 inline mr-1.5" style={{ color: '#c9a84c' }} />
              Recent Appointments
            </p>
            {appts.length === 0 ? (
              <p className="text-sm text-white">No appointments yet.</p>
            ) : (
              <div className="space-y-2">
                {appts.map(a => {
                  const sc = APPT_STATUS_STYLE[a.status] || { color: '#ffffff' };
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <p className="text-xs font-medium text-white">{new Date(a.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        <p className="text-[11px] text-white mt-0.5">{a.location_city}</p>
                      </div>
                      <span className="text-[10px] tracking-[0.1em] uppercase font-medium px-2 py-0.5 rounded-full"
                        style={{ background: sc.color + '18', color: sc.color }}>
                        {a.status.replace('_', ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Invoices */}
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium mb-3 text-white">
              <FileText className="w-3 h-3 inline mr-1.5" style={{ color: '#c9a84c' }} />
              Recent Invoices
            </p>
            {invoices.length === 0 ? (
              <p className="text-sm text-white">No invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => {
                  const is = INVOICE_STATUS_STYLE[inv.status] || INVOICE_STATUS_STYLE.draft;
                  return (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <p className="text-xs font-medium text-white">{inv.invoice_number}</p>
                        <p className="text-[11px] text-white mt-0.5">{formatDate(inv.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-white">{formatCurrency(inv.total)}</p>
                        <span className="text-[10px] tracking-[0.1em] uppercase font-medium px-2 py-0.5 rounded-full mt-0.5 inline-block"
                          style={{ background: is.bg, color: is.color }}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="px-5 py-4">
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium mb-3 text-white">Notes</p>
            <textarea
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                minHeight: 100,
              }}
              placeholder="Internal notes about this client..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Clients() {
  const [clients, setClients] = useState(CLIENTS);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedClient, setSelectedClient] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Derived list
  const filtered = useMemo(() => {
    return clients.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q);
      const matchTag = tagFilter === 'All' || c.tags.includes(tagFilter.toLowerCase());
      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && c.is_active) ||
        (statusFilter === 'Inactive' && !c.is_active);
      return matchSearch && matchTag && matchStatus;
    });
  }, [clients, search, tagFilter, statusFilter]);

  function handleAdd(newClient) {
    setClients(prev => [newClient, ...prev]);
  }

  function handleToggleActive(id) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c));
    if (selectedClient?.id === id) {
      setSelectedClient(c => ({ ...c, is_active: !c.is_active }));
    }
  }

  function handleMarkIntakeComplete(id) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, intake_completed: true } : c));
    if (selectedClient?.id === id) {
      setSelectedClient(c => ({ ...c, intake_completed: true }));
    }
  }

  const inputStyle = {
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 14,
    outline: 'none',
  };

  return (
    <AdminLayout>
      <div className="min-h-screen p-6 lg:p-8" style={{ background: '#0A0A0A' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-8"
        >
          <p className="text-[11px] tracking-[0.3em] uppercase font-medium mb-1" style={{ color: '#c9a84c' }}>Clients</p>
          <div className="flex items-center gap-4">
            <h1 className="font-heading text-4xl text-white tracking-wider">CLIENT ROSTER</h1>
            <span className="text-sm font-medium px-3 py-1 rounded-full text-white" style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.25)' }}>
              {clients.length} total
            </span>
          </div>
        </motion.div>

        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: EASE }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <input
              style={{ ...inputStyle, paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, width: '100%' }}
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
              </button>
            )}
          </div>

          {/* Tag filter */}
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
            {TAG_FILTERS.map(t => (
              <button
                key={t}
                onClick={() => setTagFilter(t)}
                className="text-[11px] tracking-[0.12em] uppercase font-medium px-3 py-1.5 rounded-md transition-all"
                style={{
                  background: tagFilter === t ? '#c9a84c' : 'transparent',
                  color: tagFilter === t ? '#0A0A0A' : '#ffffff',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
            {['All', 'Active', 'Inactive'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="text-[11px] tracking-[0.12em] uppercase font-medium px-3 py-1.5 rounded-md transition-all"
                style={{
                  background: statusFilter === s ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: '#ffffff',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Add Client */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: '#c9a84c', color: '#0A0A0A' }}
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: EASE }}
          className="rounded-xl overflow-hidden"
          style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Table head */}
          <div className="hidden lg:grid grid-cols-[2fr_1fr_1.2fr_0.8fr_0.8fr_0.8fr_1fr_0.7fr] px-5 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Client', 'City', 'Tags', 'Visits', 'Spent', 'Last Visit', 'Intake', 'Active'].map(h => (
              <p key={h} className="text-[10px] tracking-[0.2em] uppercase font-medium text-white">{h}</p>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <User className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <p className="text-sm text-white">No clients match your filters.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((client, i) => (
                <motion.div
                  key={client.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.3, delay: i * 0.03, ease: EASE }}
                  onClick={() => setSelectedClient(client)}
                  className="group cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {/* Desktop row */}
                  <div className="hidden lg:grid grid-cols-[2fr_1fr_1.2fr_0.8fr_0.8fr_0.8fr_1fr_0.7fr] items-center px-5 py-4">
                    {/* Client */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar first={client.first_name} last={client.last_name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{client.first_name} {client.last_name}</p>
                        <p className="text-xs text-white truncate">{client.email}</p>
                      </div>
                    </div>

                    {/* City */}
                    <p className="text-sm text-white truncate">{client.city || '—'}</p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {client.tags.length > 0
                        ? client.tags.map(t => <TagPill key={t} tag={t} />)
                        : <span className="text-xs text-white">—</span>
                      }
                    </div>

                    {/* Visits */}
                    <p className="text-sm text-white">{client.visit_count}</p>

                    {/* Spent */}
                    <p className="text-sm text-white">{formatCurrency(client.total_spent)}</p>

                    {/* Last visit */}
                    <p className="text-sm text-white">{client.last_visit ? new Date(client.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</p>

                    {/* Intake */}
                    <IntakeBadge completed={client.intake_completed} />

                    {/* Active toggle */}
                    <button
                      onClick={e => { e.stopPropagation(); handleToggleActive(client.id); }}
                      className="transition-opacity hover:opacity-80"
                    >
                      {client.is_active
                        ? <ToggleRight className="w-6 h-6" style={{ color: '#64dc82' }} />
                        : <ToggleLeft className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.25)' }} />
                      }
                    </button>
                  </div>

                  {/* Mobile row */}
                  <div className="lg:hidden flex items-center gap-3 px-4 py-4">
                    <Avatar first={client.first_name} last={client.last_name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{client.first_name} {client.last_name}</p>
                      <p className="text-xs text-white truncate">{client.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {client.tags.map(t => <TagPill key={t} tag={t} />)}
                        <IntakeBadge completed={client.intake_completed} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-white">{formatCurrency(client.total_spent)}</p>
                      <p className="text-xs text-white">{client.visit_count} visits</p>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Footer count */}
          {filtered.length > 0 && (
            <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-white">Showing {filtered.length} of {clients.length} clients</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedClient && (
          <ClientDrawer
            key={selectedClient.id}
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
            onToggleActive={handleToggleActive}
            onMarkIntakeComplete={handleMarkIntakeComplete}
          />
        )}
      </AnimatePresence>

      {/* Add Client Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddClientModal
            onClose={() => setShowAddModal(false)}
            onAdd={handleAdd}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
