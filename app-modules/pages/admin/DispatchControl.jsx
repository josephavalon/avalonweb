import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  LockKeyhole,
  MapPin,
  MessageSquare,
  Navigation,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import PageShell from '@/components/admin/PageShell';
import { APPOINTMENTS, CLIENTS, SERVICES, STAFF } from '@/fixtures/adminMockData';
import { NURSES, REQUESTS } from '@/fixtures/commandMockData';
import {
  acceptDispatchBroadcast,
  buildDispatchControlTower,
  declineDispatchBroadcast,
  queueDispatchBroadcast,
  runDispatchControlSweep,
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

function NurseName({ nurse }) {
  const tone = nurse.trainingGate?.status === 'Review' ? 'border-amber-300/22 bg-amber-300/[0.08] text-amber-100' : 'border-emerald-300/18 bg-emerald-300/[0.055] text-emerald-200/82';
  return (
    <span className={`inline-flex min-h-[26px] items-center rounded-full border px-2.5 font-body text-[9px] font-semibold uppercase tracking-[0.13em] ${tone}`}>
      {nurse.name}{nurse.trainingGate?.status === 'Review' ? ' · Review' : ''}
    </span>
  );
}

function ShiftCard({ shift, onBroadcast, onAccept, onPass }) {
  const primaryNurse = shift.eligible[0];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(shift.risk)}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {shift.assigned ? 'Assigned' : shift.broadcastStatus}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {shift.city}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {money(shift.shiftValue)}
            </span>
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{shift.client}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {shift.service} · {[shift.date, shift.time].filter(Boolean).join(' · ')}
          </p>
        </div>
        <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">
          {shift.assigned ? 'GO' : shift.eligible.length || 0}
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-foreground/8 bg-background/38 p-3">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/35" strokeWidth={1.6} />
          <p className="font-body text-[11px] leading-snug text-foreground/48">{shift.address}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {shift.eligible.length ? shift.eligible.slice(0, 4).map((nurse) => (
          <NurseName key={nurse.id} nurse={nurse} />
        )) : (
          <span className="inline-flex min-h-[26px] items-center rounded-full border border-red-300/18 bg-red-300/[0.055] px-2.5 font-body text-[9px] font-semibold uppercase tracking-[0.13em] text-red-200/82">
            No clear RN
          </span>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-foreground/8 bg-background/38 p-3">
        <div className="flex items-start gap-2">
          <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/35" strokeWidth={1.6} />
          <p className="font-body text-[11px] leading-snug text-foreground/46">
            {shift.trainingRequired?.join(' · ') || 'Core protocol review'}
            {shift.trainingWarnings?.length ? ` · ${shift.trainingWarnings.length} RN review warning${shift.trainingWarnings.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!shift.assigned && (
          <button
            type="button"
            onClick={() => onBroadcast(shift)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            Broadcast
          </button>
        )}
        {shift.broadcast && !shift.assigned && primaryNurse && (
          <button
            type="button"
            onClick={() => onAccept(shift.broadcast, primaryNurse.name)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Accept
          </button>
        )}
        {shift.broadcast && !shift.assigned && primaryNurse && (
          <button
            type="button"
            onClick={() => onPass(shift.broadcast, primaryNurse.name)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58 transition-colors hover:text-foreground"
          >
            Pass
          </button>
        )}
        {shift.routeReady && (
          <>
            <a
              href={shift.maps.apple}
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58 transition-colors hover:text-foreground"
            >
              <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
              Apple
            </a>
            <a
              href={shift.maps.google}
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58 transition-colors hover:text-foreground"
            >
              <Route className="h-3.5 w-3.5" strokeWidth={2} />
              Google
            </a>
          </>
        )}
      </div>
    </motion.article>
  );
}

function BroadcastCard({ item, roster, onAccept, onPass }) {
  const eligible = roster.filter((nurse) => nurse.clear);
  const nurse = eligible[0];
  return (
    <article className={`rounded-xl border p-4 ${toneClass(item.status === 'Assigned' ? 'ready' : 'action')}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
            {item.status}
          </span>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{item.client}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {item.city} · {money(item.shiftValue)} · {item.assignedTo || 'Reply Y/N'}
          </p>
        </div>
        <MessageSquare className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
      <p className="mt-3 rounded-lg border border-foreground/8 bg-background/38 p-3 font-body text-[11px] leading-relaxed text-foreground/46">
        {item.nurseReplyPrompt}
      </p>
      {item.status !== 'Assigned' && nurse && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAccept(item, nurse.name)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Y {nurse.name}
          </button>
          <button
            type="button"
            onClick={() => onPass(item, nurse.name)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58 transition-colors hover:text-foreground"
          >
            N Pass
          </button>
        </div>
      )}
    </article>
  );
}

function ReplyCard({ item }) {
  return (
    <article className={`rounded-xl border p-4 ${toneClass(item.status === 'Accepted' ? 'ready' : 'default')}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
            {item.reply}
          </span>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{item.nurseName}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">{item.status} · {item.bookingId || item.broadcastId}</p>
        </div>
        <UserCheck className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
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
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Dispatch Gate</h2>
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

function SettingsPanel({ tower }) {
  const channels = Object.entries(tower.settings.channels || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key.toUpperCase());
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Alerting</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Y/N Ready</h2>
        </div>
        <ShieldCheck className="h-4 w-4 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="space-y-2">
        <p className="rounded-lg border border-foreground/8 bg-background/38 p-3 font-body text-[10px] leading-relaxed text-foreground/42">
          Channels: {channels.join(' · ') || 'In-app only'}
        </p>
        <p className="rounded-lg border border-foreground/8 bg-background/38 p-3 font-body text-[10px] leading-relaxed text-foreground/42">
          Repeat every {tower.settings.repeatMinutes} min. Escalate after {tower.settings.escalationAfterMinutes} min.
        </p>
      </div>
    </div>
  );
}

export default function DispatchControl() {
  const [tower, setTower] = useState(() => buildDispatchControlTower({
    requests: REQUESTS,
    appointments: APPOINTMENTS,
    clients: CLIENTS,
    services: SERVICES,
    nurses: NURSES,
    staff: STAFF,
  }));
  const [note, setNote] = useState('');
  const [view, setView] = useState('shifts');

  const refresh = () => setTower(buildDispatchControlTower({
    requests: REQUESTS,
    appointments: APPOINTMENTS,
    clients: CLIENTS,
    services: SERVICES,
    nurses: NURSES,
    staff: STAFF,
  }));

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('av.local.change', onChange);
    return () => window.removeEventListener('av.local.change', onChange);
  }, []);

  const workShifts = useMemo(() => (
    tower.shifts
      .filter((item) => item.needsNurse || item.broadcast || item.assigned)
      .sort((a, b) => Number(a.assigned) - Number(b.assigned) || Number(!b.eligible.length) - Number(!a.eligible.length))
      .slice(0, 18)
  ), [tower.shifts]);

  const handleSweep = () => {
    const result = runDispatchControlSweep({
      requests: REQUESTS,
      appointments: APPOINTMENTS,
      clients: CLIENTS,
      services: SERVICES,
      nurses: NURSES,
      staff: STAFF,
    });
    setTower(result.tower);
    setNote(`Sweep queued ${result.actions.length}`);
  };

  const handleBroadcast = (shift) => {
    const broadcast = queueDispatchBroadcast(shift);
    setNote(broadcast ? `Broadcast: ${broadcast.client}` : `Blocked: ${shift.client}`);
    refresh();
  };

  const handleAccept = (broadcast, nurseName) => {
    const result = acceptDispatchBroadcast(broadcast.id, nurseName, tower.roster);
    setNote(result.ok ? `Accepted: ${nurseName}` : `Blocked: ${nurseName}`);
    refresh();
  };

  const handlePass = (broadcast, nurseName) => {
    declineDispatchBroadcast(broadcast.id, nurseName);
    setNote(`Passed: ${nurseName}`);
    refresh();
  };

  return (
    <AdminLayout>
      <PageShell
        eyebrow="Broadcast · Y/N · route"
        title="Dispatch Control"
        subtitle="Open visit to accepted nurse, fast."
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
              to="/admin/credentials"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/64 transition-colors hover:text-foreground"
            >
              <Stethoscope className="h-3.5 w-3.5" strokeWidth={2} />
              Credentials
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
            <Metric label="Open" value={tower.metrics.open} detail="needs coverage" icon={AlertTriangle} tone={tower.metrics.open ? 'action' : 'ready'} />
            <Metric label="Broadcasting" value={tower.metrics.broadcasting} detail="Y/N active" icon={Send} tone={tower.metrics.broadcasting ? 'action' : 'ready'} />
            <Metric label="Assigned" value={tower.metrics.assigned} detail="route ready" icon={CheckCircle2} tone="ready" />
            <Metric label="No Clear RN" value={tower.metrics.noClearRn} detail="credential block" icon={Stethoscope} tone={tower.metrics.noClearRn ? 'critical' : 'ready'} />
            <Metric label="Training" value={tower.metrics.trainingGaps} detail="review gaps" icon={GraduationCap} tone={tower.metrics.trainingGaps ? 'action' : 'ready'} />
            <Metric label="Texts" value={tower.metrics.clientTexts} detail="client queue" icon={MessageSquare} tone={tower.metrics.clientTexts ? 'ready' : 'default'} />
          </div>

          <StageStrip stages={tower.stageSummaries} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">Work Queue</p>
                  <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
                    {view === 'shifts' ? 'Shifts' : view === 'broadcasts' ? 'Broadcasts' : 'Replies'}
                  </h2>
                </div>
                <div className="flex rounded-full border border-foreground/10 bg-background/46 p-1">
                  {[
                    ['shifts', 'Shifts'],
                    ['broadcasts', 'Broadcasts'],
                    ['replies', 'Replies'],
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

              {view === 'shifts' && (
                <div className="space-y-3">
                  {workShifts.map((shift) => (
                    <ShiftCard
                      key={shift.bookingId}
                      shift={shift}
                      onBroadcast={handleBroadcast}
                      onAccept={handleAccept}
                      onPass={handlePass}
                    />
                  ))}
                </div>
              )}

              {view === 'broadcasts' && (
                <div className="space-y-3">
                  {tower.broadcasts.length ? tower.broadcasts.map((item) => (
                    <BroadcastCard
                      key={item.id}
                      item={item}
                      roster={tower.roster}
                      onAccept={handleAccept}
                      onPass={handlePass}
                    />
                  )) : (
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-8 text-center">
                      <p className="font-heading text-3xl uppercase tracking-tight text-foreground">No Broadcasts</p>
                      <p className="mt-1 font-body text-[12px] text-foreground/42">Run sweep or broadcast a shift.</p>
                    </div>
                  )}
                </div>
              )}

              {view === 'replies' && (
                <div className="space-y-3">
                  {tower.replies.length ? tower.replies.map((item) => (
                    <ReplyCard key={item.id} item={item} />
                  )) : (
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-8 text-center">
                      <p className="font-heading text-3xl uppercase tracking-tight text-foreground">No Replies</p>
                      <p className="mt-1 font-body text-[12px] text-foreground/42">Y/N replies appear here.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <Guardrails tower={tower} />
              <SettingsPanel tower={tower} />
              <Link
                to="/admin/communications"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Comms <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
              <Link
                to="/admin/training"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Training <GraduationCap className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
              <Link
                to="/provider/shift"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Nurse Shift <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </aside>
          </div>
        </div>
      </PageShell>
    </AdminLayout>
  );
}
