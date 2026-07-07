/**
 * "Create your own event" builder submissions (Where / When / Who).
 *
 * Admit info only — setting, date, headcounts, contact email. Nothing
 * medical is asked or accepted (amendment F). Delivery is an internal
 * email via Resend; with no key configured it degrades to a logged
 * placeholder per the repo's placeholder rule, still returning ok so the
 * builder UX can be exercised end-to-end before credentials land.
 */
import { Resend } from 'resend';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';

const INTERNAL_TO = 'littonjose@gmail.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const count = (v, max) => Math.min(Math.max(parseInt(v, 10) || 0, 0), max);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const limit = await checkRateLimit({ key: `events-host-inquiry:${clientIp(req)}`, windowMs: 600_000, max: 5 });
  if (!limit.ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = clean(body.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'A valid email is required.' });
    }
    const services = Array.isArray(body.services)
      ? body.services.slice(0, 12).map((s) => clean(s, 40)).filter(Boolean)
      : [];
    const inquiry = {
      where: clean(body.where, 160) || 'Not specified',
      date: clean(body.date, 40) || 'Flexible',
      eventType: clean(body.eventType, 40),
      guestRange: clean(body.guestRange, 20),
      guests: count(body.guests, 5000),
      ivDrips: count(body.ivDrips, 500),
      shots: count(body.shots, 2000),
      services,
      email,
    };

    const lines = [
      'New event inquiry from the /events planner:',
      '',
      `Where:  ${inquiry.where}`,
      `When:   ${inquiry.date}`,
      `Event type: ${inquiry.eventType || 'Not specified'}`,
      `Guests: ${inquiry.guestRange || inquiry.guests || 'Not specified'}`,
      `Services: ${inquiry.services.join(', ') || 'Not specified'}`,
      inquiry.ivDrips || inquiry.shots ? `IV drips: ${inquiry.ivDrips} · Recovery shots: ${inquiry.shots}` : null,
      `Contact: ${inquiry.email}`,
    ].filter(Boolean).join('\n');

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Avalon Events <support@avalonvitality.co>',
        to: INTERNAL_TO,
        replyTo: inquiry.email,
        subject: `Event inquiry — ${inquiry.where} · ${inquiry.date}`,
        text: lines,
      });
    } else {
      console.log('[events-host-inquiry] placeholder mode (no RESEND_API_KEY):\n' + lines);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[events-host-inquiry]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Something went wrong — try again.' });
  }
}
