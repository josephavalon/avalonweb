/**
 * /api/admin/support-tickets — staff/admin moderation for the public support
 * queue (see api/support.js + migration 033). The full message body lives in
 * Supabase (BAA-covered), so it is safe to return here for the operator tier.
 *
 *   GET  ?status=open|resolved → list tickets in either bucket.
 *   POST { ticketId, action: 'resolve'|'reopen', note? }
 *        'resolve' → status='resolved', stamp resolved_at/resolver_id/note.
 *        'reopen'  → status='open', clear resolved_at/resolver_id.
 *   Both write an audit_event ('support_ticket_resolved' / '..._reopened').
 *
 * If the support_tickets table is absent (migration 033 not applied), GET
 * returns an empty list with tablePresent:false and POST returns 503
 * migration_required — same graceful degradation as deletion-requests.js.
 */
import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode } from '../_lib/safe-error.js';

let _tablePresent = null;
async function hasTable(db) {
  if (_tablePresent !== null) return _tablePresent;
  try {
    const { error } = await db.from('support_tickets').select('id').limit(1);
    _tablePresent = !error;
  } catch {
    _tablePresent = false;
  }
  return _tablePresent;
}

async function listTickets(db, tenantId, statusFilter) {
  let q = db.from('support_tickets')
    .select('id, category, subject, message, is_anonymous, name, email, status, created_at, resolved_at, resolver_id, resolution_note');
  if (tenantId) q = q.eq('tenant_id', tenantId);
  q = q.eq('status', statusFilter === 'resolved' ? 'resolved' : 'open');
  q = q.order('created_at', { ascending: false }).limit(500);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;
  const { db, tenantId, user } = authed;

  if (req.method === 'GET') {
    const status = String(req.query?.status || 'open').toLowerCase() === 'resolved' ? 'resolved' : 'open';
    if (!(await hasTable(db))) {
      return res.status(200).json({ tickets: [], status, tablePresent: false });
    }
    try {
      const tickets = await listTickets(db, tenantId, status);
      return res.status(200).json({ tickets, status, tablePresent: true });
    } catch (err) {
      return res.status(500).json({ error: 'Could not load support tickets.', code: safeErrorCode(err, 'support_list_failed') });
    }
  }

  // POST — resolve / reopen a ticket.
  const ticketId = String(req.body?.ticketId || '').trim();
  const action = String(req.body?.action || '').toLowerCase();
  const note = (req.body?.note != null ? String(req.body.note) : '').trim().slice(0, 1000) || null;
  if (!ticketId) return res.status(400).json({ error: 'ticketId is required.' });
  if (action !== 'resolve' && action !== 'reopen') {
    return res.status(400).json({ error: "action must be 'resolve' or 'reopen'." });
  }
  if (!(await hasTable(db))) {
    return res.status(503).json({ error: 'The support_tickets table is missing. Apply migration 033.', code: 'migration_required' });
  }

  try {
    let targetQ = db.from('support_tickets').select('id, status, tenant_id').eq('id', ticketId);
    if (tenantId) targetQ = targetQ.eq('tenant_id', tenantId);
    const { data: target, error: tErr } = await targetQ.maybeSingle();
    if (tErr) throw tErr;
    if (!target) return res.status(404).json({ error: 'Ticket not found.' });

    const now = new Date().toISOString();
    const update = action === 'resolve'
      ? { status: 'resolved', resolved_at: now, resolver_id: user?.id || null, resolution_note: note }
      : { status: 'open', resolved_at: null, resolver_id: null };

    const { error: updErr } = await db.from('support_tickets').update(update).eq('id', ticketId);
    if (updErr) throw updErr;

    await writeAuditEvent(db, {
      tenantId: tenantId || null,
      actorProfileId: user?.id || null,
      action: action === 'resolve' ? 'support_ticket_resolved' : 'support_ticket_reopened',
      entityType: 'support_tickets',
      entityId: ticketId,
      phiTouched: false,
      payload: { action, note },
    });

    return res.status(200).json({ ok: true, action, ticketId });
  } catch (err) {
    return res.status(500).json({ error: 'Could not update the ticket.', code: safeErrorCode(err, 'support_update_failed') });
  }
}
