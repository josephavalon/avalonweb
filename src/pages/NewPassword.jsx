// Password update target for both invited staff forced rotation and Supabase
// recovery links. Preferred recovery links carry `?token_hash=...&type=recovery`
// and are verified with verifyOtp() — which needs NO stored PKCE code_verifier,
// so the link works from ANY browser/device. Legacy `?code=` PKCE links are
// still handled as a fallback (auto-exchanged by detectSessionInUrl). See the
// effect below.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { useAuthStore } from '@/lib/useAuthStore';
import { hasSupabase, supabase } from '@/lib/supabase';

const FIELD = 'min-h-[52px] w-full rounded-2xl border border-foreground/14 bg-foreground/[0.045] px-5 font-body text-[16px] font-semibold text-foreground outline-none transition-colors placeholder:text-foreground/25 focus:border-foreground/42';
const LABEL = 'mb-2 block font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/58';

export default function NewPassword() {
  const { user, loading, updatePassword } = useAuthStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exchangeState, setExchangeState] = useState({ busy: false, attempted: false });

  useEffect(() => {
    if (!hasSupabase || user) {
      setExchangeState({ busy: false, attempted: true });
      return undefined;
    }
    const url = new URL(window.location.href);
    const tokenHash = url.searchParams.get('token_hash');
    const otpType = url.searchParams.get('type');

    // Preferred path: token-hash recovery. verifyOtp() needs NO stored PKCE
    // code_verifier, so the link completes from ANY browser/device — unlike the
    // legacy ?code= flow, which only worked if the link was opened in the exact
    // browser window that requested the reset. detectSessionInUrl ignores
    // ?token_hash, so there is no double-exchange / navigator.locks deadlock.
    if (tokenHash && otpType) {
      let active = true;
      setExchangeState({ busy: true, attempted: true });
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: otpType })
        .then(({ error: otpError }) => {
          if (!active) return;
          setExchangeState({ busy: false, attempted: true });
          if (otpError) {
            setError('This reset link is invalid or has expired. Request a new one and try again.');
            return;
          }
          // Success: onAuthStateChange sets `user`, which re-renders the form.
          url.searchParams.delete('token_hash');
          url.searchParams.delete('type');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        })
        .catch(() => {
          if (active) {
            setExchangeState({ busy: false, attempted: true });
            setError('This reset link is invalid or has expired. Request a new one and try again.');
          }
        });
      return () => { active = false; };
    }

    // Fallback: legacy ?code= PKCE links. The Supabase client (flowType 'pkce',
    // detectSessionInUrl: true) auto-exchanges the code and fires
    // onAuthStateChange; we must NOT exchange it ourselves (single-use code +
    // navigator.locks deadlock). Wait for `user`, with a timeout so a stale or
    // cross-browser link surfaces an error instead of spinning forever.
    const hasPkceCode = Boolean(url.searchParams.get('code')) || url.hash.includes('access_token');
    if (!hasPkceCode) {
      setExchangeState({ busy: false, attempted: true });
      return undefined;
    }
    setExchangeState({ busy: true, attempted: true });
    const timer = setTimeout(() => {
      setExchangeState({ busy: false, attempted: true });
      setError('This reset link took too long to open or has expired. Request a new reset link and try again.');
    }, 12000);
    return () => clearTimeout(timer);
  }, [user]);

  const destination = () => {
    if (user?.role === 'admin' || user?.role === 'staff') return '/admin';
    if (user?.role === 'nurse') return '/provider/shift';
    return '/members/dashboard';
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!user) { setError('Open the reset link from your email before setting a new password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.ok) navigate(user?.redirect || destination(), { replace: true });
    else setError(res.error || 'Could not update your password.');
  };

  const waitingForSession = hasSupabase && !user && (loading || exchangeState.busy || !exchangeState.attempted);

  return (
    <div className="av-page-surface flex min-h-dvh items-center justify-center px-5 py-10 text-foreground">
      <div className="w-full max-w-md rounded-[1.9rem] border border-foreground/[0.10] bg-background/68 p-7 shadow-[0_24px_90px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl">
        <div className="mb-6 flex items-center gap-2">
          <AvalonMark className="h-[22px] w-[14px] text-foreground" />
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/40">Security</span>
        </div>
        {waitingForSession ? (
          <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.04] px-4 py-4 text-foreground/65">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            <p className="font-body text-sm font-medium">Opening secure password reset...</p>
          </div>
        ) : !user ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <p className="font-body text-sm font-medium">{error || 'Open the reset link from your email before setting a new password.'}</p>
            </div>
            <Link to="/login" className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-foreground font-body text-sm font-bold uppercase tracking-[0.18em] text-background">
              Back to sign in
            </Link>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-[0.04em]">Set your new password</h1>
            <p className="mt-1 font-body text-sm leading-relaxed text-foreground/62">
              Pick something you'll remember. We sign you in automatically once it's saved, so you won't need to re-enter the link.
            </p>
          </div>
          <div>
            <label className={LABEL}>New password</label>
            <div className="relative">
              <input className={FIELD} type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide' : 'Show'} className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-foreground/45 hover:text-foreground">
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div><label className={LABEL}>Confirm password</label><input className={FIELD} type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" /></div>
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <p className="font-body text-sm font-medium">{error}</p>
            </div>
          )}
          <button type="submit" disabled={busy} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-foreground font-body text-sm font-bold uppercase tracking-[0.18em] text-background transition-opacity disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save & continue
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
