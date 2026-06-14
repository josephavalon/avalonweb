import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  LockKeyhole,
  MessageSquare,
  Package,
  RefreshCw,
  Send,
  ShieldCheck,
  DollarSign,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { REQUESTS } from '@/fixtures/commandMockData';
import { SEED_ITEMS } from '@/data/inventorySeed';
import {
  ACUITY_BOUNDARY_ITEMS,
  ACUITY_OPERATING_CONTRACT,
  buildAcuityControlTower,
  buildVisitCloseoutDock,
  queueAcuityManualHandoff,
  resolveAcuityManualHandoff,
  runAcuityControlSweep,
  runVisitCloseoutSweep,
} from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

function toneClass(tone) {
  if (tone === 'critical') return 'border-red-400/25 bg-red-500/[0.055] text-red-300';
  if (tone === 'action') return 'border-amber-300/25 bg-amber-300/[0.055] text-amber-200';
  if (tone === 'ready') return 'border-emerald-300/20 bg-emerald-300/[0.045] text-emerald-200';
  return 'border-foreground/10 bg-foreground/[0.035] text-foreground/65';
}

function MetricTile({ label, value, detail, tone = 'default', icon: Icon }) {
  return (
    <div className={`av-glass rounded-xl p-4 ${toneClass(tone)}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] opacity-65">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 opacity-55" strokeWidth={1.6} />}
      </div>
      <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">{value}</p>
      <p className="mt-1 font-body text-[11px] leading-snug text-foreground/44">{detail}</p>
    </div>
  );
}

function StageRail({ stages }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background/58 p-3 shadow-[0_18px_70px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl">
      <div className="grid gap-2 md:grid-cols-2">
        {stages.map((stage) => (
          <div key={stage.key} className="rounded-lg border border-foreground/8 bg-foreground/[0.03] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/48">{stage.label}</p>
              <span className="font-body text-[9px] uppercase tracking-[0.12em] text-foreground/35">{stage.complete}/{stage.total}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/8">
              <div
                className="h-full rounded-full bg-foreground/70 transition-all duration-700"
                style={{ width: `${stage.pct}%` }}
              />
            </div>
            <p className="mt-2 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/32">{stage.owner}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadinessPill({ item }) {
  return (
    <span
      className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 font-body text-[9px] font-semibold uppercase tracking-[0.14em] ${
        item.done
          ? 'border-emerald-300/20 bg-emerald-300/[0.055] text-emerald-200/85'
          : 'border-foreground/12 bg-foreground/[0.04] text-foreground/42'
      }`}
      title={item.detail}
    >
      {item.done ? <CheckCircle2 className="h-3 w-3" strokeWidth={1.8} /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-55" />}
      {item.label}
    </span>
  );
}

function QueueCard({ item, onQueue, onResolve }) {
  const queued = item.handoff?.status === 'Queued';
  const represented = item.acuityLinked;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(item.risk)}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {item.acuityStatus}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {item.city}
            </span>
            {item.risk !== 'ready' && (
              <span className="rounded-full border border-current/20 bg-current/[0.04] px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em]">
                {item.nextAction}
              </span>
            )}
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
            {item.client}
          </h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {item.service} · {[item.date, item.time].filter(Boolean).join(' · ') || 'Slot pending'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!represented && (
            <button
              type="button"
              onClick={() => onQueue(item)}
              className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground text-background px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] transition-transform active:scale-[0.98]"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={2} />
              {queued ? 'Requeue' : 'Queue'}
            </button>
          )}
          {queued && (
            <button
              type="button"
              onClick={() => onResolve(item)}
              className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
            >
              <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Represented
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.readiness.map((entry) => (
          <ReadinessPill key={entry.key} item={entry} />
        ))}
      </div>
    </motion.article>
  );
}

