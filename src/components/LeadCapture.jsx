import React, { useState } from 'react';
import { track } from '@/lib/analytics';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Webstore lead capture → Mailchimp (/api/mailchimp-subscribe).
// Conversion-focused: short, one field, instant success state.
export default function LeadCapture({
  heading = 'Recovery, on your schedule.',
  subcopy = 'Join the list for launch access and member offers.',
  source = 'footer',
  className = '',
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setStatus('error'); return; }
    setStatus('loading');
    track?.('lead_capture_submitted', { source });
    try {
      const r = await fetch('/api/mailchimp-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        setStatus('done');
        track?.('lead_capture_succeeded', { source });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className={className}>
        <p className="font-heading text-xl uppercase leading-none">You&rsquo;re on the list.</p>
        <p className="mt-2 font-body text-[12px] text-foreground/55">We&rsquo;ll be in touch with launch access.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={className}>
      {heading && <p className="font-heading text-xl uppercase leading-none">{heading}</p>}
      {subcopy && <p className="mt-2 font-body text-[12px] text-foreground/55">{subcopy}</p>}
      <div className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor={`lead-${source}`}>Email address</label>
        <input
          id={`lead-${source}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
          placeholder="you@email.com"
          className="min-h-[48px] flex-1 rounded-full border border-foreground/15 bg-foreground/[0.03] px-5 font-body text-sm text-foreground outline-none focus:border-foreground/40"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="min-h-[48px] shrink-0 rounded-full bg-foreground px-6 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-background disabled:opacity-60"
        >
          {status === 'loading' ? '…' : 'Join'}
        </button>
      </div>
      {status === 'error' && (
        <p className="mt-2 font-body text-[11px] text-foreground/55">Enter a valid email and try again.</p>
      )}
    </form>
  );
}
