import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QueueBoard, { useBoard } from '@/components/events/QueueBoard';
import { EVENT_TONES, MONO_STACK } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

/**
 * /events/:slug/kiosk — the iPad sign-in sheet (blueprint §6.3.1).
 *
 * Privacy on a shared device (eng review 12A + blueprint):
 *  - one field per screen, no back navigation into a previous guest's answers
 *  - 90-second idle auto-reset, wipe after done, autofill/suggestions off
 *  - submit failures retry from MEMORY ONLY — nothing is ever persisted here
 * The kiosk is the sign-up sheet, never the exam: it stores queue position +
 * phone only. Intake happens with the NP (Acuity-direct mode until the
 * on-site type is wired). Idle state = the departures board.
 */

const IDLE_RESET_MS = 90_000;
const DONE_RESET_MS = 12_000;

const STEPS = ['name', 'phone', 'interest', 'consent', 'done'];

/* Module-level so its identity is stable across renders — a render-scoped
   component remounts its subtree every state change and kiosk inputs lose
   focus on each keystroke (code review P1). */
function Screen({ children, showStartOver, onStartOver }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-8 py-16">
      {children}
      {showStartOver ? (
        <button type="button" onClick={onStartOver} className="mx-auto mt-10 rounded-full border border-white/14 px-6 py-3 text-sm uppercase text-foreground/60" style={{ fontFamily: MONO_STACK, letterSpacing: '0.1em' }}>
          Start over
        </button>
      ) : null}
    </div>
  );
}

