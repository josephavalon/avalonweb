import { useState } from 'react';
import { ArrowRight, CalendarDays, Eye, EyeOff, FileText, Headset, Loader2, Lock, Receipt, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { invoiceFieldClass } from './InvoiceRows';

/**
 * The nurse login card — the single gate to /invoice.
 *
 * The credential check is entirely server-side (api/invoice/unlock.js); nothing
 * here compares anything. On success the server's short-lived token goes into
 * sessionStorage — not localStorage, so a shared phone or iPad doesn't stay
 * unlocked after the tab closes. That is also why there is no "remember me".
 */
export const INVOICE_TOKEN_KEY = 'av.invoice.token';

const SUPPORT_TEL = '+14159807708';
const SUPPORT_DISPLAY = '(415) 980-7708';

// Only claims the form actually delivers. A row promising pay-period history
// would be advertising a screen that does not exist.
const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Submit shifts',
    body: 'Log your hours and shift details.',
  },
  {
    icon: Receipt,
    title: 'Expenses',
    body: 'Add reimbursements alongside your pay.',
  },
  {
    icon: FileText,
    title: 'Pay periods',
    body: 'Invoice a whole date range at once.',
  },
];

function FieldIcon({ icon: Icon }) {
  return (
    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40">
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </span>
  );
}

export default function InvoiceUnlock({ onUnlocked }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);

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
    <div className="overflow-hidden rounded-[2rem] border border-foreground/[0.10] bg-background shadow-[0_20px_60px_-30px_rgba(43,33,27,0.35)]">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: what this is for. Ordered second on mobile so the fields are
            reachable without scrolling past three explanatory rows. */}
        <div className="order-2 flex flex-col justify-center px-6 py-9 md:px-12 md:py-14 lg:order-1">
          <h1 className="font-heading uppercase tracking-tight text-foreground text-[3.25rem] leading-[0.86] md:text-[4.5rem]">
            Nurse Login
          </h1>
          <div className="mt-6 h-[4px] w-24 rounded-full bg-foreground" aria-hidden="true" />
          <p className="mt-7 font-body text-[17px] leading-[1.5] text-foreground/75 md:text-[18px]">
            Sign in to submit your shifts and expenses for the pay period.
          </p>

          <ul className="mt-10 grid gap-7">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-foreground">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="pt-1">
                  <p className="font-body text-[15px] font-bold uppercase tracking-[0.06em] text-foreground">
                    {title}
                  </p>
                  <p className="mt-1 font-body text-[15px] leading-[1.45] text-foreground/60">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: the form. */}
        <form
          noValidate
          onSubmit={handleSubmit}
          className="order-1 flex flex-col justify-center border-foreground/[0.10] px-6 py-9 md:px-12 md:py-14 lg:order-2 lg:border-l"
        >
          <div>
            <label
              className="font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground/70"
              htmlFor="invoice-username"
            >
              Username
            </label>
            <div className="relative mt-2">
              <FieldIcon icon={User} />
              <input
                id="invoice-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="Enter your username"
                required
                className={cn(invoiceFieldClass, 'pl-12')}
              />
            </div>
          </div>

          <div className="mt-5">
            <label
              className="font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground/70"
              htmlFor="invoice-password"
            >
              Password
            </label>
            <div className="relative mt-2">
              <FieldIcon icon={Lock} />
              <input
                id="invoice-password"
                name="password"
                type={revealed ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="Enter your password"
                required
                className={cn(invoiceFieldClass, 'pl-12 pr-12')}
              />
              <button
                type="button"
                onClick={() => setRevealed((current) => !current)}
                aria-label={revealed ? 'Hide password' : 'Show password'}
                aria-pressed={revealed}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-foreground/45 transition-colors hover:text-foreground"
              >
                {revealed ? (
                  <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />
                )}
              </button>
            </div>
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
          {error ? (
            <p role="alert" className="mt-4 font-body text-[14px] text-red-600">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={status === 'submitting'}
            className="mt-7 h-14 w-full justify-between rounded-2xl px-6 font-body text-[15px] font-semibold uppercase tracking-[0.08em]"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
                Signing in…
                <span className="w-[18px]" aria-hidden="true" />
              </>
            ) : (
              <>
                <Lock className="h-[18px] w-[18px]" strokeWidth={2} />
                Sign in
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
              </>
            )}
          </Button>

          <div className="mt-9 flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-foreground/[0.12]" />
            <span className="font-body text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground/50">
              Need help?
            </span>
            <span className="h-px flex-1 bg-foreground/[0.12]" />
          </div>

          <a
            href={`tel:${SUPPORT_TEL}`}
            className="mt-5 flex items-center gap-4 rounded-2xl px-2 py-2 transition-colors hover:bg-foreground/[0.04]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-foreground">
              <Headset className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span>
              <span className="block font-body text-[15px] text-foreground">Contact support</span>
              <span className="block av-mono text-[15px] tabular-nums text-foreground/70">
                {SUPPORT_DISPLAY}
              </span>
            </span>
          </a>
        </form>
      </div>
    </div>
  );
}
