// Password update target for both invited staff forced rotation and Supabase
// recovery links. Recovery links arrive with a PKCE `?code=` before the app has
// a session; the Supabase client exchanges it via detectSessionInUrl and fires
// onAuthStateChange, so this page only waits for that session (it must NOT
// exchange the single-use code itself — see the effect below).
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { useAuthStore } from '@/lib/useAuthStore';
import { hasSupabase } from '@/lib/supabase';

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
    const hasRecoveryToken = Boolean(url.searchParams.get('code')) || url.hash.includes('access_token');
    if (!hasRecoveryToken) {
      setExchangeState({ busy: false, attempted: true });
      return undefined;
    }
    // The Supabase client (flowType 'pkce', detectSessionInUrl: true) exchanges
    // the recovery ?code= itself on load and fires onAuthStateChange, which sets
    // `user`. We must NOT also call exchangeCodeForSession here: the code is
    // single-use and both exchanges contend for the same navigator.locks auth
    // lock, deadlocking so neither resolves — that left this page spinning on
    // "Opening secure password reset..." forever. Instead wait for `user` to
    // appear, with a timeout so a stale/invalid link surfaces an error.
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
            <h1 className="font-heading text-3xl uppercase tracking-[0.04em]">Choose a new password</h1>
            <p className="mt-1 font-body text-sm text-foreground/55">Your account is using a temporary password. Set your own to continue.</p>
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
