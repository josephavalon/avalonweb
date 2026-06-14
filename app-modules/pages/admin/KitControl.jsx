import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  LockKeyhole,
  Package,
  RefreshCw,
  ShieldCheck,
  Syringe,
  Truck,
  UserCheck,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { SEED_ITEMS } from '@/data/inventorySeed';
import { APPOINTMENTS, CLIENTS, SERVICES, STAFF } from '@/fixtures/adminMockData';
import { NURSES, REQUESTS } from '@/fixtures/commandMockData';
import {
  buildFieldVisitControlTower,
  buildKitControlTower,
  queueKitDeduction,
  queueNurseKitRestock,
  queueKitRestock,
  resolveKitRestock,
  runKitControlSweep,
  syncVisitKitUsage,
} from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

function toneClass(tone) {
  if (tone === 'critical') return 'border-red-400/25 bg-red-500/[0.055] text-red-300';
  if (tone === 'action') return 'border-amber-300/25 bg-amber-300/[0.055] text-amber-200';
  if (tone === 'ready') return 'border-emerald-300/20 bg-emerald-300/[0.045] text-emerald-200';
  return 'border-foreground/10 bg-foreground/[0.035] text-foreground/65';
}

function buildFieldVisits() {
  return buildFieldVisitControlTower({
    requests: REQUESTS,
    appointments: APPOINTMENTS,
    clients: CLIENTS,
    services: SERVICES,
    staff: STAFF,
  }).visits;
}

function buildTower() {
  return buildKitControlTower({
    inventory: SEED_ITEMS,
    nurses: NURSES,
    visits: buildFieldVisits(),
  });
}

function syncAndBuildTower() {
  syncVisitKitUsage({
    inventory: SEED_ITEMS,
    visits: buildFieldVisits(),
    actor: 'Kit Control',
  });
  return buildTower();
}

function metricTone(value, danger = false) {
  if (!value) return 'ready';
  return danger ? 'critical' : 'action';
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

function ItemCard({ item, onRestock }) {
  const tone = item.critical || item.expired ? 'critical' : item.low || item.expiring ? 'action' : 'ready';
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(tone)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <StatusChip tone={tone}>{item.status}</StatusChip>
            {item.refrigerated && <StatusChip tone="action">Cold</StatusChip>}
            <StatusChip>{item.category}</StatusChip>
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{item.name}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {item.qty} {item.unit} · Min {item.minLevel} · {item.supplier || 'Supplier TBD'}
          </p>
        </div>
        <Package className="h-5 w-5 shrink-0 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Expires</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{item.expirationDate || 'None'}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Days</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{item.daysUntilExpiry ?? 'Open'}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">SKU</p>
          <p className="mt-1 truncate font-body text-[12px] text-foreground/68">{item.sku || item.id}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRestock(item)}
        className="mt-4 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
      >
        <Truck className="h-3.5 w-3.5" strokeWidth={2} />
        Restock
      </button>
    </motion.article>
  );
}

