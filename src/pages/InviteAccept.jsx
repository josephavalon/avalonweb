// Public invite-acceptance page (/invite/accept). Arrives via the email magic
// link (?token=) or by typing the email + 6-digit code from an SMS. Validates
// the invite, then lets the new staff member set a password. On success they're
// sent to /admin/login to sign in.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';

const FIELD = 'min-h-[52px] w-full rounded-2xl border border-foreground/14 bg-foreground/[0.045] px-5 font-body text-[16px] font-semibold text-foreground outline-none transition-colors placeholder:text-foreground/25 focus:border-foreground/42';
const LABEL = 'mb-2 block font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/58';
const ROLE_LABEL = { admin: 'Full Admin', staff: 'Staff' };

async function postJson(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Something went wrong.');
  return data;
}

export default function InviteAccept() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [phase, setPhase] = useState(token ? 'validating' : 'enter-code'); // validating | enter-code | set-password | done
  const [invite, setInvite] = useState(null); // { email, role }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Manual entry (SMS path)
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  // Password
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const data = await postJson('/api/invite/validate', { token });
        if (active) { setInvite({ email: data.email, role: data.role }); setPhase('set-password'); }
      } catch (err) {
        if (active) { setError(err.message); setPhase('enter-code'); }
      }
    })();
    return () => { active = false; };
  }, [token]);

  const validateCode = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = await postJson('/api/invite/validate', { email: email.trim(), code: code.trim() });
      setInvite({ email: data.email, role: data.role }); setPhase('set-password');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const payload = token ? { token, password } : { email: email.trim() || invite?.email, code: code.trim(), password };
      await postJson('/api/invite/accept', payload);
      setPhase('done');
      setTimeout(() => navigate('/admin/login'), 2200);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="av-page-surface flex min-h-dvh items-center justify-center px-5 py-10 text-foreground">
      <div className="w-full max-w-md rounded-[1.9rem] border border-foreground/[0.10] bg-background/68 p-7 shadow-[0_24px_90px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl">
        <div className="mb-6 flex items-center gap-2">
          <AvalonMark className="h-[22px] w-[14px] text-foreground" />
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/40">Admin Invite</span>
        </div>

        {phase === 'validating' && (
          <div className="flex items-center gap-2 py-10 text-foreground/60"><Loader2 className="h-4 w-4 animate-spin" /> Verifying your invite…</div>
        )}

        {phase === 'done' && (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" strokeWidth={1.6} />
            <h1 className="font-heading text-3xl uppercase tracking-[0.04em]">Welcome to Avalon</h1>
            <p className="mt-2 font-body text-sm leading-relaxed text-foreground/62">Account ready. Routing you to sign in now.</p>
            <Link to="/admin/login" className="mt-4 inline-block font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground">Go to sign in</Link>
          </div>
        )}

        {phase === 'enter-code' && (
          <form onSubmit={validateCode} className="space-y-4">
            <div>
              <h1 className="font-heading text-3xl uppercase tracking-[0.04em]">Confirm it's you</h1>
              <p className="mt-1 font-body text-sm leading-relaxed text-foreground/62">
                We sent a 6-digit code to your invite email. Enter both to claim your Avalon account.
              </p>
            </div>
            <div><label className={LABEL}>Email</label><input className={FIELD} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@avalon.co" /></div>
            <div><label className={LABEL}>6-digit code</label><input className={FIELD} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" /></div>
            {error && <ErrorRow message={error} />}
            <SubmitBtn busy={busy} idle="Continue" />
          </form>
        )}

        {phase === 'set-password' && (
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <h1 className="font-heading text-3xl uppercase tracking-[0.04em]">Set your password</h1>
              <p className="mt-1 font-body text-sm leading-relaxed text-foreground/62">
                Signing in as <span className="font-bold text-foreground/80">{invite?.email}</span> · {ROLE_LABEL[invite?.role] || invite?.role}. Pick a password you'll use to access the {ROLE_LABEL[invite?.role] || 'admin'} console.
              </p>
            </div>
            <div>
              <label className={LABEL}>Password</label>
              <div className="relative">
                <input className={FIELD} type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide' : 'Show'} className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-foreground/45 hover:text-foreground">
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div><label className={LABEL}>Confirm password</label><input className={FIELD} type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" /></div>
            {error && <ErrorRow message={error} />}
            <SubmitBtn busy={busy} idle="Create account" />
          </form>
        )}
      </div>
    </div>
  );
}

function ErrorRow({ message }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 text-red-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
      <p className="font-body text-sm font-medium">{message}</p>
    </div>
  );
}

function SubmitBtn({ busy, idle }) {
  return (
    <button type="submit" disabled={busy} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-foreground font-body text-sm font-bold uppercase tracking-[0.18em] text-background transition-opacity disabled:opacity-50">
      {busy && <Loader2 className="h-4 w-4 animate-spin" />} {idle}
    </button>
  );
}