export default function EventKiosk() {
  const { slug = '' } = useParams();
  const { board, walkUpGfe, eventName, stale } = useBoard(slug, { intervalMs: 15000 });
  const [step, setStep] = useState('idle');
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', serviceInterest: 'iv', smsOptIn: true, boardOptOut: false });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const idleTimer = useRef(null);

  const wipe = useCallback(() => {
    setForm({ firstName: '', lastName: '', phone: '', serviceInterest: 'iv', smsOptIn: true, boardOptOut: false });
    setResult(null);
    setError('');
    setRetrying(false);
    setStep('idle');
  }, []);

  // 90s idle reset on any step except idle; done screen resets faster.
  useEffect(() => {
    clearTimeout(idleTimer.current);
    if (step === 'idle') return undefined;
    idleTimer.current = setTimeout(wipe, step === 'done' ? DONE_RESET_MS : IDLE_RESET_MS);
    return () => clearTimeout(idleTimer.current);
  }, [step, form, wipe]);

  useSeo({
    title: 'Sign in — Avalon Recovery Lounge',
    description: 'Join the recovery lounge queue.',
    path: `/events/${slug}/kiosk`,
    robots: 'noindex,nofollow',
  });

  async function submit(attempt = 0) {
    setError('');
    setRetrying(attempt > 0);
    try {
      const res = await fetch('/api/events/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...form }),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) throw new Error(body.error || 'Sign-in failed.');
      setResult(body);
      setStep('done');
    } catch (err) {
      // Zero-PHI retry: in-memory only, visible state, then a staff signal.
      if (attempt < 2) {
        setTimeout(() => submit(attempt + 1), 1800);
        setRetrying(true);
      } else {
        setError('We could not reach the clinical team’s system. Grab any Avalon team member — they will sign you in directly.');
        setRetrying(false);
      }
    }
  }

  const inputClass = 'mt-6 w-full rounded-2xl border border-white/14 px-6 py-6 text-center font-body text-3xl font-semibold text-foreground outline-none focus:border-foreground/40';
  const inputStyle = { background: 'rgba(13,13,13,0.8)' };
  const bigButton = 'mt-8 w-full rounded-full bg-foreground py-6 font-body text-xl font-bold uppercase text-background disabled:opacity-50';

  // Walk-up GFE OFF → concierge exit, no override anywhere in the UI (§6.2.4).
  if (step !== 'idle' && !walkUpGfe) {
    return (
      <div className="min-h-screen bg-black text-foreground">
        <Screen showStartOver={step !== 'idle' && step !== 'done'} onStartOver={wipe}>
          <p className="text-center font-heading text-6xl uppercase leading-none">Tonight is experience only</p>
          <p className="mt-6 text-center font-body text-xl text-foreground/65">
            IV sign-ups are closed at this event — but we come to you, any day.
          </p>
          <p className="mt-8 text-center text-lg" style={{ fontFamily: MONO_STACK, color: EVENT_TONES.live, letterSpacing: '0.08em' }}>
            AVALONVITALITY.CO/BOOK — WE DELIVER CARE
          </p>
          <button type="button" onClick={wipe} className={bigButton}>Back to the board</button>
        </Screen>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-black text-foreground"
      /* Both handlers: pointerdown for instant response on real touch, click as
         the universal fallback (synthetic events, exotic input devices). */
      onPointerDown={() => { if (step === 'idle') setStep('name'); }}
      onClick={() => { if (step === 'idle') setStep('name'); }}
    >
      {step === 'idle' ? (
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-8 py-14">
          <QueueBoard rows={board} large title="THE LOUNGE" subtitle={`${(eventName || 'AVALON RECOVERY').toUpperCase()} · LIVE QUEUE`} stale={stale} />
          <p className="mt-12 animate-pulse text-center text-xl" style={{ fontFamily: MONO_STACK, color: EVENT_TONES.live, letterSpacing: '0.12em' }}>
            TAP ANYWHERE TO JOIN — 90 SECONDS
          </p>
        </div>
      ) : null}

      {step === 'name' ? (
        <Screen showStartOver={step !== 'idle' && step !== 'done'} onStartOver={wipe}>
          <p className="text-center text-sm uppercase text-foreground/50" style={{ fontFamily: MONO_STACK, letterSpacing: '0.16em' }}>Step 1 of 4</p>
          <p className="mt-4 text-center font-heading text-6xl uppercase leading-none">What's your name?</p>
          <input className={inputClass} style={inputStyle} value={form.firstName} placeholder="First name"
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            autoComplete="off" autoCorrect="off" spellCheck={false} autoFocus />
          <input className={inputClass} style={inputStyle} value={form.lastName} placeholder="Last name"
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            autoComplete="off" autoCorrect="off" spellCheck={false} />
          <button type="button" disabled={!form.firstName.trim()} onClick={() => setStep('phone')} className={bigButton}>Next</button>
        </Screen>
      ) : null}

      {step === 'phone' ? (
        <Screen showStartOver={step !== 'idle' && step !== 'done'} onStartOver={wipe}>
          <p className="text-center text-sm uppercase text-foreground/50" style={{ fontFamily: MONO_STACK, letterSpacing: '0.16em' }}>Step 2 of 4</p>
          <p className="mt-4 text-center font-heading text-6xl uppercase leading-none">Your mobile number</p>
          <p className="mt-4 text-center font-body text-lg text-foreground/60">It holds your place in line. Only the clinical team sees it.</p>
          <input className={inputClass} style={{ ...inputStyle, fontFamily: MONO_STACK }} value={form.phone} placeholder="(415) 555-0100"
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            inputMode="tel" autoComplete="off" autoFocus />
          <button type="button" disabled={form.phone.replace(/\D/g, '').length < 10} onClick={() => setStep('interest')} className={bigButton}>Next</button>
        </Screen>
      ) : null}

      {step === 'interest' ? (
        <Screen showStartOver={step !== 'idle' && step !== 'done'} onStartOver={wipe}>
          <p className="text-center text-sm uppercase text-foreground/50" style={{ fontFamily: MONO_STACK, letterSpacing: '0.16em' }}>Step 3 of 4</p>
          <p className="mt-4 text-center font-heading text-6xl uppercase leading-none">What are you here for?</p>
          <div className="mt-8 grid gap-4">
            {[
              ['iv', 'IV DRIP', 'BACK ON THE FLOOR ~30–45 MIN'],
              ['shots', 'SHOT BAR', 'BACK ON THE FLOOR ~5–10 MIN'],
            ].map(([key, label, sub]) => (
              <button key={key} type="button"
                onClick={() => { setForm((f) => ({ ...f, serviceInterest: key })); setStep('consent'); }}
                className={`rounded-[1.35rem] border p-8 text-left transition ${form.serviceInterest === key ? 'border-foreground' : 'border-white/14'}`}
                style={{ background: 'rgba(13,13,13,0.8)' }}>
                <span className="block font-heading text-4xl uppercase">{label}</span>
                <span className="mt-2 block text-sm text-foreground/55" style={{ fontFamily: MONO_STACK, letterSpacing: '0.08em' }}>{sub}</span>
              </button>
            ))}
          </div>
        </Screen>
      ) : null}

      {step === 'consent' ? (
        <Screen showStartOver={step !== 'idle' && step !== 'done'} onStartOver={wipe}>
          <p className="text-center text-sm uppercase text-foreground/50" style={{ fontFamily: MONO_STACK, letterSpacing: '0.16em' }}>Step 4 of 4</p>
          <p className="mt-4 text-center font-heading text-6xl uppercase leading-none">Almost in.</p>
          <button type="button" onClick={() => setForm((f) => ({ ...f, smsOptIn: !f.smsOptIn }))}
            className={`mt-8 w-full rounded-[1.35rem] border p-6 text-left ${form.smsOptIn ? 'border-foreground' : 'border-white/14'}`}
            style={{ background: 'rgba(13,13,13,0.8)' }}>
            <span className="block font-body text-xl font-semibold">{form.smsOptIn ? '✓ ' : ''}Text me updates about my place in line</span>
            <span className="mt-1 block text-xs text-foreground/50" style={{ fontFamily: MONO_STACK }}>OPTIONAL · MSG RATES MAY APPLY · TEXTS SAY "YOU'RE UP", NEVER ANYTHING ELSE</span>
          </button>
          <button type="button" onClick={() => setForm((f) => ({ ...f, boardOptOut: !f.boardOptOut }))}
            className={`mt-4 w-full rounded-[1.35rem] border p-6 text-left ${form.boardOptOut ? 'border-foreground' : 'border-white/14'}`}
            style={{ background: 'rgba(13,13,13,0.8)' }}>
            <span className="block font-body text-xl font-semibold">{form.boardOptOut ? '✓ ' : ''}Keep my initials off the lounge board</span>
          </button>
          {error ? <p className="mt-6 text-center font-body text-lg text-foreground/80">{error}</p> : null}
          <button type="button" onClick={() => submit(0)} disabled={retrying} className={bigButton}>
            {retrying ? 'Hold on — retrying…' : "I'm in"}
          </button>
        </Screen>
      ) : null}

      {step === 'done' && result ? (
        <Screen showStartOver={step !== 'idle' && step !== 'done'} onStartOver={wipe}>
          <p className="text-center font-heading text-7xl uppercase leading-none" style={{ color: EVENT_TONES.live }}>You're in.</p>
          <p className="mt-8 text-center text-3xl" style={{ fontFamily: MONO_STACK, letterSpacing: '0.06em' }}>
            №{result.entry?.position} · {result.entry?.initials}
          </p>
          <p className="mt-6 text-center font-body text-xl leading-relaxed text-foreground/70">
            {result.result === 'already_in_line'
              ? 'You were already in line — same spot, no double-up.'
              : 'Watch the lounge board for your initials — go enjoy the event.'}
          </p>
          <p className="mt-4 text-center text-sm text-foreground/45" style={{ fontFamily: MONO_STACK, letterSpacing: '0.1em' }}>
            {result.entry?.ahead != null ? `${result.entry.ahead} AHEAD OF YOU · ` : ''}THIS SCREEN RESETS ITSELF
          </p>
        </Screen>
      ) : null}
    </div>
  );
}
