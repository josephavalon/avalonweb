import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { useAuthStore } from '@/lib/useAuthStore';
import { hasSupabase, supabase } from '@/lib/supabase';
import { apiPost } from '@/lib/apiClient';

function destinationForRole(role) {
  if (role === 'admin' || role === 'staff') return '/admin';
  if (role === 'nurse') return '/provider/shift';
  return '/members/dashboard';
}

function waitForProfileRetry(signal) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(resolve, 300);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      resolve();
    }, { once: true });
  });
}

async function roleForUser(userId, signal) {
  if (!userId) return 'client';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (signal?.aborted) return 'client';
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (data?.role) return data.role;
    } catch {
      // RLS/no row should not strand a client on the callback screen.
    }
    if (attempt < 9) await waitForProfileRetry(signal);
  }
  return 'client';
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshSupabaseSession } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    async function finish() {
      if (!hasSupabase) {
        setError('Sign-in is not configured yet.');
        return;
      }

      try {
        // The Supabase client (flowType 'pkce', detectSessionInUrl: true)
        // exchanges the ?code= itself on load and fires onAuthStateChange. We
        // must NOT also call exchangeCodeForSession here: the code is single-use
        // and the two exchanges deadlock on the navigator.locks auth lock, so
        // the "Finishing sign-in" screen hangs forever. Instead poll getSession
        // until the client's own exchange lands, with a ~6s timeout.
        let session = null;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          if (abortController.signal.aborted) return;
          const { data } = await supabase.auth.getSession();
          session = data?.session || null;
          if (session?.user) break;
          await waitForProfileRetry(abortController.signal);
        }

        const user = session?.user || null;
        if (!user) throw new Error('No Supabase session after auth callback.');
        const appUser = await refreshSupabaseSession();
        const role = appUser?.role || await roleForUser(user.id, abortController.signal);
        // Best-effort welcome email. Server-side dedupe via audit_events; route
        // returns 200 whether send succeeds or not — must never block navigation.
        if (role === 'client') {
          apiPost('/api/auth/welcome-email', {}).catch(() => { /* swallow */ });
        }
        if (active) navigate(destinationForRole(role), { replace: true });
      } catch {
        if (active) setError('Could not finish sign-in. Please try again.');
      }
    }

    finish();
    return () => {
      active = false;
      abortController.abort();
    };
  }, [navigate, refreshSupabaseSession]);

  return (
    <div className="av-page-surface flex min-h-dvh items-center justify-center px-5 py-10 text-foreground">
      <div className="w-full max-w-sm rounded-[1.8rem] border border-foreground/[0.10] bg-background/68 p-7 text-center shadow-[0_24px_90px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl">
        <AvalonMark className="mx-auto h-[28px] w-[18px] text-foreground" />
        {error ? (
          <div className="mt-6">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-red-400/20 bg-red-500/[0.08] text-red-200">
              <AlertCircle className="h-5 w-5" strokeWidth={2} />
            </div>
            <h1 className="font-heading text-3xl uppercase tracking-[0.04em]">Sign-in failed</h1>
            <p className="mt-2 font-body text-sm text-foreground/55">{error}</p>
            <Link
              to="/login"
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-foreground px-5 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-background"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-foreground/60" strokeWidth={2} />
            <h1 className="mt-4 font-heading text-3xl uppercase tracking-[0.04em]">Finishing sign-in</h1>
            <p className="mt-2 font-body text-sm text-foreground/55">You will be redirected automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
