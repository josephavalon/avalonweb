import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet } from '@/lib/apiClient';

const money = (cents, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(cents || 0) / 100);

export default function OperationalAccounting() {
  const [range, setRange] = useState('month');
  const [state, setState] = useState({ loading: true, error: '', accounts: [], journals: [], metrics: {} });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try { const data = await apiGet(`/api/admin/operational-accounting?range=${range}`); setState({ loading: false, error: '', accounts: data.accounts || [], journals: data.journals || [], metrics: data.metrics || {} }); }
    catch (error) { setState((current) => ({ ...current, loading: false, error: error.message })); }
  }, [range]);
  useEffect(() => { load(); }, [load]);
  const metrics = state.metrics;
  return (
    <AdminShell title="Accounting">
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Double-entry operations</p><h1 className="font-heading text-4xl uppercase">Operational ledger</h1></div><div className="flex gap-2"><select value={range} onChange={(event) => setRange(event.target.value)} className="min-h-10 rounded-full border border-foreground/10 bg-background px-4 text-xs font-bold uppercase"><option value="month">This month</option><option value="quarter">This quarter</option><option value="year">This year</option><option value="all">All time</option></select><button type="button" onClick={load} className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10" aria-label="Refresh ledger"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} /></button></div></header>
        {state.error ? <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-700">{state.error}</p> : null}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[['Revenue', metrics.revenueCents], ['Expenses', metrics.expenseCents], ['Net income', metrics.netIncomeCents], ['Cash clearing', metrics.cashCents], ['Accounts payable', metrics.accountsPayableCents]].map(([label, value]) => <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/45">{label}</p><p className="mt-2 font-heading text-3xl">{money(value)}</p></div>)}</div>
        <div className={`flex items-center gap-2 rounded-2xl border p-4 text-sm ${metrics.balanced ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700' : 'border-red-500/20 bg-red-500/[0.06] text-red-700'}`}>{metrics.balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}Trial balance: {money(metrics.debitsCents)} debits / {money(metrics.creditsCents)} credits</div>
        <section className="rounded-2xl border border-foreground/10 p-4"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4" /><h2 className="font-heading text-3xl uppercase">Chart activity</h2></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-[9px] uppercase tracking-[0.16em] text-foreground/40"><tr><th className="py-2">Account</th><th>Type</th><th className="text-right">Normal balance</th></tr></thead><tbody className="divide-y divide-foreground/[0.06]">{state.accounts.map((account) => <tr key={`${account.accountCode}-${account.currency}`}><td className="py-3"><strong>{account.accountCode}</strong> · {account.accountName}</td><td className="capitalize text-foreground/55">{account.accountType}</td><td className="text-right font-semibold">{money(account.balanceCents, account.currency)}</td></tr>)}</tbody></table></div></section>
        <section><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">Automatic postings</p><h2 className="font-heading text-3xl uppercase">Journal</h2><div className="mt-3 grid gap-3">{state.journals.map((journal) => <article key={journal.id} className="rounded-2xl border border-foreground/10 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{journal.memo || journal.sourceType}</p><p className="mt-1 text-xs text-foreground/45">{new Date(journal.occurredAt).toLocaleString()} · {journal.sourceType} · {journal.sourceId}</p></div><p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/45">{journal.lines.length} lines</p></div><div className="mt-3 grid gap-1">{journal.lines.map((line, index) => <div key={`${journal.id}-${line.accountCode}-${line.direction}-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-xl bg-foreground/[0.035] px-3 py-2 text-xs"><span>{line.accountCode} · {line.accountName}</span><span className="uppercase text-foreground/45">{line.direction}</span><strong>{money(line.amountCents, journal.currency)}</strong></div>)}</div></article>)}{state.loading ? <p className="flex items-center gap-2 p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading ledger</p> : null}{!state.loading && !state.journals.length ? <p className="rounded-2xl border border-dashed border-foreground/15 p-10 text-center text-sm text-foreground/45">No Square or invoice postings in this period.</p> : null}</div></section>
      </div>
    </AdminShell>
  );
}
