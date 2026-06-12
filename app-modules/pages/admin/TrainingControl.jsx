import React, { useEffect, useMemo, useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { NURSES } from '@/fixtures/commandMockData';
import {
  buildTrainingControlTower,
  markTrainingReview,
  runTrainingControlSweep,
} from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

function toneClass(tone) {
  if (tone === 'critical') return 'border-red-400/25 bg-red-500/[0.055] text-red-300';
  if (tone === 'action') return 'border-amber-300/25 bg-amber-300/[0.055] text-amber-200';
  if (tone === 'ready') return 'border-emerald-300/20 bg-emerald-300/[0.045] text-emerald-200';
  return 'border-foreground/10 bg-foreground/[0.035] text-foreground/65';
}

function buildTower() {
  return buildTrainingControlTower({ nurses: NURSES });
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

function StatusChip({ children, tone = 'default' }) {
  return (
    <span className={`inline-flex min-h-[26px] items-center rounded-full border px-2.5 font-body text-[9px] font-semibold uppercase tracking-[0.13em] ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

function NurseTrainingCard({ row, onReview }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(row.tone)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip tone={row.tone}>{row.status}</StatusChip>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{row.nurseName}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {row.area} · {row.clearCount}/{row.modules.length} clear
          </p>
        </div>
        <UserCheck className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="mt-3 space-y-2">
        {row.modules.map((module) => (
          <div key={`${row.id}-${module.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-foreground/8 bg-background/38 p-3">
            <div className="min-w-0">
              <p className="truncate font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/62">{module.title}</p>
              <p className="mt-0.5 font-body text-[11px] text-foreground/42">
                {module.status} · {module.category} · {module.minutes} min
              </p>
            </div>
            {module.status === 'Clear' ? (
              <StatusChip tone="ready">Clear</StatusChip>
            ) : (
              <button
                type="button"
                onClick={() => onReview(row.nurse, module)}
                className="inline-flex min-h-[30px] shrink-0 items-center justify-center rounded-full border border-foreground/18 bg-foreground px-3 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-background"
              >
                Review
              </button>
            )}
          </div>
        ))}
      </div>
    </motion.article>
  );
}

function ModuleCard({ module, onReview }) {
  const tone = module.expired ? 'critical' : module.due ? 'action' : 'ready';
  return (
    <article className={`rounded-xl border p-4 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip tone={tone}>{module.category}</StatusChip>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{module.title}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">{module.summary}</p>
        </div>
        <BookOpenCheck className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Clear</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{module.clear}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Due</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{module.due}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Cadence</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{module.cadenceDays}d</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {module.perNurse.filter((item) => item.status !== 'Clear').slice(0, 6).map((item) => (
          <button
            key={`${module.id}-${item.nurseName}`}
            type="button"
            onClick={() => onReview(item.nurse, module)}
            className="inline-flex min-h-[30px] items-center rounded-full border border-foreground/12 bg-background/42 px-3 font-body text-[9px] font-semibold uppercase tracking-[0.13em] text-foreground/58"
          >
            {item.nurseName}
          </button>
        ))}
      </div>
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
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Review Gate</h2>
        </div>
      </div>
      <div className="space-y-2">
        {tower.guardrails.map((rule) => (
          <div key={rule} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[11px] leading-snug text-foreground/46">{rule}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrainingControl() {
  const [tower, setTower] = useState(buildTower);
  const [view, setView] = useState('nurses');
  const [note, setNote] = useState('');

  const refresh = () => setTower(buildTower());

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('av.local.change', onChange);
    return () => window.removeEventListener('av.local.change', onChange);
  }, []);

  const sortedNurses = useMemo(() => (
    [...tower.nurseRows].sort((a, b) => (
      Number(b.status === 'Blocked') - Number(a.status === 'Blocked')
      || Number(b.status === 'Review') - Number(a.status === 'Review')
      || a.nurseName.localeCompare(b.nurseName)
    ))
  ), [tower.nurseRows]);

  const handleReview = (nurse, module) => {
    const entry = markTrainingReview(nurse, module, 'Training Control');
    setNote(`Reviewed: ${entry.nurseName} · ${entry.title}`);
    refresh();
  };

  const handleSweep = () => {
    const result = runTrainingControlSweep({ nurses: NURSES });
    setTower(result.tower);
    setNote(`Sweep queued ${result.actions.length}`);
  };

  return (
    <AdminShell title="Training">
      <PageShell
        eyebrow="protocols · competency · readiness"
        title="Training Control"
        subtitle="Fast protocol review and nurse readiness proof."
        action={(
          <button
            type="button"
            onClick={handleSweep}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            Sweep
          </button>
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
            <Metric label="Nurses" value={tower.metrics.nurses} detail="tracked" icon={UserCheck} tone="default" />
            <Metric label="Clear" value={tower.metrics.clear} detail="fully reviewed" icon={CheckCircle2} tone="ready" />
            <Metric label="Review" value={tower.metrics.review} detail="due soon" icon={ClipboardCheck} tone={tower.metrics.review ? 'action' : 'ready'} />
            <Metric label="Blocked" value={tower.metrics.blocked} detail="expired" icon={AlertTriangle} tone={tower.metrics.blocked ? 'critical' : 'ready'} />
            <Metric label="Due" value={tower.metrics.due} detail="module gaps" icon={BookOpenCheck} tone={tower.metrics.due ? 'action' : 'ready'} />
            <Metric label="Modules" value={tower.metrics.modules} detail="protocol tools" icon={GraduationCap} tone="default" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">Readiness</p>
                  <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
                    {view === 'nurses' ? 'Nurses' : 'Modules'}
                  </h2>
                </div>
                <div className="flex rounded-full border border-foreground/10 bg-background/46 p-1">
                  {[
                    ['nurses', 'Nurses'],
                    ['modules', 'Modules'],
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
                  {sortedNurses.map((row) => <NurseTrainingCard key={row.id} row={row} onReview={handleReview} />)}
                </div>
              )}

              {view === 'modules' && (
                <div className="space-y-3">
                  {tower.moduleRows.map((module) => <ModuleCard key={module.id} module={module} onReview={handleReview} />)}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <Guardrails tower={tower} />
              <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/46">
                    <ShieldCheck className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
                  </div>
                  <div>
                    <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Proof</p>
                    <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Local</h2>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
                    <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Reviews</p>
                    <p className="mt-1 font-body text-[12px] text-foreground/68">{tower.reviews.length} records</p>
                  </div>
                  <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
                    <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Source</p>
                    <p className="mt-1 font-body text-[12px] text-foreground/68">Avalon OS, no PHI</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </PageShell>
    </AdminShell>
  );
}
