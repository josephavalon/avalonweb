// Public review capture page (/review?t=<token>). No login.
// The customer arrives from the post-visit survey email, picks 1-10 NPS,
// optionally writes a sentence, and optionally consents to share publicly.
// On submit → POST /api/reviews/submit. Shows a thank-you state on success.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';

const TOKEN_PATTERN = /^[a-f0-9]{32,80}$/i;
const MAX_TEXT_LEN = 2000;

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function ScorePicker({ value, onChange, disabled }) {
  // 0..10 NPS scale. 0 + 10 are both meaningful endpoints; render as 11 chips.
  // Color cue follows the standard NPS bands (0-6 detractor / 7-8 passive / 9-10 promoter).
  const chips = Array.from({ length: 11 }, (_, i) => i);
  return (
    <div>
      <div className="grid grid-cols-11 gap-1.5">
        {chips.map((n) => {
          const active = value === n;
          const band =
            n <= 6 ? 'border-red-500/30 text-red-200'
            : n <= 8 ? 'border-amber-500/30 text-amber-200'
            : 'border-emerald-500/30 text-emerald-200';
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              aria-pressed={active}
              aria-label={`${n} out of 10`}
              className={`h-11 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 ${active ? 'border-foreground bg-foreground text-background' : `bg-foreground/[0.04] hover:bg-foreground/[0.08] ${band}`}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-body text-[11px] uppercase tracking-[0.16em] text-foreground/45">
        <span>Not at all</span>
        <span>Extremely likely</span>
      </div>
    </div>
  );
}

export default function Review() {
  const [params] = useSearchParams();
  const token = (params.get('t') || '').trim();
  const tokenValid = useMemo(() => TOKEN_PATTERN.test(token), [token]);

  const [score, setScore] = useState(null);
  const [text, setText] = useState('');
  const [allowPublic, setAllowPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState(tokenValid ? 'form' : 'invalid'); // form | done | invalid | already

  useEffect(() => {
    if (!tokenValid) setPhase('invalid');
  }, [tokenValid]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (score == null) {
      setError('Please pick a score between 0 and 10.');
      return;
    }
    setBusy(true);
    try {
      const { ok, status, data } = await postJson('/api/reviews/submit', {
        token,
        score,
        text: text.slice(0, MAX_TEXT_LEN),
        allow_public: allowPublic,
      });
      if (ok) {
        setPhase('done');
        return;
      }
      if (status === 409) {
        setPhase('already');
        return;
      }
      if (status === 400 && data?.code === 'invalid_token') {
        setPhase('invalid');
        return;
      }
      setError(data?.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="av-page-surface flex min-h-dvh items-center justify-center px-5 py-12 text-foreground">
      <div className="w-full max-w-xl rounded-[1.9rem] border border-foreground/[0.10] bg-background/68 p-7 shadow-[0_24px_90px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl">
        <div className="mb-6 flex items-center gap-2">
          <AvalonMark className="h-[22px] w-[14px] text-foreground" />
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/40">Avalon Vitality</span>
        </div>

        {phase === 'invalid' && (
          <div className="py-2">
            <h1 className="mb-3 font-heading text-3xl uppercase tracking-[0.04em] text-foreground">This link isn't valid</h1>
            <p className="font-body text-sm text-foreground/70">
              The review link is invalid or has expired. If you'd still like to share feedback, write to <a className="inline-flex min-h-[44px] items-center underline" href="mailto:support@avalonvitality.co">support@avalonvitality.co</a>.
            </p>
          </div>
        )}

        {phase === 'already' && (
          <div className="py-2">
            <h1 className="mb-3 font-heading text-3xl uppercase tracking-[0.04em] text-foreground">You already responded</h1>
            <p className="font-body text-sm text-foreground/70">
              Thanks — we've got your review on file. If something's changed, write to <a className="inline-flex min-h-[44px] items-center underline" href="mailto:support@avalonvitality.co">support@avalonvitality.co</a>.
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="py-2 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" strokeWidth={1.6} />
            <h1 className="mb-2 font-heading text-3xl uppercase tracking-[0.04em] text-foreground">Thank you</h1>
            <p className="font-body text-sm text-foreground/70">
              Your feedback is in. We read every one — it shapes how we show up.
            </p>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={submit} className="space-y-6">
            <div>
              <h1 className="font-heading text-3xl uppercase tracking-[0.04em] text-foreground">How was your visit?</h1>
              <p className="mt-1 font-body text-sm text-foreground/55">It takes under a minute. Your honest answer helps us get better.</p>
            </div>

            <div>
              <label className="mb-3 block font-body text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">
                On a scale of 0 to 10, how likely are you to recommend Avalon?
              </label>
              <ScorePicker value={score} onChange={setScore} disabled={busy} />
            </div>

            <div>
              <label htmlFor="review-text" className="mb-2 block font-body text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">
                Anything you'd like to add? (optional)
              </label>
              <textarea
                id="review-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={busy}
                maxLength={MAX_TEXT_LEN}
                rows={4}
                placeholder="A sentence or two about your experience…"
                className="w-full rounded-2xl border border-foreground/14 bg-foreground/[0.045] px-4 py-3 font-body text-base text-foreground placeholder:text-foreground/35 focus:border-foreground/30 focus:outline-none"
              />
              <p className="mt-1 text-right font-body text-[11px] text-foreground/40">{text.length}/{MAX_TEXT_LEN}</p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
              <input
                type="checkbox"
                checked={allowPublic}
                onChange={(e) => setAllowPublic(e.target.checked)}
                disabled={busy}
                className="mt-1 h-4 w-4 accent-foreground"
              />
              <span className="font-body text-sm text-foreground/75">
                OK to share publicly on avalonvitality.co (first name only — we never publish full names, email, or any visit detail).
              </span>
            </label>

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-body text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || score == null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.18em] text-background transition-opacity disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              Submit review
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
