import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Operator-tier MFA gate. RequireAuth renders this (instead of the admin app)
 * when VITE_MFA_ENFORCED is on and the admin/staff session is not yet AAL2.
 *
 * Two paths, chosen automatically:
 *   - ENROLL: no verified TOTP factor → show a QR + secret, the user adds it to
 *     an authenticator app, enters the 6-digit code, and we verify (which both
 *     confirms the factor AND steps the session up to AAL2).
 *   - CHALLENGE: a verified TOTP factor exists → just ask for the current code.
 *
 * On success the session is AAL2; we reload so RequireAuth re-reads it and the
 * gate clears. Lockout-safe: the gate only appears once enforcement is flipped
 * on, and enrollment is always reachable from here.
 */
export default function MfaGate() {
  const [mode, setMode] = useState('loading'); // loading | enroll | challenge | error
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const init = useCallback(async () => {
    if (!supabase) { setError('Authentication is not configured.'); setMode('error'); return; }
    setError('');
    try {
      const { data: factors, error: lf } = await supabase.auth.mfa.listFactors();
      if (lf) throw lf;
      const totp = (factors?.totp || []).find((f) => f.status === 'verified');
      if (totp) {
        const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (ce) throw ce;
        setFactorId(totp.id);
        setChallengeId(ch.id);
        setMode('challenge');
      } else {
        // Clean up any half-finished unverified enrollment so enroll() doesn't 422.
        const stale = (factors?.totp || []).find((f) => f.status !== 'verified');
        if (stale) { try { await supabase.auth.mfa.unenroll({ factorId: stale.id }); } catch { /* best effort */ } }
        const { data: en, error: ee } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (ee) throw ee;
        setFactorId(en.id);
        setQr(en.totp?.qr_code || '');
        setSecret(en.totp?.secret || '');
        setMode('enroll');
      }
    } catch (err) {
      setError(err?.message || 'Could not start multi-factor setup.');
      setMode('error');
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      let chId = challengeId;
      if (mode === 'enroll') {
        const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId });
        if (ce) throw ce;
        chId = ch.id;
      }
      const { error: ve } = await supabase.auth.mfa.verify({ factorId, challengeId: chId, code: code.replace(/\s+/g, '') });
      if (ve) throw ve;
      window.location.reload();
    } catch (err) {
      setError(err?.message || 'That code did not verify. Check your authenticator and try again.');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background px-4 py-10">
      <div className="av-glass-card w-full max-w-md rounded-[1.4rem] border bg-background/85 p-6 backdrop-blur-2xl md:p-8">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-foreground" strokeWidth={2} />
          <h1 className="font-heading text-2xl uppercase leading-none tracking-normal text-foreground">Secure your access</h1>
        </div>

        {mode === 'loading' && (
          <p className="flex items-center gap-2 font-body text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing multi-factor setup…
          </p>
        )}

        {mode === 'enroll' && (
          <div className="space-y-4">
            <p className="font-body text-sm leading-relaxed text-foreground/70">
              Admin access requires a second factor. Scan this with an authenticator app (1Password, Google Authenticator, Authy), then enter the 6-digit code.
            </p>
            {qr && (
              <div className="flex justify-center rounded-2xl bg-white p-3">
                <img src={qr} alt="MFA QR code" className="h-44 w-44" />
              </div>
            )}
            {secret && (
              <p className="break-all text-center font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/45">
                Can&apos;t scan? Key: {secret}
              </p>
            )}
          </div>
        )}

        {mode === 'challenge' && (
          <p className="font-body text-sm leading-relaxed text-foreground/70">
            Enter the current 6-digit code from your authenticator app to continue.
          </p>
        )}

        {(mode === 'enroll' || mode === 'challenge') && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, '')); setError(''); }}
              placeholder="123456"
              autoFocus
              className="w-full rounded-xl border border-foreground/16 bg-foreground/[0.05] px-4 py-3 text-center font-body text-2xl font-bold tracking-[0.4em] text-foreground outline-none focus:border-foreground/42"
            />
            {error && <p className="font-body text-sm font-medium text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.length < 6}
              className="flex min-h-[46px] w-full items-center justify-between rounded-full bg-foreground px-5 font-body text-xs font-bold uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/88 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>{busy ? 'Verifying' : 'Verify & continue'}</span>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" strokeWidth={2} />}
            </button>
          </form>
        )}

        {mode === 'error' && (
          <div className="space-y-4">
            <p className="font-body text-sm font-medium text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => { setMode('loading'); init(); }}
              className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
