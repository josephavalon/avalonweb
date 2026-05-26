import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import PageShell from '@/components/admin/PageShell';
import { APPOINTMENTS, CLIENTS, INVOICES, SERVICES } from '@/fixtures/adminMockData';
import { PAYMENTS } from '@/fixtures/commandMockData';
import {
  buildFinanceControlTower,
  queueGustoPayrollProof,
  queueMercuryBankingEntry,
  queueQuickBooksSummary,
  resolveMercuryBankingEntry,
  resolveQuickBooksSummary,
  runFinanceControlSweep,
} from '@/lib/platformOps';

const EASE = [0.16, 1, 0.3, 1];

function money(value = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

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

function MoneyCard({ item, onQueueBank, onLandBank, onQueueBooks, onPostBooks }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(item.risk)}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {item.status}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              Mercury {item.bankStatus}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              Books {item.booksStatus}
            </span>
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
            {item.client}
          </h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {item.invoice} · {item.method} · {item.date || 'No date'}
          </p>
        </div>
        <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">
          {money(item.amount)}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(item.paid || item.refund) && item.bankStatus !== 'Landed' && (
          <button
            type="button"
            onClick={() => onQueueBank(item)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            Bank
          </button>
        )}
        {item.bank && item.bank.status !== 'Landed' && (
          <button
            type="button"
            onClick={() => onLandBank(item)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Landed
          </button>
        )}
        {(item.paid || item.refund) && item.booksStatus !== 'Posted' && (
          <button
            type="button"
            onClick={() => onQueueBooks(item)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/42 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58 transition-colors hover:text-foreground"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={2} />
            Books
          </button>
        )}
        {item.books && item.books.status !== 'Posted' && (
          <button
            type="button"
            onClick={() => onPostBooks(item)}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Posted
          </button>
        )}
      </div>
    </motion.article>
  );
}

function PayrollCard({ item, onQueue }) {
  const queued = item.status !== 'Not queued';
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-xl border p-4 ${toneClass(item.status === 'Ready' ? 'action' : queued ? 'ready' : 'action')}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              {item.status}
            </span>
            <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
              PHI excluded
            </span>
          </div>
          <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
            {item.nurseName}
          </h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">
            {item.service} · {item.visitId || item.id}
          </p>
        </div>
        <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">
          {money(item.shiftValue)}
        </p>
      </div>
      {!queued && (
        <button
          type="button"
          onClick={() => onQueue(item)}
          className="mt-4 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          Queue Gusto
        </button>
      )}
    </motion.article>
  );
}