function HealthStrip({ health }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {health.map((item) => (
        <div key={item.label} className="rounded-xl border border-foreground/10 bg-foreground/[0.032] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/42">{item.label}</p>
            <span className="rounded-full border border-foreground/10 px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.14em] text-foreground/38">
              {item.status}
            </span>
          </div>
          <p className="font-body text-[13px] font-medium text-foreground/82">{item.value}</p>
          <p className="mt-1 font-body text-[11px] leading-snug text-foreground/42">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function HandoffLedger({ handoffs, onResolve }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Manual Ledger</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Acuity Handoffs</h2>
        </div>
        <CalendarClock className="h-4 w-4 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="space-y-2">
        {handoffs.length === 0 ? (
          <p className="rounded-lg border border-foreground/8 bg-background/38 p-4 font-body text-[12px] text-foreground/42">
            No manual handoffs queued.
          </p>
        ) : handoffs.slice(0, 8).map((item) => (
          <div key={item.id} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[12px] font-medium text-foreground/82">{item.client}</p>
                <p className="mt-0.5 font-body text-[10px] text-foreground/38">{item.service} · {item.slot}</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.14em] ${
                item.status === 'Represented'
                  ? 'border-emerald-300/18 text-emerald-200/75'
                  : 'border-amber-300/22 text-amber-200/75'
              }`}>
                {item.status}
              </span>
            </div>
            {item.status !== 'Represented' && (
              <button
                type="button"
                onClick={() => onResolve(item)}
                className="mt-3 inline-flex min-h-[32px] items-center gap-2 rounded-full border border-foreground/12 px-3 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/58 transition-colors hover:text-foreground"
              >
                <ClipboardCheck className="h-3 w-3" strokeWidth={2} />
                Mark represented
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofDot({ item }) {
  return (
    <span
      className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 font-body text-[9px] font-semibold uppercase tracking-[0.14em] ${
        item.done
          ? 'border-emerald-300/18 bg-emerald-300/[0.05] text-emerald-200/80'
          : 'border-amber-300/24 bg-amber-300/[0.055] text-amber-200/80'
      }`}
      title={item.detail}
    >
      {item.done ? <CheckCircle2 className="h-3 w-3" strokeWidth={1.8} /> : <AlertTriangle className="h-3 w-3" strokeWidth={1.8} />}
      {item.label}
    </span>
  );
}

function CloseoutDock({ dock, onSweep }) {
  const hotRows = dock.rows.filter((row) => row.risk !== 'ready');
  return (
    <section className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">After Visit</p>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">Closeout Dock</h2>
          <p className="mt-1 max-w-2xl font-body text-[12px] leading-relaxed text-foreground/42">
            Acuity entry, kit deduction, Gusto proof, and event follow-up. Operational only.
          </p>
        </div>
        <button
          type="button"
          onClick={onSweep}
          className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          Sweep Proof
        </button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 md:grid-cols-2">
        <MetricTile label="Closeouts" value={dock.metrics.total} detail="RN packets" icon={ClipboardCheck} />
        <MetricTile label="Clean" value={dock.metrics.ready} detail="all proof done" tone="ready" icon={CheckCircle2} />
        <MetricTile label="Acuity" value={dock.metrics.acuityAction} detail="entry needed" tone={dock.metrics.acuityAction ? 'critical' : 'ready'} icon={CalendarClock} />
        <MetricTile label="Kit" value={dock.metrics.kitAction} detail="deductions" tone={dock.metrics.kitAction ? 'action' : 'ready'} icon={Package} />
        <MetricTile label="Gusto" value={dock.metrics.payrollAction} detail="pay proof" tone={dock.metrics.payrollAction ? 'action' : 'ready'} icon={DollarSign} />
      </div>

      {dock.rows.length === 0 ? (
        <div className="rounded-xl border border-foreground/8 bg-background/38 p-6">
          <p className="font-heading text-3xl uppercase leading-none text-foreground">No Closeouts</p>
          <p className="mt-1 font-body text-[12px] text-foreground/42">Completed nurse visits will land here.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {(hotRows.length ? hotRows : dock.rows).slice(0, 6).map((row) => (
            <article key={row.id} className={`rounded-xl border p-4 ${toneClass(row.risk)}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
                      {row.packet.acuityStatus || 'Acuity'}
                    </span>
                    {row.eventFlagged && (
                      <span className="rounded-full border border-red-300/24 bg-red-500/[0.06] px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-red-200/80">
                        Event
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">{row.client}</h3>
                  <p className="mt-1 font-body text-[11px] text-foreground/46">{row.service} · {row.nurseName}</p>
                </div>
                <span className="rounded-full border border-current/20 bg-current/[0.04] px-2.5 py-1 font-body text-[9px] font-semibold uppercase tracking-[0.16em]">
                  {row.nextAction}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {row.proof.map((entry) => <ProofDot key={entry.key} item={entry} />)}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AcuityControl() {
  const [state, setState] = useState(() => buildAcuityControlTower(REQUESTS));
  const [dock, setDock] = useState(() => buildVisitCloseoutDock());
  const [note, setNote] = useState('');

  const refresh = () => {
    setState(buildAcuityControlTower(REQUESTS));
    setDock(buildVisitCloseoutDock());
  };

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('av.local.change', onChange);
    return () => window.removeEventListener('av.local.change', onChange);
  }, []);

  const hotItems = useMemo(() => (
    state.items
      .filter((item) => item.risk !== 'ready')
      .sort((a, b) => (a.risk === 'critical' ? -1 : 0) - (b.risk === 'critical' ? -1 : 0))
  ), [state.items]);

  const handleQueue = (item) => {
    const handoff = queueAcuityManualHandoff(item);
    setNote(`Queued: ${handoff.client}`);
    refresh();
  };

  const handleResolve = (item) => {
    resolveAcuityManualHandoff(item.handoff?.id || item.id || item.bookingId, 'Acuity Control');
    setNote(`Represented: ${item.client || item.bookingId}`);
    refresh();
  };

  const handleSweep = () => {
    const result = runAcuityControlSweep(REQUESTS);
    setState(result.tower);
    setDock(buildVisitCloseoutDock());
    setNote(`Sweep queued ${result.actions.length}`);
  };

  const handleCloseoutSweep = () => {
    const result = runVisitCloseoutSweep({ inventory: SEED_ITEMS });
    setDock(result.dock);
    setState(buildAcuityControlTower(REQUESTS));
    setNote(`Closeout proof queued ${result.actions.length}`);
  };

  return (
    <AdminShell title="Acuity">
      <PageShell embedded
        eyebrow="Acuity Source Of Truth"
        title="Acuity Control"
        subtitle="Acuity owns EMR + schedule. Avalon owns motion."
        action={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSweep}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground text-background px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] transition-transform active:scale-[0.98]"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
              Sweep
            </button>
            <Link
              to="/admin/communications"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/64 transition-colors hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
              Comms
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

          <div className="grid gap-3 md:grid-cols-2">
            <MetricTile label="Queue" value={state.metrics.total} detail="mirrored visits" icon={Activity} />
            <MetricTile label="Ready" value={state.metrics.ready} detail="no local blockers" tone="ready" icon={CheckCircle2} />
            <MetricTile label="Acuity" value={state.metrics.acuityAction} detail="manual handoff" tone={state.metrics.acuityAction ? 'action' : 'ready'} icon={CalendarClock} />
            <MetricTile label="GFE" value={state.metrics.gfeAction} detail="clinical route" tone={state.metrics.gfeAction ? 'critical' : 'ready'} icon={ShieldCheck} />
            <MetricTile label="RN" value={state.metrics.nurseAction} detail="needs assignment" tone={state.metrics.nurseAction ? 'action' : 'ready'} icon={Send} />
            <MetricTile label="Closeout" value={state.metrics.closeoutAction} detail="Acuity entry" tone={state.metrics.closeoutAction ? 'action' : 'ready'} icon={ClipboardCheck} />
          </div>

          <StageRail stages={state.stageSummaries} />

          <CloseoutDock dock={dock} onSweep={handleCloseoutSweep} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">Live Work</p>
                  <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">Blockers</h2>
                </div>
                <Link
                  to="/admin/bookings"
                  className="inline-flex items-center gap-2 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/42 transition-colors hover:text-foreground"
                >
                  Requests <ExternalLink className="h-3 w-3" strokeWidth={2} />
                </Link>
              </div>

              {hotItems.length === 0 ? (
                <div className="rounded-xl border border-emerald-300/18 bg-emerald-300/[0.045] p-6">
                  <p className="font-heading text-3xl uppercase leading-none text-foreground">Clean</p>
                  <p className="mt-1 font-body text-[12px] text-foreground/46">No local blockers.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hotItems.map((item) => (
                    <QueueCard key={item.bookingId} item={item} onQueue={handleQueue} onResolve={handleResolve} />
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/46">
                    <LockKeyhole className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
                  </div>
                  <div>
                    <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Boundary</p>
                    <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">No Fake EMR</h2>
                  </div>
                </div>
                <div className="space-y-2">
                  {ACUITY_BOUNDARY_ITEMS.map((item) => (
                    <div key={item.label} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
                      <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">{item.label}</p>
                      <p className="mt-1 font-body text-[11px] leading-snug text-foreground/40">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <HandoffLedger handoffs={state.handoffs} onResolve={handleResolve} />
            </aside>
          </div>

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-foreground/35" strokeWidth={1.6} />
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Contract</p>
              </div>
              <p className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">{ACUITY_OPERATING_CONTRACT.service}</p>
              <p className="mt-2 font-body text-[12px] leading-relaxed text-foreground/45">
                {ACUITY_OPERATING_CONTRACT.description}
              </p>
            </div>
            <HealthStrip health={state.health} />
          </div>
        </div>
      </PageShell>
    </AdminShell>
  );
}
