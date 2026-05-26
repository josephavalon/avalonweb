import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  LockKeyhole,
  MapPin,
  MessageSquare,
  RefreshCw,
  Shield,
  ShieldAlert,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import PageShell from '@/components/admin/PageShell';
import { APPOINTMENTS, CLIENTS, SERVICES, STAFF } from '@/fixtures/adminMockData';
import { NURSES, REQUESTS } from '@/fixtures/commandMockData';
import {
  buildCredentialControlTower,
  queueNurseysCredentialCheck,
  resolveNurseysCredentialCheck,
  runCredentialControlSweep,
  setNurseCredentialOverride,
} from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

function toneClass(tone) {
  if (tone === 'critical') return 'border-red-400/25 bg-red-500/[0.055] text-red-300';
  if (tone === 'action') return 'border-amber-300/25 bg-amber-300/[0.055] text-amber-200';
  if (tone === 'ready') return 'border-emerald-300/20 bg-emerald-300/[0.045] text-emerald-200';
  return 'border-foreground/10 bg-foreground/[0.035] text-foreground/65';
}

function shortDate(value) {
  if (!value) return 'Missing';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Missing';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Metric({ label, value, detail, icon: Icon, tone = 'default' }) {
  return (
    <div className={`av-glass rounded-xl p-4 ${toneClass(tone)}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] opacity-65">{label}</p>
        <Icon className="h-4 w-4 shrink-0 opacity-55" strokeWidth={1.6} />
      </div>
      <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">{value}</p>
      <p className="mt-1 font-body text-[11px] leading-snug text-foreground/44">{detail}</p>
    </div>
  );
}

function StageStrip({ stages }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background/58 p-3 shadow-[0_18px_70px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl">
      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {stages.map((stage) => (
          <div key={stage.key} className="rounded-lg border border-foreground/8 bg-foreground/[0.03] p-3">
            <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/46">{stage.label}</p>
            <p className="mt-3 font-heading text-3xl uppercase leading-none text-foreground">{stage.count}</p>
            <p className="mt-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/32">{stage.owner}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NurseCard({ nurse, onQueue, onClear, onHold }) {
  const risk = nurse.clear ? 'ready' : nurse.status === 'Expiring Soon' || nurse.expiring ? 'action' : 'critical';
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(risk)}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {nurse.status}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {nurse.state}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {nurse.queueStatus}
            </span>
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{nurse.name}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {nurse.role} · {nurse.area} · expires {shortDate(nurse.expiresAt)}
          </p>
        </div>
        <div className="text-left lg:text-right">
          <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">
            {nurse.clear ? 'CLEAR' : 'HOLD'}
          </p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.16em] text-foreground/38">
            {nurse.sourceLabel}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Kit</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{nurse.kitStatus}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Duty</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{nurse.dutyStatus}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Reason</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{nurse.reasons[0] || 'Ready'}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!nurse.clear && (
          <button
            type="button"
            onClick={() => onQueue(nurse)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            Check
          </button>
        )}
        <button
          type="button"
          onClick={() => onClear(nurse)}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
        >
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          Clear
        </button>
        <button
          type="button"
          onClick={() => onHold(nurse)}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58 transition-colors hover:text-foreground"
        >
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
          Hold
        </button>
      </div>
    </motion.article>
  );
}

function ShiftCard({ shift, onQueue }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(shift.risk)}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {shift.coverageStatus}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {shift.status}
            </span>
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{shift.client}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">{shift.service} · {shift.city}</p>
        </div>
        <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">
          {shift.eligible.length || 0}
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-foreground/8 bg-background/38 p-3">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/35" strokeWidth={1.6} />
          <p className="font-body text-[11px] leading-snug text-foreground/48">{shift.location}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Eligible</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">
            {shift.eligible.map((nurse) => nurse.name).join(', ') || 'None'}
          </p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Blocked</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">
            {shift.blocked.length ? `${shift.blocked.length} held` : 'None'}
          </p>
        </div>
      </div>

      {!shift.eligible.length && (
        <button
          type="button"
          onClick={() => onQueue(shift)}
          className="mt-4 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          Queue Gate
        </button>
      )}
    </motion.article>
  );
}

function QueueCard({ item, onResolve }) {
  return (
    <article className={`rounded-xl border p-4 ${toneClass(item.status === 'Clear' ? 'ready' : 'action')}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
            {item.status}
          </span>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{item.name}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">{item.reason}</p>
        </div>
        <Shield className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
      {item.status !== 'Clear' && (
        <button
          type="button"
          onClick={() => onResolve(item)}
          className="mt-4 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
        >
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          Mark Clear
        </button>
      )}
    </article>
  );
}

function RulesPanel({ tower }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/46">
          <LockKeyhole className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
        </div>
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Gate</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Hard Blocks</h2>
        </div>
      </div>
      <div className="space-y-2">
        {tower.hardBlocks.map((item) => (
          <div key={item.label} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">{item.label}</p>
            <p className="mt-1 font-body text-[11px] leading-snug text-foreground/40">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractPanel({ tower }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Placeholder</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Nurseys</h2>
        </div>
        <Shield className="h-4 w-4 text-foreground/35" strokeWidth={1.6} />
      </div>
      <p className="font-body text-[12px] leading-relaxed text-foreground/44">{tower.contract.description}</p>
      <div className="mt-3 space-y-2">
        {tower.contract.capabilities.map((item) => (
          <p key={item} className="rounded-lg border border-foreground/8 bg-background/38 p-3 font-body text-[10px] leading-relaxed text-foreground/42">
            {item}
          </p>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-foreground/8 bg-background/38 p-3">
        {tower.scopeRules.map((item) => (
          <p key={item} className="font-body text-[10px] leading-relaxed text-foreground/42">{item}</p>
        ))}
      </div>
    </div>
  );
}

export default function CredentialControl() {
  const [tower, setTower] = useState(() => buildCredentialControlTower({
    nurses: NURSES,
    staff: STAFF,
    requests: REQUESTS,
    appointments: APPOINTMENTS,
    clients: CLIENTS,
    services: SERVICES,
  }));
  const [note, setNote] = useState('');
  const [view, setView] = useState('nurses');

  const refresh = () => setTower(buildCredentialControlTower({
    nurses: NURSES,
    staff: STAFF,
    requests: REQUESTS,
    appointments: APPOINTMENTS,
    clients: CLIENTS,
    services: SERVICES,
  }));

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('av.local.change', onChange);
    return () => window.removeEventListener('av.local.change', onChange);
  }, []);

  const workNurses = useMemo(() => (
    [...tower.roster].sort((a, b) => Number(a.clear) - Number(b.clear) || a.name.localeCompare(b.name))
  ), [tower.roster]);

  const openShifts = useMemo(() => (
    tower.shifts.filter((item) => item.needsNurse || !item.eligible.length).slice(0, 16)
  ), [tower.shifts]);

  const handleSweep = () => {
    const result = runCredentialControlSweep({
      nurses: NURSES,
      staff: STAFF,
      requests: REQUESTS,
      appointments: APPOINTMENTS,
      clients: CLIENTS,
      services: SERVICES,
    });
    setTower(result.tower);
    setNote(`Sweep queued ${result.actions.length}`);
  };

  const handleQueue = (nurse) => {
    const entry = queueNurseysCredentialCheck(nurse, {
      reason: nurse.reasons?.join(', ') || 'Manual credential refresh.',
    });
    setNote(`Nurseys queued: ${entry.name}`);
    refresh();
  };

  const handleQueueShift = (shift) => {
    shift.blocked.slice(0, 3).forEach((nurse) => {
      queueNurseysCredentialCheck(nurse, {
        reason: `Needed for ${shift.client}: ${nurse.reasons.join(', ') || 'credential gate'}`,
      });
    });
    setNote(`Gate queued: ${shift.client}`);
    refresh();
  };

  const handleClear = (nurse) => {
    setNurseCredentialOverride(nurse.id, {
      name: nurse.name,
      status: 'Clear',
      state: 'CA',
      expiresAt: '2027-05-23',
      note: 'Manual clear for local demo until Nurseys API is connected.',
    });
    setNote(`Cleared: ${nurse.name}`);
    refresh();
  };

  const handleHold = (nurse) => {
    setNurseCredentialOverride(nurse.id, {
      name: nurse.name,
      status: 'Review',
      state: nurse.state || 'CA',
      expiresAt: '',
      note: 'Manual hold.',
    });
    setNote(`Held: ${nurse.name}`);
    refresh();
  };

  const handleResolve = (item) => {
    resolveNurseysCredentialCheck(item.id, 'Clear', 'Credential Control');
    setNote(`Nurseys clear: ${item.name}`);
    refresh();
  };

  return (
    <AdminLayout>
      <PageShell
        eyebrow="Nurseys · scope · shift gate"
        title="Credential Control"
        subtitle="Only clear nurses can claim shifts."
        action={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSweep}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
              Sweep
            </button>
            <Link
              to="/provider/staff"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/64 transition-colors hover:text-foreground"
            >
              <UserCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Nurses
            </Link>
          </div>
        )}
      >
        <div className="space-y-5">
          {note && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-4 py-2 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/52"
            >
              {note}
            </motion.div>
          )}

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric label="Roster" value={tower.metrics.roster} detail="known nurses" icon={Stethoscope} />
            <Metric label="Clear" value={tower.metrics.clear} detail="can claim" icon={CheckCircle2} tone="ready" />
            <Metric label="Blocked" value={tower.metrics.blocked} detail="hold until clear" icon={ShieldAlert} tone={tower.metrics.blocked ? 'critical' : 'ready'} />
            <Metric label="Expiring" value={tower.metrics.expiring} detail="renew soon" icon={AlertTriangle} tone={tower.metrics.expiring ? 'action' : 'ready'} />
            <Metric label="Open" value={tower.metrics.openShifts} detail="shift demand" icon={ClipboardCheck} tone={tower.metrics.openShifts ? 'action' : 'ready'} />
            <Metric label="Uncovered" value={tower.metrics.uncovered} detail="no eligible RN" icon={Shield} tone={tower.metrics.uncovered ? 'critical' : 'ready'} />
          </div>

          <StageStrip stages={tower.stageSummaries} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">Work Queue</p>
                  <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
                    {view === 'nurses' ? 'Nurses' : view === 'shifts' ? 'Shifts' : 'Checks'}
                  </h2>
                </div>
                <div className="flex rounded-full border border-foreground/10 bg-background/46 p-1">
                  {[
                    ['nurses', 'Nurses'],
                    ['shifts', 'Shifts'],
                    ['checks', 'Checks'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setView(key)}
                      className={`min-h-[34px] rounded-full px-3 font-body text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                        view === key ? 'bg-foreground text-background' : 'text-foreground/45 hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {view === 'nurses' && (
                <div className="space-y-3">
                  {workNurses.map((nurse) => (
                    <NurseCard
                      key={nurse.id}
                      nurse={nurse}
                      onQueue={handleQueue}
                      onClear={handleClear}
                      onHold={handleHold}
                    />
                  ))}
                </div>
              )}

              {view === 'shifts' && (
                <div className="space-y-3">
                  {openShifts.map((shift) => (
                    <ShiftCard key={shift.id} shift={shift} onQueue={handleQueueShift} />
                  ))}
                </div>
              )}

              {view === 'checks' && (
                <div className="space-y-3">
                  {tower.queue.length ? tower.queue.map((item) => (
                    <QueueCard key={item.id} item={item} onResolve={handleResolve} />
                  )) : (
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-8 text-center">
                      <p className="font-heading text-3xl uppercase tracking-tight text-foreground">No Checks</p>
                      <p className="mt-1 font-body text-[12px] text-foreground/42">Run sweep when the roster changes.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <RulesPanel tower={tower} />
              <ContractPanel tower={tower} />
              <Link
                to="/provider/communications"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Comms <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
              <Link
                to="/provider/acuity"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Acuity <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </aside>
          </div>
        </div>
      </PageShell>
    </AdminLayout>
  );
}
