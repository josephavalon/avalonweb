import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FileText, Loader2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/apiClient';
import { assertApiResponse, hasObjectRows, invalidApiResponse } from '@/lib/apiResponse';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { useSeo } from '@/lib/seo';

const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents || 0) / 100);

export default function NurseInvoices() {
  useSeo({
    title: 'My Invoices — Avalon Vitality',
    description: 'Review contractor invoices submitted to Avalon.',
    path: '/provider/invoices',
    robots: 'noindex, nofollow, noarchive',
  });
  const [state, setState] = useState({ loading: true, error: '', invoices: [] });
  const load = useCallback(async () => {
    try {
      const data = await apiGet('/api/me/nurse-invoices');
      assertApiResponse(data, { arrays: ['invoices'] }, 'Finance returned an invalid invoice response.');
      if (!hasObjectRows(data.invoices, ['id', 'invoice_number', 'status'])) {
        throw invalidApiResponse('Finance returned invalid invoice records.');
      }
      setState({ loading: false, error: '', invoices: data.invoices });
    }
    catch (error) { setState({ loading: false, error: error.message, invoices: [] }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!state.loading && state.error) {
    return (
      <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
        <section className="mx-auto max-w-4xl">
          <OperationalSourceUnavailable
            title="Invoice source unavailable"
            description="Your submitted invoices could not be verified. No invoice records are shown, and invoice-history actions remain disabled until the live source reconnects."
          />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <section className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3"><Link to="/provider/shifts" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]"><ArrowLeft className="h-4 w-4" />Shifts</Link><Link to="/invoice" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-xs font-bold uppercase tracking-[0.14em] text-background"><Plus className="h-4 w-4" />New invoice</Link></div>
        <div className="mt-10"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Contractor pay</p><h1 className="font-heading text-5xl uppercase">Invoices</h1></div>
        {state.error ? <p role="alert" className="mt-5 rounded-2xl bg-red-500/10 p-4 text-red-700">{state.error}</p> : null}
        {state.loading ? <p className="mt-8 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading invoices</p> : null}
        <div className="mt-6 grid gap-3">
          {state.invoices.map((invoice) => <article key={invoice.id} className="grid gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/45">{invoice.invoice_number}</p><p className="mt-1 text-sm">{invoice.period_start} – {invoice.period_end}</p><span className="mt-2 inline-flex rounded-full border border-foreground/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">{invoice.status.replace(/_/g, ' ')}</span>{invoice.review_note ? <p className="mt-3 text-sm text-foreground/60">{invoice.review_note}</p> : null}</div><p className="font-heading text-3xl">{money(invoice.total_cents)}</p></article>)}
          {!state.loading && !state.invoices.length ? <div className="rounded-3xl border border-dashed border-foreground/15 p-10 text-center"><FileText className="mx-auto h-6 w-6 text-foreground/35" /><p className="mt-3 text-sm text-foreground/50">No submitted invoices yet.</p></div> : null}
        </div>
      </section>
    </main>
  );
}
