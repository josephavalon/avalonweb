import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import {
  CheckCircle2,
  Contact,
  DatabaseZap,
  ExternalLink,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import PageShell from '@/components/admin/PageShell';
import { CLIENTS, APPOINTMENTS } from '@/fixtures/adminMockData';
import { FOLLOWUPS, REQUESTS } from '@/fixtures/commandMockData';
import {
  buildAttioControlTower,
  queueAttioLocalSync,
  queueAttioOutreach,
  resolveAttioLocalSync,
  resolveAttioOutreach,
} from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

function toneClass(tone) {
  if (tone === 'critical') return 'border-red-400/25 bg-red-500/[0.055] text-red-300';
  if (tone === 'action') return 'border-amber-300/25 bg-amber-300/[0.055] text-amber-200';
  if (tone === 'ready') return 'border-emerald-300/20 bg-emerald-300/[0.045] text-emerald-200';
  return 'border-foreground/10 bg-foreground/[0.035] text-foreground/65';
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
      <div className="grid gap-2 md:grid-cols-2">
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

function SyncCard({ person, onQueue, onResolve }) {
  const queued = person.sync?.status === 'Queued';
  const synced = person.sync?.status === 'Synced';
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(person.missingContact ? 'critical' : synced ? 'ready' : 'action')}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {person.lifecycleStage}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {person.syncStatus}
            </span>
            {person.planInterest && (
              <span className="rounded-full border border-accent/22 bg-accent/[0.08] px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-accent">
                Plan
              </span>
            )}
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
            {person.name}
          </h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {[person.email || person.phone || 'Contact missing', person.city, person.source].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!synced && !person.missingContact && (
            <button
              type="button"
              onClick={() => onQueue(person)}
              className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
            >
              <DatabaseZap className="h-3.5 w-3.5" strokeWidth={2} />
              {queued ? 'Requeue' : 'Queue'}
            </button>
          )}
          {queued && (
            <button
              type="button"
              onClick={() => onResolve(person)}
              className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
            >
              <UserRoundCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Synced
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {Object.entries(person.safePayload).slice(0, 6).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-foreground/8 bg-background/35 px-3 py-2">
            <p className="font-body text-[8px] uppercase tracking-[0.18em] text-foreground/30">{key}</p>
            <p className="mt-1 truncate font-body text-[11px] text-foreground/58">{Array.isArray(value) ? value.join(', ') || '—' : value || '—'}</p>
          </div>
        ))}
      </div>
    </motion.article>
  );
}

function OutreachCard({ task, onQueue, onDone }) {
  const done = task.queued?.status === 'Done';
  const queued = Boolean(task.queued);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(done ? 'ready' : task.risk)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {task.priority}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {queued ? task.queued.queuedStatus || task.queued.status : 'Not queued'}
            </span>
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
            {task.client}
          </h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {task.type} · {task.dueDate || 'No due date'}
          </p>
        </div>
        {done && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-200/75" strokeWidth={1.8} />}
      </div>
      <p className="mt-3 rounded-lg border border-foreground/8 bg-background/35 p-3 font-body text-[11px] leading-relaxed text-foreground/46">
        {task.note || task.script}
      </p>
      {!done && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onQueue(task)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            {queued ? 'Requeue' : 'Queue'}
          </button>
          {queued && (
            <button
              type="button"
              onClick={() => onDone(task)}
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
              Done
            </button>
          )}
        </div>
      )}
    </motion.article>
  );
}

