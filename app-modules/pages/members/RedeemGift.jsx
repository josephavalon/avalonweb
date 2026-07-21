import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Gift as GiftIcon, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';
import { apiPost } from '@/lib/apiClient';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';

// Reuses the same neutral token palette as the other member pages so this
// screen drops into the section nav without restyling.
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';

function money(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Mirror api/_lib/gift-cards.js#normalizeCode for the input mask. The server
// re-normalizes too, so this is purely UX (typed dashes/lower-case → clean).
function maskCode(input = '') {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  const groups = [];
  for (let i = 0; i < raw.length; i += 4) {
    groups.push(raw.slice(i, i + 4));
  }
  return groups.join('-');
}

export default function RedeemGift() {
  useSeo({ title: 'Redeem Gift Card — Avalon Vitality', description: 'Apply an Avalon gift card to your account.', path: '/members/redeem' });
  useEffect(() => { applyTheme('member'); }, []);

  const [searchParams] = useSearchParams();
  // Allow ?code=ABCD-... so the gift email's CTA drops the recipient here with
  // the code already filled. They still have to click Redeem so we never
  // silently spend a credit on page-load.
  const initialCode = maskCode(searchParams.get('code') || '');
  const [code, setCode] = useState(initialCode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setCode(maskCode(e.target.value));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (code.replace(/-/g, '').length !== 16) {
      setError('Codes are 16 characters. Check the email and try again.');
      return;
    }
    setSubmitting(true);
    try {
      const body = await apiPost('/api/gift-cards/redeem', { code });
      setResult(body);
      setCode('');
    } catch (err) {
      setError(err?.message || 'We could not redeem that code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--background))', color: TEXT }}>
      <main className="mx-auto max-w-3xl px-4 pb-32 pt-8 md:pt-12">
        {/* Back to dashboard (matches other member sub-pages). */}
        <Link
          to="/members/dashboard"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: MUTED }}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>

        <div className="mt-4">
          <MemberSectionNav />
        </div>

        <header className="mt-8 mb-6">
          <h1 className="font-heading text-3xl md:text-4xl uppercase leading-[0.95]">Redeem a Gift Card</h1>
          <p className="mt-2 font-body text-sm" style={{ color: MUTED }}>
            Enter the 16-character code from your gift email. We'll apply the credit to your Avalon account — book a visit whenever you're ready.
          </p>
        </header>

        {result ? (
          // Success: show the credit amount + units and a CTA into the
          // booking flow. The credit is already in the ledger at this point;
          // we don't need to refetch a balance to display it.
          <section
            className="rounded-2xl p-6 md:p-8"
            style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 mt-0.5" style={{ color: 'hsl(140 30% 60%)' }} />
              <div className="flex-1">
                <p className="font-heading text-xl uppercase tracking-wide">Gift Applied</p>
                <p className="mt-1 font-body text-sm" style={{ color: MUTED }}>
                  We added <strong style={{ color: TEXT }}>{money(result.amountCents)}</strong> of Avalon credit ({result.units} visit{result.units === 1 ? '' : 's'}) to your account.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/members/book"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 font-body text-[12px] font-bold uppercase tracking-[0.18em]"
                style={{ background: TEXT, color: 'hsl(var(--background))' }}
              >
                Book a Visit
              </Link>
              <Link
                to="/members/billing"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border px-5 font-body text-[12px] font-bold uppercase tracking-[0.18em]"
                style={{ borderColor: BORDER, color: TEXT, background: CARD }}
              >
                View Billing
              </Link>
            </div>
          </section>
        ) : (
          <section
            className="rounded-2xl p-6 md:p-8"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="gift-code" className="block font-body text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
                  Gift Code
                </label>
                <input
                  id="gift-code"
                  type="text"
                  autoComplete="off"
                  inputMode="text"
                  spellCheck={false}
                  autoCapitalize="characters"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={code}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-xl border px-4 py-4 font-mono text-lg tracking-[0.18em] focus:outline-none"
                  style={{
                    background: 'hsl(var(--background))',
                    borderColor: BORDER,
                    color: TEXT,
                  }}
                />
                <p className="mt-2 font-body text-[12px]" style={{ color: DIM }}>
                  Codes are case-insensitive — dashes are optional.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border px-4 py-3 font-body text-sm"
                  style={{ borderColor: 'hsl(0 70% 62% / 0.4)', background: 'hsl(0 70% 62% / 0.08)', color: 'hsl(0 70% 70%)' }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || code.replace(/-/g, '').length !== 16}
                className="inline-flex w-full min-h-[52px] items-center justify-center gap-2 rounded-full font-body text-[12px] font-bold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: TEXT, color: 'hsl(var(--background))' }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Redeeming…
                  </>
                ) : (
                  <>
                    <GiftIcon className="h-4 w-4" /> Apply Gift Code
                  </>
                )}
              </button>

              <p className="font-body text-[12px] leading-relaxed" style={{ color: DIM }}>
                A code can only be redeemed once. Once applied, the credit lives on this account and can be spent on any Avalon visit.
              </p>
            </form>
          </section>
        )}
      </main>
      <MemberBottomNav />
    </div>
  );
}