function KitCard({ kit, onRestockKit }) {
  const tone = kit.status === 'Ready' ? 'ready' : 'action';
  return (
    <article className={`rounded-xl border p-4 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip tone={tone}>{kit.status}</StatusChip>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{kit.nurseName}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {kit.area || 'Bay Area'} · {kit.visitsToday || kit.todayVisits || 0} visits
          </p>
        </div>
        <UserCheck className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Items</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{kit.assignedItems?.length || 0}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Missing</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{kit.missing?.length || 0}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Risk</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{kit.risks?.[0] || 'Clear'}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {kit.kitInventory?.slice(0, 6).map((line) => (
          <div key={`${kit.id}-${line.match}`} className="flex items-center justify-between gap-3 rounded-lg border border-foreground/8 bg-background/38 p-3">
            <div className="min-w-0">
              <p className="truncate font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/62">{line.match}</p>
              <p className="mt-0.5 font-body text-[11px] text-foreground/42">
                {line.remaining}/{line.par} kit · {line.centralAvailable} central
              </p>
            </div>
            {line.risk !== 'ready' ? (
              <button
                type="button"
                onClick={() => onRestockKit(kit, line)}
                className="inline-flex min-h-[30px] shrink-0 items-center justify-center rounded-full border border-amber-300/22 bg-amber-300/[0.08] px-3 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200"
              >
                Restock
              </button>
            ) : (
              <StatusChip tone="ready">Ready</StatusChip>
            )}
          </div>
        ))}
      </div>
      {kit.risks?.length > 0 && (
        <div className="mt-3 rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">Hold Reason</p>
          <p className="mt-1 font-body text-[11px] leading-snug text-foreground/42">{kit.risks.join(' · ')}</p>
        </div>
      )}
    </article>
  );
}

function RestockCard({ item, onResolve }) {
  const ordered = item.status === 'Ordered';
  return (
    <article className={`rounded-xl border p-4 ${toneClass(ordered ? 'ready' : item.priority === 'High' ? 'critical' : 'action')}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip tone={ordered ? 'ready' : 'action'}>{item.status}</StatusChip>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{item.name}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {item.qty} {item.unit} · Min {item.minLevel} · {item.supplier || 'Supplier TBD'}
          </p>
        </div>
        <Truck className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
      <p className="mt-3 rounded-lg border border-foreground/8 bg-background/38 p-3 font-body text-[11px] leading-relaxed text-foreground/46">
        {item.reason}
      </p>
      {!ordered && (
        <button
          type="button"
          onClick={() => onResolve(item)}
          className="mt-4 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
        >
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          Ordered
        </button>
      )}
    </article>
  );
}

function DeductionCard({ need, onQueue }) {
  const { visit, deduction } = need;
  const tone = deduction.status === 'Ready' ? 'ready' : 'critical';
  return (
    <article className={`rounded-xl border p-4 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip tone={tone}>{deduction.preview ? 'Preview' : deduction.status}</StatusChip>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{deduction.client}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {deduction.service} · {deduction.nurseName}
          </p>
        </div>
        <ClipboardCheck className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {deduction.lines.map((line) => (
          <div key={`${deduction.id}-${line.match}`} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">{line.status}</p>
            <p className="mt-1 font-body text-[12px] text-foreground/68">{line.qty}x {line.name}</p>
          </div>
        ))}
      </div>
      {deduction.preview && (
        <button
          type="button"
          onClick={() => onQueue(visit)}
          className="mt-4 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
        >
          <Syringe className="h-3.5 w-3.5" strokeWidth={2} />
          Queue
        </button>
      )}
    </article>
  );
}

function StockImpactCard({ item }) {
  const tone = item.risk === 'critical' ? 'critical' : item.risk === 'action' ? 'action' : 'ready';
  return (
    <article className={`rounded-xl border p-4 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip tone={tone}>{item.status}</StatusChip>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{item.name}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {item.consumed} used · {item.remaining} left · Min {item.minLevel}
          </p>
        </div>
        <Package className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
    </article>
  );
}

function NurseKitLineCard({ item, onRestockKit }) {
  const tone = item.risk === 'ready' ? 'ready' : 'action';
  return (
    <article className={`rounded-xl border p-4 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip tone={tone}>{item.status}</StatusChip>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">{item.nurseName}</h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {item.match} · {item.remaining}/{item.par} kit · {item.centralAvailable} central
          </p>
        </div>
        <UserCheck className="h-5 w-5 text-foreground/35" strokeWidth={1.6} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Used</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{item.consumed}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Min</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{item.min}</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Central</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{item.centralAvailable}</p>
        </div>
      </div>
      {item.risk !== 'ready' && (
        <button
          type="button"
          onClick={() => onRestockKit({ id: item.nurseId, nurseName: item.nurseName }, item)}
          className="mt-4 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
        >
          <Truck className="h-3.5 w-3.5" strokeWidth={2} />
          Restock Kit
        </button>
      )}
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
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">Kit Gate</h2>
        </div>
      </div>
      <div className="space-y-2">
        {tower.guardrails.map((rule) => (
          <div key={rule.label || rule} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">
              {rule.label || rule}
            </p>
            {rule.detail && (
              <p className="mt-1 font-body text-[11px] leading-snug text-foreground/42">{rule.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofPanel({ tower }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/46">
          <ShieldCheck className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
        </div>
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Proof</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">No PHI</h2>
        </div>
      </div>
      <div className="space-y-2">
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Ledger</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{tower.deductionLedger.length} deduction records</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Cold Chain</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{tower.cold.length} cold items watched</p>
        </div>
        <div className="rounded-lg border border-foreground/8 bg-background/38 p-3">
          <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/35">Emergency</p>
          <p className="mt-1 font-body text-[12px] text-foreground/68">{tower.emergency.length} emergency items tracked</p>
        </div>
      </div>
    </div>
  );
}

export default function KitControl() {
  const [tower, setTower] = useState(syncAndBuildTower);
  const [note, setNote] = useState('');
  const [view, setView] = useState('items');

  const refresh = () => setTower(syncAndBuildTower());

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('av.local.change', onChange);
    return () => window.removeEventListener('av.local.change', onChange);
  }, []);

  const visibleItems = useMemo(() => (
    [...tower.items].sort((a, b) => (
      Number(b.critical) - Number(a.critical)
      || Number(b.low || b.expiring || b.expired) - Number(a.low || a.expiring || a.expired)
      || a.name.localeCompare(b.name)
    ))
  ), [tower.items]);

  const handleSweep = () => {
    const result = runKitControlSweep({
      inventory: SEED_ITEMS,
      nurses: NURSES,
      visits: buildFieldVisits(),
    });
    setTower(result.tower);
    setNote(`Sweep queued ${result.actions.length}`);
  };

  const handleRestock = (item) => {
    queueKitRestock(item, { reason: item.status || 'Manual restock' });
    setNote(`Restock: ${item.name}`);
    refresh();
  };

  const handleNurseKitRestock = (kit, line) => {
    const entry = queueNurseKitRestock(kit, line);
    setNote(`Nurse kit restock: ${entry.nurseName || kit.nurseName}`);
    refresh();
  };

  const handleResolve = (item) => {
    resolveKitRestock(item.id, 'Kit Control');
    setNote(`Ordered: ${item.name}`);
    refresh();
  };

  const handleDeduction = (visit) => {
    const entry = queueKitDeduction(visit, tower.items);
    syncVisitKitUsage({ inventory: SEED_ITEMS, visits: buildFieldVisits(), actor: 'Kit Control' });
    setNote(`Queued: ${entry.client}`);
    refresh();
  };

  return (
    <AdminShell title="Kits">
      <PageShell embedded
        eyebrow="inventory · kits · deductions"
        title="Kit Control"
        subtitle="Local supply command before Sortly, Acuity, or payroll handoff."
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
              to="/admin/inventory"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/64 transition-colors hover:text-foreground"
            >
              <Package className="h-3.5 w-3.5" strokeWidth={2} />
              Inventory
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
            <Metric label="Ready" value={tower.metrics.readyItems} detail="usable items" icon={CheckCircle2} tone="ready" />
            <Metric label="Low" value={tower.metrics.low} detail="below par" icon={AlertTriangle} tone={metricTone(tower.metrics.low)} />
            <Metric label="Expiry" value={tower.metrics.expiring} detail="watch now" icon={AlertTriangle} tone={metricTone(tower.metrics.expiring, true)} />
            <Metric label="Used" value={tower.metrics.consumed} detail="visit units" icon={Syringe} tone={tower.metrics.consumed ? 'action' : 'default'} />
            <Metric label="Kit Short" value={tower.metrics.nurseKitShort} detail="nurse lines" icon={UserCheck} tone={metricTone(tower.metrics.nurseKitShort)} />
            <Metric label="Restock" value={tower.metrics.restock} detail="open orders" icon={Truck} tone={metricTone(tower.metrics.restock)} />
          </div>

          <StageStrip stages={tower.stageSummaries} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">Control Queue</p>
                  <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
                    {view === 'items' ? 'Items' : view === 'kits' ? 'Kits' : view === 'nurseKit' ? 'Nurse Kit' : view === 'stock' ? 'Stock' : view === 'restock' ? 'Restock' : 'Deductions'}
                  </h2>
                </div>
                <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:w-auto sm:px-0 sm:pb-0">
                  <div className="inline-flex min-w-max rounded-full border border-foreground/10 bg-background/46 p-1">
                  {[
                    ['items', 'Items'],
                    ['kits', 'Kits'],
                    ['nurseKit', 'Nurse Kit'],
                    ['stock', 'Stock'],
                    ['restock', 'Restock'],
                    ['deductions', 'Deductions'],
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

              {view === 'items' && (
                <div className="space-y-3">
                  {visibleItems.map((item) => <ItemCard key={item.id} item={item} onRestock={handleRestock} />)}
                </div>
              )}

              {view === 'kits' && (
                <div className="space-y-3">
                  {tower.kits.map((kit) => <KitCard key={kit.nurseId || kit.nurseName} kit={kit} onRestockKit={handleNurseKitRestock} />)}
                </div>
              )}

              {view === 'nurseKit' && (
                <div className="space-y-3">
                  {tower.nurseKitLines.map((item) => (
                    <NurseKitLineCard key={`${item.nurseId}-${item.itemId}`} item={item} onRestockKit={handleNurseKitRestock} />
                  ))}
                </div>
              )}

              {view === 'restock' && (
                <div className="space-y-3">
                  {tower.restockQueue.length ? tower.restockQueue.map((item) => (
                    <RestockCard key={item.id} item={item} onResolve={handleResolve} />
                  )) : (
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-8 text-center">
                      <p className="font-heading text-3xl uppercase tracking-tight text-foreground">No Restock</p>
                      <p className="mt-1 font-body text-[12px] text-foreground/42">Run sweep or queue an item.</p>
                    </div>
                  )}
                </div>
              )}

              {view === 'stock' && (
                <div className="space-y-3">
                  {tower.stockImpact.length ? tower.stockImpact.map((item) => (
                    <StockImpactCard key={item.itemId} item={item} />
                  )) : (
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-8 text-center">
                      <p className="font-heading text-3xl uppercase tracking-tight text-foreground">No Usage</p>
                      <p className="mt-1 font-body text-[12px] text-foreground/42">Visit usage will appear here.</p>
                    </div>
                  )}
                </div>
              )}

              {view === 'deductions' && (
                <div className="space-y-3">
                  {tower.visitNeeds.map((need) => (
                    <DeductionCard key={need.deduction.id} need={need} onQueue={handleDeduction} />
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <Guardrails tower={tower} />
              <ProofPanel tower={tower} />
              <Link
                to="/admin/field"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Field <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
              <Link
                to="/admin/credentials"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Nurseys Gate <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </aside>
          </div>
        </div>
      </PageShell>
    </AdminShell>
  );
}