function BoundaryPanel({ boundary, contract }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/46">
          <LockKeyhole className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
        </div>
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Boundary</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">CRM-Safe</h2>
        </div>
      </div>
      <p className="mb-3 font-body text-[12px] leading-relaxed text-foreground/45">
        {contract.description}
      </p>
      <div className="space-y-2">
        {boundary.map((item) => (
          <div key={item.label} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">{item.label}</p>
            <p className="mt-1 font-body text-[11px] leading-snug text-foreground/40">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ledger({ queue, outreach, onResolveSync, onResolveOutreach }) {
  const rows = [
    ...queue.slice(0, 4).map((item) => ({ ...item, label: item.name, kind: 'Sync' })),
    ...outreach.slice(0, 4).map((item) => ({ ...item, label: item.client, kind: 'Outreach' })),
  ];
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Local Ledger</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Proof</h2>
        </div>
        <ShieldCheck className="h-4 w-4 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-foreground/8 bg-background/38 p-4 font-body text-[12px] text-foreground/42">
            Nothing queued.
          </p>
        ) : rows.map((item) => (
          <div key={`${item.kind}-${item.id}`} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[12px] font-medium text-foreground/82">{item.label}</p>
                <p className="mt-0.5 font-body text-[10px] text-foreground/38">{item.kind} · {item.lifecycleStage || item.type}</p>
              </div>
              <span className="rounded-full border border-foreground/12 px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.14em] text-foreground/42">
                {item.status}
              </span>
            </div>
            {item.status !== 'Synced' && item.status !== 'Done' && (
              <button
                type="button"
                onClick={() => item.kind === 'Sync' ? onResolveSync(item) : onResolveOutreach(item)}
                className="mt-3 inline-flex min-h-[32px] items-center gap-2 rounded-full border border-foreground/12 px-3 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/58 transition-colors hover:text-foreground"
              >
                <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                Complete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AttioControl() {
  const [tower, setTower] = useState(() => buildAttioControlTower({ requests: REQUESTS, clients: CLIENTS, appointments: APPOINTMENTS, followups: FOLLOWUPS }));
  const [note, setNote] = useState('');
  const [view, setView] = useState('tasks');

  const refresh = () => setTower(buildAttioControlTower({ requests: REQUESTS, clients: CLIENTS, appointments: APPOINTMENTS, followups: FOLLOWUPS }));

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('av.local.change', onChange);
    return () => window.removeEventListener('av.local.change', onChange);
  }, []);

  const hotTasks = useMemo(() => (
    tower.tasks
      .filter((task) => task.queued?.status !== 'Done')
      .sort((a, b) => (a.risk === 'critical' ? -1 : 0) - (b.risk === 'critical' ? -1 : 0))
  ), [tower.tasks]);

  const syncPeople = useMemo(() => (
    tower.people
      .filter((person) => person.needsSync || person.planInterest || /vip/i.test([person.lifecycleStage, ...(person.tags || [])].join(' ')))
      .slice(0, 12)
  ), [tower.people]);

  const handleQueueSync = (person) => {
    const entry = queueAttioLocalSync(person);
    setNote(`CRM queued: ${entry.name}`);
    refresh();
  };

  const handleResolveSync = (person) => {
    resolveAttioLocalSync(person.sync?.id || person.id, 'Attio Control');
    setNote(`CRM synced: ${person.name || person.label}`);
    refresh();
  };

  const handleQueueOutreach = (task) => {
    const entry = queueAttioOutreach(task);
    setNote(`Outreach queued: ${entry.client}`);
    refresh();
  };

  const handleResolveOutreach = (task) => {
    resolveAttioOutreach(task.queued?.id || task.id, 'Attio Control');
    setNote(`Outreach done: ${task.client || task.label}`);
    refresh();
  };

  const handleSweep = () => {
    let count = 0;
    syncPeople.filter((person) => !person.missingContact && person.needsSync).slice(0, 8).forEach((person) => {
      queueAttioLocalSync(person, { source: 'CRM sweep' });
      count += 1;
    });
    hotTasks.slice(0, 8).forEach((task) => {
      queueAttioOutreach(task, { source: 'CRM sweep' });
      count += 1;
    });
    setNote(`Sweep queued ${count}`);
    refresh();
  };

  return (
    <AdminLayout>
      <PageShell
        eyebrow="Attio Relationship Layer"
        title="CRM Control"
        subtitle="Relationship state only. No clinical notes."
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
            <Metric label="People" value={tower.metrics.people} detail="CRM-safe records" icon={Contact} />
            <Metric label="Sync" value={tower.metrics.needsSync} detail="ready for Attio" icon={DatabaseZap} tone={tower.metrics.needsSync ? 'action' : 'ready'} />
            <Metric label="Outreach" value={tower.metrics.tasks} detail="open reasons" icon={Send} tone="action" />
            <Metric label="Overdue" value={tower.metrics.overdue} detail="move now" icon={RefreshCw} tone={tower.metrics.overdue ? 'critical' : 'ready'} />
            <Metric label="Plans" value={tower.metrics.planLeads} detail="subscription/corporate" icon={Sparkles} tone="ready" />
            <Metric label="VIP" value={tower.metrics.vip} detail="high-touch" icon={Star} tone="ready" />
          </div>

          <StageStrip stages={tower.stageSummaries} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">Work Queue</p>
                  <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
                    {view === 'tasks' ? 'Outreach' : 'Sync'}
                  </h2>
                </div>
                <div className="flex rounded-full border border-foreground/10 bg-background/46 p-1">
                  {[
                    ['tasks', 'Outreach'],
                    ['sync', 'Sync'],
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

              {view === 'tasks' ? (
                <div className="space-y-3">
                  {hotTasks.map((task) => (
                    <OutreachCard key={`${task.id}-${task.type}`} task={task} onQueue={handleQueueOutreach} onDone={handleResolveOutreach} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {syncPeople.map((person) => (
                    <SyncCard key={person.id} person={person} onQueue={handleQueueSync} onResolve={handleResolveSync} />
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <BoundaryPanel boundary={tower.boundary} contract={tower.contract} />
              <Ledger
                queue={tower.queue}
                outreach={tower.outreach}
                onResolveSync={(item) => {
                  resolveAttioLocalSync(item.id, 'Attio Control');
                  setNote(`CRM synced: ${item.label}`);
                  refresh();
                }}
                onResolveOutreach={(item) => {
                  resolveAttioOutreach(item.id, 'Attio Control');
                  setNote(`Outreach done: ${item.label}`);
                  refresh();
                }}
              />
              <Link
                to="/provider/clients"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Clients <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </aside>
          </div>
        </div>
      </PageShell>
    </AdminLayout>
  );
}
