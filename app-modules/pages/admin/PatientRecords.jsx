/**
 * Patient Records — /admin/clients
 *
 * A master list of patients/clients derived from the real bookings feed
 * (/api/admin/bookings). Each unique customer (keyed by email, then phone,
 * then name) is rolled up with their visit count, contact details, deposits
 * collected, outstanding balance, and last visit. Expand a card to see that
 * patient's individual visits. No separate backend — this is a real view over
 * the live appointments data (the bookings list is the source of truth).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Phone, Mail, Calendar, AlertCircle, ChevronDown, Users, ArrowUpRight } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet } from '@/lib/apiClient';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';

function money(value) {
  if (!value) return '$0';
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtWhen(iso) {
  if (!iso) return 'Date to be confirmed';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date to be confirmed';
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function buildPatients(bookings) {
  const groups = new Map();
  for (const b of bookings) {
    const key = String(b.customerEmail || b.customerPhone || b.customerName || b.id).trim().toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: b.customerName && b.customerName !== '—' ? b.customerName : (b.customerEmail || 'Unknown client'),
        email: b.customerEmail || '',
        phone: b.customerPhone || '',
        visits: [],
        deposits: 0,
        balanceDue: 0,
        lastVisit: null,
      });
    }
    const g = groups.get(key);
    // Prefer a real name / contact detail if a later row has one.
    if ((!g.name || g.name === g.email) && b.customerName && b.customerName !== '—') g.name = b.customerName;
    if (!g.email && b.customerEmail) g.email = b.customerEmail;
    if (!g.phone && b.customerPhone) g.phone = b.customerPhone;
    g.visits.push(b);
    g.deposits += b.depositAmount || 0;
    if (b.balanceDue > 0 && b.paymentStatus !== 'paid_in_full') g.balanceDue += b.balanceDue;
    if (b.startsAt && (!g.lastVisit || new Date(b.startsAt) > new Date(g.lastVisit))) g.lastVisit = b.startsAt;
  }
  return Array.from(groups.values()).sort((a, b) => {
    const at = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
    const bt = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
    return bt - at;
  });
}

function PatientCard({ patient }) {
  const [open, setOpen] = useState(false);
  // Detail page accepts either a profile id or an email — the bookings-derived
  // rollup only has the email, so we route by that. /api/admin/clients/[id]
  // falls back to email lookup.
  const detailKey = patient.email || patient.key;
  return (
    <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex w-full items-start justify-between gap-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading text-xl uppercase leading-none">{patient.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs" style={{ color: DIM }}>
              {patient.email ? <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" strokeWidth={1.7} />{patient.email}</span> : null}
              {patient.phone ? <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" strokeWidth={1.7} />{patient.phone}</span> : null}
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" strokeWidth={1.7} />Last visit {fmtDate(patient.lastVisit)}</span>
            </div>
          </div>
          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} style={{ color: DIM }} />
        </button>
        {detailKey ? (
          <Link
            to={`/admin/clients/${encodeURIComponent(detailKey)}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ background: CARD_STRONG, color: 'hsl(var(--foreground))', border: `1px solid ${BORDER}` }}
          >
            Open <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-3" style={{ borderColor: BORDER }}>
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Visits</p>
          <p className="mt-1 font-body text-sm font-semibold">{patient.visits.length}</p>
        </div>
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Deposits Collected</p>
          <p className="mt-1 font-body text-sm font-semibold">{money(patient.deposits)}</p>
        </div>
        <div>
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Balance Due</p>
          <p className="mt-1 font-body text-sm font-semibold" style={{ color: patient.balanceDue > 0 ? 'hsl(38 92% 72%)' : undefined }}>{money(patient.balanceDue)}</p>
        </div>
      </div>

      {open ? (
        <div className="mt-3 grid gap-2 border-t pt-3" style={{ borderColor: BORDER }}>
          {patient.visits.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <span className="font-body text-xs font-semibold">{v.service}</span>
              <span className="font-body text-xs" style={{ color: DIM }}>{fmtWhen(v.startsAt)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PatientRecords() {
  const [state, setState] = useState({ loading: true, error: '', bookings: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await apiGet('/api/admin/bookings');
      setState({ loading: false, error: '', bookings: Array.isArray(data?.bookings) ? data.bookings : [] });
    } catch (err) {
      setState({ loading: false, error: 'Could not load patient records.', bookings: [] });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { loading, error, bookings } = state;
  const patients = useMemo(() => buildPatients(bookings), [bookings]);

  return (
    <AdminShell title="Patients">
      <div className="min-h-dvh font-body" style={{ background: BG, color: TEXT }}>
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
          <div className="flex items-end justify-between gap-3">
            <p className="font-body text-sm" style={{ color: MUTED }}>
              {loading ? 'Loading…' : `${patients.length} patient${patients.length === 1 ? '' : 's'} · ${bookings.length} visit${bookings.length === 1 ? '' : 's'} on record`}
            </p>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-opacity disabled:opacity-50"
              style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: 'hsl(0 70% 62%)' }}>
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="font-body text-sm">{error}</span>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            {!loading && patients.length === 0 && !error ? (
              <div className="rounded-2xl px-4 py-10 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <Users className="mx-auto mb-3 h-6 w-6" strokeWidth={1.5} style={{ color: DIM }} />
                <p className="font-body text-sm" style={{ color: MUTED }}>No patients yet. New bookings will populate this list automatically.</p>
              </div>
            ) : null}
            {patients.map((patient) => <PatientCard key={patient.key} patient={patient} />)}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
