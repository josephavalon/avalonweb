import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Sparkles } from 'lucide-react';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';
import { apiGet } from '@/lib/apiClient';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';

function sourceLabel(source = '') {
  if (source === 'membership_initial_grant') return 'Membership credit';
  if (source === 'membership_renewal_grant') return 'Renewal credit';
  if (source === 'iv_credit_redemption') return 'IV redeemed';
  if (source === 'admin_adjustment') return 'Adjustment';
  return source.replace(/_/g, ' ') || 'Credit activity';
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Memberships() {
  useSeo({
    title: 'Memberships - Avalon Vitality',
    description: 'Your Avalon membership credits and rollover balance.',
    path: '/members/memberships',
    robots: 'noindex, nofollow',
  });
  const [state, setState] = useState({ loading: true, error: '', balance: 0, ledger: [] });

  useEffect(() => { try { applyTheme(); } catch { /* noop */ } }, []);
  useEffect(() => {
    let active = true;
    apiGet('/api/me/credits')
      .then((data) => {
        if (!active) return;
        setState({
          loading: false,
          error: '',
          balance: Math.max(0, Number(data?.balance || 0)),
          ledger: Array.isArray(data?.ledger) ? data.ledger : [],
        });
      })
      .catch(() => {
        if (!active) return;
        setState({ loading: false, error: 'Could not load membership credits.', balance: 0, ledger: [] });
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="av-page-surface min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body text-foreground">
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/members/dashboard" className="inline-flex items-center gap-2 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/72 transition-colors hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} /> Dashboard
          </Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/34">Member</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pt-6">
        <MemberSectionNav />
      </div>

      <section className="mx-auto mt-6 w-full max-w-5xl px-4">
        <div className="rounded-[1.75rem] border border-foreground/[0.10] bg-foreground/[0.045] p-6 shadow-[0_28px_80px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl sm:p-10">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/45">Membership</p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-heading text-[3.6rem] uppercase leading-[0.86] tracking-normal text-foreground sm:text-[5rem]">
                {state.loading ? '-' : state.balance}
              </h1>
              <p className="mt-2 font-body text-sm font-bold uppercase tracking-[0.16em] text-foreground/58">
                IV credit{state.balance === 1 ? '' : 's'} available
              </p>
            </div>
            <Link
              to="/book"
              className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-full bg-foreground px-6 font-body text-xs font-bold uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/88"
            >
              Redeem for IV <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
          <p className="mt-5 max-w-2xl font-body text-sm leading-relaxed text-foreground/62">
            Membership credits roll over forever. Each membership checkout or paid renewal adds one IV credit; eligible IV bookings can redeem one credit at checkout.
          </p>
          {state.error && (
            <p className="mt-4 rounded-2xl border border-amber-300/22 bg-amber-300/[0.07] px-4 py-3 font-body text-sm font-bold text-amber-100">
              {state.error}
            </p>
          )}
        </div>

        <div className="mt-4 rounded-[1.25rem] border border-foreground/[0.10] bg-foreground/[0.035] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-3xl uppercase leading-none">Activity</h2>
            <Sparkles className="h-5 w-5 text-foreground/54" strokeWidth={1.8} />
          </div>
          <div className="mt-4 divide-y divide-foreground/[0.08]">
            {state.ledger.length ? state.ledger.map((row) => (
              <div key={row.id} className="flex min-h-[58px] items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-extrabold text-foreground">{sourceLabel(row.source)}</p>
                  <p className="mt-0.5 font-body text-xs text-foreground/48">{formatDate(row.createdAt)}</p>
                </div>
                <span className={`shrink-0 font-heading text-2xl uppercase leading-none ${Number(row.units || 0) > 0 ? 'text-foreground' : 'text-foreground/54'}`}>
                  {Number(row.units || 0) > 0 ? '+' : ''}{row.units}
                </span>
              </div>
            )) : (
              <p className="py-6 text-center font-body text-sm text-foreground/54">
                {state.loading ? 'Loading credit activity.' : 'No credit activity yet.'}
              </p>
            )}
          </div>
        </div>
      </section>

      <MemberBottomNav />
    </main>
  );
}
