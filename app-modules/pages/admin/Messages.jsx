/**
 * Communications — /admin/messages
 *
 * Admin-initiated client messaging over two channels:
 *   • Text  → Quo SMS  (api/admin/communications/send-sms)
 *   • Email → Resend   (api/admin/communications/send-email)
 *
 * Pick a client from the live bookings feed or type a recipient, choose a
 * template or write a message, send. Both channels are PHI-free: the server
 * refuses clinical/appointment content (no names+times+services). For an actual
 * appointment reminder, use "Send reminder" on a booking where the client opted
 * in.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Send, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Phone, Mail, MessageSquare, Inbox as InboxIcon } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet, apiPost } from '@/lib/apiClient';
import { InboxPanel } from './Inbox';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';

const FIELD_STYLE = { background: BG, color: TEXT, border: '1px solid hsl(var(--foreground) / 0.16)' };

const TEMPLATES = {
  sms: [
    { label: 'Check your email', text: 'Avalon Vitality: you have a new update — please check your email. Reply here with any questions.' },
    { label: 'We replied', text: 'Avalon Vitality: thanks for reaching out! We just replied to your email.' },
    { label: 'Payment link', text: 'Avalon Vitality: here is your secure payment link → ' },
  ],
  email: [
    { label: 'Check your portal', subject: 'A new update from Avalon Vitality', text: 'Hi,\n\nYou have a new update from Avalon Vitality. Please sign in to your account to view the details.\n\n— The Avalon Vitality Team' },
    { label: 'Following up', subject: 'Following up — Avalon Vitality', text: 'Hi,\n\nJust following up on your message. Reply any time and we’ll help.\n\n— The Avalon Vitality Team' },
    { label: 'Payment link', subject: 'Your Avalon Vitality payment link', text: 'Hi,\n\nHere is your secure payment link:\n\n\n\nReply with any questions.\n\n— The Avalon Vitality Team' },
  ],
};

export default function Messages() {
  const [clients, setClients] = useState([]);
  const [channel, setChannel] = useState('sms');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
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
        const email = (b.customerEmail || '').trim();
        const key = `${phone}|${email}`;
        if ((!phone && !email) || seen.has(key)) continue;
        seen.add(key);
        list.push({ name: b.customerName && b.customerName !== '—' ? b.customerName : (email || phone), phone, email });
      }
      setClients(list);
    } catch { /* leave empty — manual entry still works */ }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const isEmail = channel === 'email';
  const charCount = body.length;
  const segments = Math.max(1, Math.ceil(charCount / 160));

  const switchChannel = (next) => {
    if (next === channel) return;
    setChannel(next);
    setTo('');
    setResult(null);
  };

  const applyTemplate = (t) => {
    setBody(t.text);
    if (isEmail && t.subject) setSubject(t.subject);
  };

  const send = useCallback(async () => {
    setResult(null);
    setBusy(true);
    try {
      const res = isEmail
        ? await apiPost('/api/admin/communications/send-email', { to: to.trim(), subject: subject.trim(), body: body.trim() })
        : await apiPost('/api/admin/communications/send-sms', { to: to.trim(), body: body.trim() });
      if (res?.ok) {
        setResult({ tone: 'success', message: isEmail ? 'Email sent.' : 'Text sent.' });
        setBody('');
      } else {
        setResult({ tone: 'error', message: res?.error || 'Could not send the message.' });
      }
    } catch (err) {
      setResult({ tone: 'error', message: err?.body?.error || 'Could not send the message.' });
    } finally {
      setBusy(false);
    }
  }, [isEmail, to, subject, body]);

  const canSend = to.trim() && body.trim() && !busy;
  const ChannelBtn = ({ id, icon: Icon, label }) => (
    <button
      type="button"
      onClick={() => switchChannel(id)}
      className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl font-body text-[11px] font-bold uppercase tracking-[0.14em] transition-colors"
      style={channel === id ? { background: TEXT, color: INVERT } : { background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />{label}
    </button>
  );

  return (
    <AdminShell title="Communications">
      <div className="min-h-dvh font-body" style={{ background: BG, color: TEXT }}>
        <div className={`mx-auto px-4 py-6 md:px-8 md:py-10 ${channel === 'inbox' ? 'max-w-6xl' : 'max-w-3xl'}`}>
          {/* Tabs: Text / Email compose, Inbox conversations */}
          <div className="mb-5 flex gap-2">
            <ChannelBtn id="sms" icon={MessageSquare} label="Text" />
            <ChannelBtn id="email" icon={Mail} label="Email" />
            <ChannelBtn id="inbox" icon={InboxIcon} label="Inbox" />
          </div>

          {channel === 'inbox' ? <InboxPanel /> : (<>
          {/* Compliance note */}
          <div className="mb-6 flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} style={{ color: 'hsl(150 60% 45%)' }} />
            <p className="font-body text-xs leading-relaxed" style={{ color: MUTED }}>
              {isEmail ? 'Email' : 'Text'} is for general, non-clinical messages and payment links — no appointment times or visit
              details (clinical content is blocked automatically). To send an actual appointment reminder, use
              <span style={{ color: TEXT }}> Send reminder</span> on a booking where the client has opted in.
            </p>
          </div>

          {/* Recipient */}
          <label className="flex flex-col gap-1">
            <span className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>{isEmail ? 'To (email)' : 'To (phone)'}</span>
            <input
              type={isEmail ? 'email' : 'tel'}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={isEmail ? 'name@email.com' : '+1 415 555 0100'}
              className="min-h-[44px] rounded-xl px-3 font-body text-sm outline-none"
              style={FIELD_STYLE}
            />
          </label>

          {clients.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {clients
                .filter((c) => (isEmail ? c.email : c.phone))
                .map((c) => (
                  <button
                    key={`${c.phone}|${c.email}`}
                    type="button"
                    onClick={() => setTo(isEmail ? c.email : c.phone)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[11px] transition-colors hover:opacity-80"
                    style={{ background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}
                  >
                    {isEmail ? <Mail className="h-3 w-3" strokeWidth={1.8} /> : <Phone className="h-3 w-3" strokeWidth={1.8} />}{c.name}
                  </button>
                ))}
            </div>
          ) : null}

          {/* Subject (email only) */}
          {isEmail ? (
            <label className="mt-4 flex flex-col gap-1">
              <span className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="A message from Avalon Vitality"
                className="min-h-[44px] rounded-xl px-3 font-body text-sm outline-none"
                style={FIELD_STYLE}
              />
            </label>
          ) : null}

          {/* Templates */}
          <div className="mt-5 flex flex-wrap gap-1.5">
            {TEMPLATES[channel].map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => applyTemplate(t)}
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
              rows={isEmail ? 7 : 4}
              placeholder="Keep it short and non-clinical…"
              className="rounded-xl p-3 font-body text-sm outline-none"
              style={FIELD_STYLE}
            />
          </label>
          {!isEmail ? (
            <p className="mt-1 font-body text-[11px]" style={{ color: DIM }}>{charCount} characters · {segments} segment{segments === 1 ? '' : 's'}</p>
          ) : null}

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
              {isEmail ? 'Send email' : 'Send text'}
            </button>
          </div>
          </>)}
        </div>
      </div>
    </AdminShell>
  );
}
