import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useSeo } from '@/lib/seo';

// Stripe redirects here after the reservation deposit.
//
// This page used to render "Your $50 deposit is in" from the URL alone: it read
// `ref` for display, never read `status`, and never asked Stripe. So
// /start/deposit?ref=AV-K4M2-7QTX was a clean, screenshot-able receipt anyone
// could mint. Now the paid state is shown only after api/deposit/verify.js
// confirms the Stripe session Stripe itself stamped into the return URL.
//
// It still reads no account and knows nothing about the person who paid. The
// ref is the random AV-XXXX-XXXX code minted in api/deposit/create-session.js;
// it is the one thread between the payment and the intake, and a human joins it
// in the Stripe dashboard, not our systems.
const REF_RE = /^AV-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const SESSION_ID_RE = /^cs_[A-Za-z0-9_]{8,120}$/;

export default function StartDeposit() {
  const [searchParams] = useSearchParams();
  // 'checking' → 'paid' | 'unconfirmed'. There is no 'error' branch on purpose:
  // anything that is not a confirmed payment must land on the same cautious
  // copy, so a failed lookup can never read as a receipt.
  const [status, setStatus] = useState('checking');
  const [ref, setRef] = useState('');

  useSeo({
    title: status === 'paid' ? 'Deposit Received — Avalon Vitality' : 'Reservation Deposit — Avalon Vitality',
    description: 'Your Avalon Vitality reservation deposit.',
    path: '/start/deposit',
    robots: 'noindex, nofollow',
  });

  const sessionId = useMemo(() => {
    const raw = String(searchParams.get('session_id') || '');
    return SESSION_ID_RE.test(raw) ? raw : '';
  }, [searchParams]);

  useEffect(() => {
    // No session id means this was not a Stripe return — an old link, a shared
    // URL, or someone typing it. Nothing to verify, so nothing to claim.
    if (!sessionId) {
      setStatus('unconfirmed');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/deposit/verify?session_id=${encodeURIComponent(sessionId)}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.paid) {
          // The ref comes from the verified session, never from the query
          // string, so the code on screen is the one in the Stripe dashboard.
          const verified = String(data.ref || '').toUpperCase();
          setRef(REF_RE.test(verified) ? verified : '');
          setStatus('paid');
        } else {
          setStatus('unconfirmed');
        }
      } catch {
        if (!cancelled) setStatus('unconfirmed');
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="nd-flow app-shell min-h-[100svh] bg-background text-foreground">
      <main className="mx-auto w-full max-w-xl px-5 pb-24 pt-16 md:px-8 md:pt-24">
        {status === 'paid' && <div className="nd-request-received__mark" aria-hidden="true"><Check /></div>}

        <h1 className="mt-6 font-heading text-[4.25rem] uppercase leading-none tracking-tight text-foreground md:text-[6rem]">
          {status === 'checking' && 'One moment'}
          {status === 'paid' && 'Reserved'}
          {status === 'unconfirmed' && 'Almost there'}
        </h1>

        {status === 'checking' && (
          <p className="mt-5 font-body text-lg font-medium leading-[1.45] text-foreground" aria-live="polite">
            Confirming your deposit with our payment provider…
          </p>
        )}

        {status === 'paid' && (
          <p className="mt-5 font-body text-lg font-medium leading-[1.45] text-foreground">
            Your $50 deposit is in. It applies to your visit, and it&apos;s refunded
            if you turn out not to be eligible.
          </p>
        )}

        {status === 'unconfirmed' && (
          <p className="mt-5 font-body text-lg font-medium leading-[1.45] text-foreground">
            We couldn&apos;t confirm a deposit for this link. If you just paid, give
            it a moment and refresh — otherwise your request is still in, and we&apos;ll
            call to confirm the details either way.
          </p>
        )}

        {status === 'paid' && ref && (
          <div className="mt-8 rounded-[2rem] border border-foreground/[0.10] px-6 py-5 md:px-8 md:py-7">
            <p className="av-mono text-[11px] uppercase tracking-[0.12em] text-foreground/50">
              Your reservation code
            </p>
            <p className="mt-3 av-mono text-[1.5rem] uppercase tracking-[0.08em] text-foreground md:text-[1.75rem]">
              {ref}
            </p>
            <p className="mt-3 font-body text-[13px] font-medium leading-snug text-foreground/55">
              Give this to your care team when they call — it&apos;s how they match
              your payment to your request.
            </p>
          </div>
        )}

        {status !== 'checking' && (
          <p className="mt-8 font-body text-base font-medium leading-relaxed text-foreground/65">
            We&apos;ll call to confirm the details, same day between 8am and 8pm.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            to="/protocols"
            className="group inline-flex items-center gap-2 border-b border-foreground/30 pb-1 font-body text-[1.0625rem] font-medium text-foreground transition-colors duration-base ease-editorial hover:border-foreground"
          >
            Menu
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-base ease-editorial group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
          <Link
            to="/"
            className="group inline-flex items-center gap-2 font-body text-[1.0625rem] font-medium text-foreground/60 transition-colors duration-base ease-editorial hover:text-foreground"
          >
            Return home
          </Link>
        </div>
      </main>
    </div>
  );
}
