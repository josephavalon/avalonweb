import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { Button } from '@/components/ui/button';
import { invoiceFieldClass, invoiceLabelClass } from './InvoiceRows';

/**
 * The nurse login card. Mounted in two places:
 *   /nurse-login  — the menu destination, then hands off to /invoice
 *   /invoice      — the same gate, for anyone who lands there directly
 *
 * The credential check is entirely server-side (api/invoice/unlock.js); nothing
 * here compares anything. On success the server's short-lived token goes into
 * sessionStorage — not localStorage, so a shared iPad doesn't stay unlocked.
 */
export const INVOICE_TOKEN_KEY = 'av.invoice.token';

export const UNLOCK_CARD_CLASS =
  'rounded-[2rem] border border-foreground/[0.10] bg-background px-5 py-6 shadow-[0_20px_60px_-30px_rgba(43,33,27,0.35)] md:px-8 md:py-8';

export default function InvoiceUnlock({ onUnlocked, blurb }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus('submitting');
    setError('');

    try {
      const response = await fetch('/api/invoice/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: String(data.get('username') || ''),
          password: String(data.get('password') || ''),
          website: String(data.get('website') || ''),
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.token) {
        setStatus('idle');
        setError(payload?.error || 'Incorrect username or password.');
        return;
      }

      try {
        window.sessionStorage.setItem(INVOICE_TOKEN_KEY, payload.token);
      } catch {
        /* private mode — the token still lives in memory for this session */
      }
      onUnlocked(payload.token);
    } catch {
      setStatus('idle');
      setError('Network error. Please try again.');
    }
  }

  return (
    <form noValidate className={UNLOCK_CARD_CLASS} onSubmit={handleSubmit}>
      <div className="flex items-center gap-2 text-foreground">
        <AvalonMark className="h-7 w-7" />
        <span className="font-heading uppercase tracking-tight text-[1.15rem]">
          Avalon Vitality
        </span>
      </div>

      <h1 className="mt-6 font-heading uppercase tracking-tight text-foreground text-[3rem] leading-[0.88] md:text-[3.75rem]">
        Nurse Login
      </h1>
      <div className="mt-4 h-[3px] w-14 rounded-full bg-foreground/25" aria-hidden="true" />
      <p className="mt-5 font-body text-[15px] leading-[1.55] text-foreground/70">
        {blurb || 'Sign in to submit your shifts and expenses for the pay period.'}
      </p>

      <div className="mt-7">
        <label className={invoiceLabelClass} htmlFor="invoice-username">
          Username
        </label>
        <input
          id="invoice-username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          required
          className={invoiceFieldClass}
        />
      </div>

      <div className="mt-4">
        <label className={invoiceLabelClass} htmlFor="invoice-password">
          Password
        </label>
        <input
          id="invoice-password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          required
          className={invoiceFieldClass}
        />
      </div>

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-px w-px opacity-0"
      />

      {/* text-red-400 from the shared formStyles is too light on cream. */}
      {error ? <p className="mt-3 font-body text-[13px] text-red-600">{error}</p> : null}

      <Button type="submit" size="lg" disabled={status === 'submitting'} className="mt-6 w-full gap-2">
        {status === 'submitting' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" /> Sign in
          </>
        )}
      </Button>
    </form>
  );
}