function BooksCard({ item, onPost }) {
  return (
    <article className={`rounded-xl border p-4 ${toneClass(item.status === 'Posted' ? 'ready' : 'action')}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full border border-foreground/12 bg-background/42 px-2 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-foreground/48">
            {item.status}
          </span>
          <h2 className="mt-3 font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
            {item.label}
          </h2>
          <p className="mt-1 font-body text-[12px] text-foreground/52">{item.category} · {item.detail}</p>
        </div>
        <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">{money(item.amount)}</p>
      </div>
      {item.status !== 'Posted' && (
        <button
          type="button"
          onClick={() => onPost(item)}
          className="mt-4 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-300/[0.08] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-transform active:scale-[0.98]"
        >
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          Posted
        </button>
      )}
    </article>
  );
}

function BoundaryPanel({ tower }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.028] p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/46">
          <LockKeyhole className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
        </div>
        <div>
          <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/42">Boundary</p>
          <h2 className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">PHI-Clean</h2>
        </div>
      </div>
      <div className="space-y-2">
        {tower.boundary.map((item) => (
          <div key={item.label} className="rounded-lg border border-foreground/8 bg-background/38 p-3">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62">{item.label}</p>
            <p className="mt-1 font-body text-[11px] leading-snug text-foreground/40">{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-foreground/8 bg-background/38 p-3">
        {tower.contract.map((item) => (
          <p key={item} className="font-body text-[10px] leading-relaxed text-foreground/42">{item}</p>
        ))}
      </div>
    </div>
  );
}

function Ledger({ tower, onLandBank, onPostBooks }) {
  const rows = [
    ...tower.bankingQueue.slice(0, 5).map((item) => ({ ...item, kind: 'Mercury', label: item.client })),
    ...tower.booksQueue.slice(0, 5).map((item) => ({ ...item, kind: 'QuickBooks' })),
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
                <p className="mt-0.5 font-body text-[10px] text-foreground/38">{item.kind} · {money(item.amount)}</p>
              </div>
              <span className="rounded-full border border-foreground/12 px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.14em] text-foreground/42">
                {item.status}
              </span>
            </div>
            {item.status !== 'Landed' && item.kind === 'Mercury' && (
              <button
                type="button"
                onClick={() => onLandBank(item)}
                className="mt-3 inline-flex min-h-[32px] items-center gap-2 rounded-full border border-foreground/12 px-3 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/58 transition-colors hover:text-foreground"
              >
                <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                Landed
              </button>
            )}
            {item.status !== 'Posted' && item.kind === 'QuickBooks' && (
              <button
                type="button"
                onClick={() => onPostBooks(item)}
                className="mt-3 inline-flex min-h-[32px] items-center gap-2 rounded-full border border-foreground/12 px-3 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/58 transition-colors hover:text-foreground"
              >
                <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                Posted
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinanceControl() {
  const [tower, setTower] = useState(() => buildFinanceControlTower({
    payments: PAYMENTS,
    invoices: INVOICES,
    appointments: APPOINTMENTS,
    clients: CLIENTS,
    services: SERVICES,
  }));
  const [note, setNote] = useState('');
  const [view, setView] = useState('money');

  const refresh = () => setTower(buildFinanceControlTower({
    payments: PAYMENTS,
    invoices: INVOICES,
    appointments: APPOINTMENTS,
    clients: CLIENTS,
    services: SERVICES,
  }));

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('av.local.change', onChange);
    return () => window.removeEventListener('av.local.change', onChange);
  }, []);

  const moneyWork = useMemo(() => (
    tower.money.filter((item) => item.pending || item.paid || item.refund).slice(0, 16)
  ), [tower.money]);

  const handleSweep = () => {
    const result = runFinanceControlSweep({
      payments: PAYMENTS,
      invoices: INVOICES,
      appointments: APPOINTMENTS,
      clients: CLIENTS,
      services: SERVICES,
    });
    setTower(result.tower);
    setNote(`Sweep queued ${result.actions.length}`);
  };

  const handleQueueBank = (item) => {
    const entry = queueMercuryBankingEntry({
      sourceId: item.sourceId,
      client: item.client,
      amount: item.refund ? -Math.abs(item.amount) : item.amount,
      type: item.refund ? 'Refund' : 'Payment',
      method: item.method,
    });
    setNote(`Mercury queued: ${entry.client}`);
    refresh();
  };

  const handleLandBank = (item) => {
    const id = item.bank?.id || item.id || item.sourceId;
    resolveMercuryBankingEntry(id, 'Finance Control');
    setNote(`Mercury landed: ${item.client || item.label}`);
    refresh();
  };

  const handleQueueBooks = (item) => {
    const entry = queueQuickBooksSummary({
      sourceId: item.sourceId,
      label: item.invoice || item.client,
      category: item.refund ? 'Refund' : 'Revenue',
      amount: item.refund ? -Math.abs(item.amount) : item.amount,
      detail: `${item.source} · ${item.method}`,
    });
    setNote(`Books queued: ${entry.label}`);
    refresh();
  };

  const handlePostBooks = (item) => {
    const id = item.books?.id || item.id || item.sourceId;
    resolveQuickBooksSummary(id, 'Finance Control');
    setNote(`Books posted: ${item.label || item.invoice || item.client}`);
    refresh();
  };

  const handleQueuePayroll = (item) => {
    queueGustoPayrollProof({
      visitId: item.visitId || item.id,
      nurseName: item.nurseName,
      service: item.service,
      shiftValue: item.shiftValue,
      miles: item.miles,
      reimbursements: item.reimbursements,
      completedAt: item.completedAt,
      chartStatus: 'Acuity closeout complete or admin-ready',
    });
    setNote(`Gusto queued: ${item.nurseName}`);
    refresh();
  };

  return (
    <AdminLayout>
      <PageShell
        eyebrow="Mercury · Gusto · QuickBooks"
        title="Finance Control"
        subtitle="Money moves. Clinical data does not."
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
              to="/provider/accounting"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/64 transition-colors hover:text-foreground"
            >
              <CreditCard className="h-3.5 w-3.5" strokeWidth={2} />
              Payments
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
            <Metric label="Collected" value={money(tower.metrics.collected)} detail="paid/deposited" icon={DollarSign} tone="ready" />
            <Metric label="Pending" value={money(tower.metrics.pending)} detail="not collected" icon={AlertTriangle} tone={tower.metrics.pending ? 'action' : 'ready'} />
            <Metric label="Mercury" value={tower.metrics.bankAction} detail="bank actions" icon={CreditCard} tone={tower.metrics.bankAction ? 'action' : 'ready'} />
            <Metric label="Gusto" value={tower.metrics.payrollReady} detail="payroll proof" icon={Send} tone={tower.metrics.payrollReady ? 'action' : 'ready'} />
            <Metric label="Books" value={tower.metrics.booksAction} detail="QuickBooks lines" icon={FileText} tone={tower.metrics.booksAction ? 'action' : 'ready'} />
            <Metric label="Blocked" value={tower.metrics.blocked} detail="collect first" icon={AlertTriangle} tone={tower.metrics.blocked ? 'critical' : 'ready'} />
          </div>

          <StageStrip stages={tower.stageSummaries} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/38">Work Queue</p>
                  <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground">
                    {view === 'money' ? 'Money' : view === 'payroll' ? 'Payroll' : 'Books'}
                  </h2>
                </div>
                <div className="flex rounded-full border border-foreground/10 bg-background/46 p-1">
                  {[
                    ['money', 'Money'],
                    ['payroll', 'Payroll'],
                    ['books', 'Books'],
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

              {view === 'money' && (
                <div className="space-y-3">
                  {moneyWork.map((item) => (
                    <MoneyCard
                      key={item.sourceId}
                      item={item}
                      onQueueBank={handleQueueBank}
                      onLandBank={handleLandBank}
                      onQueueBooks={handleQueueBooks}
                      onPostBooks={handlePostBooks}
                    />
                  ))}
                </div>
              )}
              {view === 'payroll' && (
                <div className="space-y-3">
                  {tower.payroll.map((item) => (
                    <PayrollCard key={item.visitId || item.id} item={item} onQueue={handleQueuePayroll} />
                  ))}
                </div>
              )}
              {view === 'books' && (
                <div className="space-y-3">
                  {tower.booksQueue.map((item) => (
                    <BooksCard key={item.id} item={item} onPost={handlePostBooks} />
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <BoundaryPanel tower={tower} />
              <Ledger tower={tower} onLandBank={handleLandBank} onPostBooks={handlePostBooks} />
              <Link
                to="/provider/communications"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Comms <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
              <Link
                to="/provider/accounting"
                className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54 transition-colors hover:text-foreground"
              >
                Accounting <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </aside>
          </div>
        </div>
      </PageShell>
    </AdminLayout>
  );
}
