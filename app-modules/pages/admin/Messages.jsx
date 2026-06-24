/**
 * Communications — /admin/messages
 *
 * Send a general, PHI-free text to a client through Quo (api/admin/communications/
 * send-sms). Pick a client from the live bookings feed or type a number, choose a
 * template or write a short message, send. The endpoint enforces the PHI block-
 * list, and this page makes the boundary explicit: SMS is for nudges + payment
 * links, not appointment/clinical detail (that goes by email, or by a consented
 * reminder from the booking row).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Send, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Phone } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet, apiPost } from '@/lib/apiClient';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';

const FIELD_STYLE = { background: BG, color: TEXT, border: '1px solid hsl(var(--foreground) / 0.16)' };

const TEMPLATES = [
  { label: 'Check your email', text: 'Avalon Vitality: you have a new update — please check your email. Reply here with any questions.' },
  { label: 'We replied', text: 'Avalon Vitality: thanks for reaching out! We just replied to your email.' },
  { label: 'Payment link', text: 'Avalon Vitality: here is your secure payment link → ' },
];

export default function Messages() {
  const [clients, setClients] = useState([]);
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const loadClients = useCallback(async () => {
    try {
      const data = await apiGet('/api/admin/bookings');
      const seen = new Set();
      const list = [];
      for (const b of (Array.isArray(data?.bookings) ? data.bookings : [])) {
        const phone = (b.customerPhone || '').trim();
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        list.push({ name: b.customerName && b.customerName !== '—' ? b.customerName : phone, phone });
      }
      setClients(list);
    } catch { /* leave list empty — manual entry still works */ }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const charCount = body.length;
  const segments = Math.max(1, Math.ceil(charCount / 160));

  const send = useCallback(async () => {
    setResult(null);
    setBusy(true);
    try {
      const res = await apiPost('/api/admin/communications/send-sms', { to: to.trim(), body: body.trim() });
      if (res?.ok) {
        setResult({ tone: 'success', message: 'Text sent.' });
        setBody('');
      } else {
        setResult({ tone: 'error', message: res?.error || 'Could not send the text.' });
      }
    } catch (err) {
      setResult({ tone: 'error', message: err?.body?.error || 'Could not send the text.' });
    } finally {
      setBusy(false);
    }
  }, [to, body]);

  const canSend = to.trim() && body.trim() && !busy;

  return (
    <AdminShell title="Communications">
      <div className="min-h-dvh font-body" style={{ background: BG, color: TEXT }}>
        <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
          {/* Compliance note */}
          <div className="mb-6 flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} style={{ color: 'hsl(150 60% 45%)' }} />
            <p className="font-body text-xs leading-relaxed" style={{ color: MUTED }}>
              Texts are for general, non-clinical messages and payment links — no names, appointment times, or visit details
              (those go by email). Clinical content is blocked automatically. To text an actual appointment reminder, use
              <span style={{ color: TEXT }}> Send reminder</span> on a booking where the client has opted in.
            </p>
          </div>

          {/* Recipient */}
          <label className="flex flex-col gap-1">
            <span className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>To (phone)</span>
            <input
              type="tel"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+1 415 555 0100"
              className="min-h-[44px] rounded-xl px-3 font-body text-sm outline-none"
              style={FIELD_STYLE}
            />
          </label>

          {clients.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {clients.map((c) => (
                <button
                  key={c.phone}
                  type="button"
                  onClick={() => setTo(c.phone)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[11px] transition-colors hover:opacity-80"
                  style={{ background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
                >
                  <Phone className="h-3 w-3" strokeWidth={1.8} />{c.name}
                </button>
              ))}
            </div>
          ) : null}

          {/* Templates */}
          <div className="mt-5 flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setBody(t.text)}
                className="rounded-full px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors hover:opacity-80"
                style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Message */}
          <label className="mt-3 flex flex-col gap-1">
            <span className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Keep it short and non-clinical…"
              className="rounded-xl p-3 font-body text-sm outline-none"
              style={FIELD_STYLE}
            />
          </label>
          <p className="mt-1 font-body text-[11px]" style={{ color: DIM }}>{charCount} characters · {segments} segment{segments === 1 ? '' : 's'}</p>

          {result ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: result.tone === 'error' ? 'hsl(0 70% 62%)' : 'hsl(150 60% 45%)' }}>
              {result.tone === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} /> : <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />}
              <span className="font-body text-sm">{result.message}</span>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={!canSend}
              onClick={send}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-opacity disabled:opacity-40"
              style={{ background: TEXT, color: INVERT }}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Send className="h-3.5 w-3.5" strokeWidth={2} />}
              Send text
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
