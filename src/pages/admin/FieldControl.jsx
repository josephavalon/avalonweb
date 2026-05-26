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
  Navigation,
  Play,
  RefreshCw,
  Route,
  Send,
  ShieldAlert,
  Square,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import PageShell from '@/components/admin/PageShell';
import { APPOINTMENTS, CLIENTS, SERVICES, STAFF } from '@/fixtures/adminMockData';
import { REQUESTS } from '@/fixtures/commandMockData';
import {
  buildFieldVisitControlTower,
  completeFieldVisit,
  queueFieldVisitText,
  runFieldVisitControlSweep,
  setFieldVisitStatus,
} from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

function toneClass(tone) {
  if (tone === 'critical') return 'border-red-400/25 bg-red-500/[0.055] text-red-300';
  if (tone === 'action') return 'border-amber-300/25 bg-amber-300/[0.055] text-amber-200';
  if (tone === 'ready') return 'border-emerald-300/20 bg-emerald-300/[0.045] text-emerald-200';
  return 'border-foreground/10 bg-foreground/[0.035] text-foreground/65';
}

function money(value = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
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

function StatusChip({ children, tone = 'default' }) {
  return (
    <span className={`inline-flex min-h-[26px] items-center rounded-full border px-2.5 font-body text-[9px] font-semibold uppercase tracking-[0.13em] ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

function VisitCard({ visit, onText, onStatus, onComplete }) {
  const canStart = /arrived|assigned|en route/i.test(visit.status);
  const canArrive = /assigned|en route/i.test(visit.status);
  const canComplete = !visit.closeoutDone;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(visit.risk)}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusChip tone={visit.closeoutDone ? 'ready' : visit.incidentFlagged ? 'critical' : 'action'}>{visit.status}</StatusChip>
            <StatusChip>{visit.city}</StatusChip>
            <StatusChip>{money(visit.shiftValue)}</StatusChip>
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{visit.client}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {visit.service} · {visit.nurseName} · {[visit.date, visit.time].filter(Boolean).join(' · ')}
          </p>
        </div>
        <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">
          {visit.closeoutDone ? 'DONE' : 'LIVE'}
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-foreground/8 bg-background/38 p-3">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/35" strokeWidth={1.6} />
          <p className="font-body text-[11px] leading-snug text-foreground/48">{visit.address}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Texts</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{visit.textProof.length}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Closeout</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{visit.closeoutDone ? 'Acuity proof' : 'Needed'}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Next</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{visit.nextAction}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onText(visit, 'eta')}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          ETA
        </button>
        {canArrive && (
          <button
            type="button"
            onClick={() => onStatus(visit, 'Arrived', 'arrival')}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Arrived
          </button>
        )}
        {canStart && (
          <button
            type="button"
            onClick={() => onStatus(visit, 'In Progress', 'start')}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58 transition-colors hover:text-foreground"
          >
            <Play className="h-3.5 w-3.5" strokeWidth={2} />
            Start
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            onClick={() => onComplete(visit)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
          >
            <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Closeout
          </button>
        )}
        <a
          href={visit.maps.apple}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58 transition-colors hover:text-foreground"
        >
          <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
          Apple
        </a>
        <a
          href={visit.maps.google}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58 transition-colors hover:text-foreground"
        >
          <Route className="h-3.5 w-3.5" strokeWidth={2} />
          Google
        </a>
      </div>
    </motion.article>
  );
}

function CloseoutCard({ visit }) {
  return (
    <article className={`rounded-xl border p-4 ${toneClass(visit.closeoutDone ? 'ready' : 'action')}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip tone={visit.closeoutDone ? 'ready' : 'action'}>{visit.closeoutDone ? 'Complete' : 'Needed'}</StatusChip>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{visit.client}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">{visit.service} · {visit.nurseName}</p>
        </div>
        <ClipboardCheck className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="mt-3 rounded-lg border border-foreground/8 bg-background/38 p-3">
        <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">Acuity Status</p>
        <p className="mt-1 font-body text-[11px] leading-snug text-foreground/40">
          {visit.closeout?.acuityStatus || 'Closeout proof not present.'}
        </p>
      </div>
    </article>
  );
}

function IncidentCard({ item }) {
  return (
    <article className="rounded-xl border border-red-400/25 bg-red-500/[0.055] p-4 text-red-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip tone="critical">{item.status || 'Review'}</StatusChip>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{item.clientName}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">{item.service}</p>
        </div>
        <ShieldAlert className="h-5 w-5 text-red-200/70" strokeWidth={1.6} />
      </div>
      <p className="mt-3 rounded-lg border border-red-300/12 bg-background/38 p-3 font-body text-[11px] leading-relaxed text-foreground/46">
        {item.summary || 'Clinical/admin review required.'}
      </p>
    </article>
  );
}

function Guardrails({ tower }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/46">
          <LockKeyhole className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
        </div>
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Rules</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Field Gate</h2>
        </div>
      </div>
      <div className="space-y-2">
        {tower.guardrails.map((item) => (
          <div key={item.label} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">{item.label}</p>
            <p className="mt-1 font-body text-[11px] leading-snug text-foreground/40">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofPanel({ tower }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Proof</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Local Only</h2>
        </div>
        <Square className="h-4 w-4 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="space-y-2">
        <p className="rounded-lg border border-foreground/8 bg-background/38 p-3 font-body text-[10px] leading-relaxed text-foreground/42">
          Texts queued: {tower.textMessages.length}
        </p>
        <p className="rounded-lg border border-foreground/8 bg-background/38 p-3 font-body text-[10px] leading-relaxed text-foreground/42">
          Payroll proof: {tower.payroll.length}
        </p>
        <p className="rounded-lg border border-foreground/8 bg-background/38 p-3 font-body text-[10px] leading-relaxed text-foreground/42">
          Incidents: {tower.incidents.length}
        </p>
      </div>
    </div>
  );
}

export default function FieldControl() {
  const [tower, setTower] = useState(() => buildFieldVisitControlTower({
    requests: REQUESTS,
    appointments: APPOINTMENTS,
    clients: CLIENTS,
    services: SERVICES,
    staff: STAFF,
  }));
  const [note, setNote] = useState('');
  const [view, setView] = useState('visits');

  const refresh = () => setTower(buildFieldVisitControlTower({
    requests: REQUESTS,
    appointments: APPOINTMENTS,
    clients: CLIENTS,
    services: SERVICES,
    staff: STAFF,
  }));

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('av.local.change', onChange);
    return () => window.removeEventListener('av.local.change', onChange);
  }, []);

  const workVisits = useMemo(() => (
    [...tower.visits].sort((a, b) => Number(a.closeoutDone) - Number(b.closeoutDone) || a.client.localeCompare(b.client))
  ), [tower.visits]);

  const handleSweep = () => {
    const result = runFieldVisitControlSweep({
      requests: REQUESTS,
      appointments: APPOINTMENTS,
      clients: CLIENTS,
      services: SERVICES,
      staff: STAFF,
    });
    setTower(result.tower);
    setNote(`Sweep queued ${result.actions.length}`);
  };

  const handleText = (visit, type) => {
    queueFieldVisitText(visit, type, { force: true });
    setNote(`${type.toUpperCase()} text: ${visit.client}`);
    refresh();
  };

  const handleStatus = (visit, status, textType) => {
    setFieldVisitStatus(visit.id, status, { actor: visit.nurseName });
    queueFieldVisitText(visit, textType, { force: true });
    setNote(`${status}: ${visit.client}`);
    refresh();
  };

  const handleComplete = (visit) => {
    const result = completeFieldVisit(visit, { nurseName: visit.nurseName });
    setNote(result.ok ? `Closed: ${visit.client}` : `Closeout blocked: ${visit.client}`);
    refresh();
  };

  return (
    <AdminLayout>
      <PageShell
        eyebrow="ETA · route · closeout"
        title="Field Control"
        subtitle="Visit execution without becoming the EMR."
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
              to="/admin/dispatch"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/64 transition-colors hover:text-foreground"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={2} />
              Dispatch
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
            <Metric label="Assigned" value={tower.metrics.assigned} detail="ready for ETA" icon={Send} tone={tower.metrics.assigned ? 'action' : 'default'} />
            <Metric label="En Route" value={tower.metrics.enRoute} detail="moving" icon={Navigation} tone={tower.metrics.enRoute ? 'action' : 'default'} />
            <Metric label="Arrived" value={tower.metrics.arrived} detail="at site" icon={MapPin} tone={tower.metrics.arrived ? 'action' : 'default'} />
            <Metric label="In Progress" value={tower.metrics.inProgress} detail="active visit" icon={Play} tone={tower.metrics.inProgress ? 'action' : 'default'} />
            <Metric label="Closeout" value={tower.metrics.closeout} detail="Acuity proof" icon={ClipboardCheck} tone="ready" />
            <Metric label="Incidents" value={tower.metrics.incidents} detail="clinical review" icon={AlertTriangle} tone={tower.metrics.incidents ? 'critical' : 'ready'} />
          </div>

          <StageStrip stages={tower.stageSummaries} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">Work Queue</p>
                  <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
                    {view === 'visits' ? 'Visits' : view === 'closeout' ? 'Closeout' : 'Incidents'}
                  </h2>
                </div>
                <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:w-auto sm:px-0 sm:pb-0">
                  <div className="inline-flex min-w-max rounded-full border border-foreground/10 bg-background/46 p-1">
                  {[
                    ['visits', 'Visits'],
                    ['closeout', 'Closeout'],
                    ['incidents', 'Incidents'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setView(key)}
                      className={`min-h-[44px] shrink-0 rounded-full px-3.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                        view === key ? 'bg-foreground text-background' : 'text-foreground/45 hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  </div>
                </div>
              </div>

              {view === 'visits' && (
                <div className="space-y-3">
                  {workVisits.map((visit) => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      onText={handleText}
                      onStatus={handleStatus}
                      onComplete={handleComplete}
                    />
                  ))}
                </div>
              )}

              {view === 'closeout' && (
                <div className="space-y-3">
                  {workVisits.map((visit) => (
                    <CloseoutCard key={visit.id} visit={visit} />
                  ))}
                </div>
              )}

              {view === 'incidents' && (
                <div className="space-y-3">
                  {tower.incidents.length ? tower.incidents.map((item) => (
                    <IncidentCard key={item.id} item={item} />
                  )) : (
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-8 text-center">
                      <p className="font-heading text-3xl uppercase tracking-tight text-foreground">No Incidents</p>
                      <p className="mt-1 font-body text-[12px] text-foreground/42">Clinical lane is clear.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <Guardrails tower={tower} />
              <ProofPanel tower={tower} />
              <Link
                to="/provider/shift"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Nurse Shift <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
              <Link
                to="/provider/communications"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Comms <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </aside>
          </div>
        </div>
      </PageShell>
    </AdminLayout>
  );
}
