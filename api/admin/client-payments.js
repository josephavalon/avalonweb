import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

function rangeStart(range) {
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (range === 'week') return new Date(now.getTime() - 7 * 86400000).toISOString();
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return null;
}

async function validateAssociation(db, tenantId, body) {
  const checks = [
    ['appointmentId', 'appointments'], ['eventContainerId', 'event_containers'], ['eventServiceId', 'event_services'],
  ];
  for (const [field, table] of checks) {
    if (!body[field]) continue;
    const result = await db.from(table).select('id').eq('tenant_id', tenantId).eq('id', body[field]).maybeSingle();
    if (result.error || !result.data) throw Object.assign(new Error(`Invalid ${field}.`), { status: 400, code: 'invalid_association' });
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireStaff(req, res);
  if (!authed) return;
  try {
    if (req.method === 'GET') {
      const limit = Math.min(1000, Math.max(1, Number(req.query?.limit) || 500));
      let query = authed.db.from('client_payments').select('*').eq('tenant_id', authed.tenantId)
        .order('processed_at', { ascending: false, nullsFirst: false }).limit(limit);
      const from = rangeStart(req.query?.range);
      if (from) query = query.gte('processed_at', from);
      if (req.query?.status) query = query.eq('status', String(req.query.status));
      if (req.query?.reconciliation) query = query.eq('reconciliation_status', String(req.query.reconciliation));
      const { data: payments, error } = await query;
      if (error) throw error;
      const rows = payments || [];
      const captured = rows.filter((row) => row.status === 'completed');
      const metrics = {
        count: rows.length,
        completedCents: captured.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0),
        refundedCents: rows.reduce((sum, row) => sum + Number(row.refunded_cents || 0), 0),
        unmatched: rows.filter((row) => row.reconciliation_status === 'unmatched').length,
        failed: rows.filter((row) => row.status === 'failed').length,
      };
      let candidates = null;
      if (req.query?.includeCandidates === '1') {
        const [appointments, events, services] = await Promise.all([
          authed.db.from('appointments').select('id, order_number, starts_at, protocol_key').eq('tenant_id', authed.tenantId).order('created_at', { ascending: false }).limit(250),
          authed.db.from('event_containers').select('id, name, slug, starts_at').eq('tenant_id', authed.tenantId).order('starts_at', { ascending: false }).limit(250),
          authed.db.from('event_services').select('id, name').eq('tenant_id', authed.tenantId).eq('active', true).order('name'),
        ]);
        candidates = { appointments: appointments.data || [], events: events.data || [], services: services.data || [] };
      }
      return res.status(200).json({ payments: rows, metrics, candidates });
    }
    if (!['POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const paymentId = String(body.paymentId || '');
    if (!paymentId) return res.status(400).json({ error: 'Payment id is required.' });
    const current = await authed.db.from('client_payments').select('*').eq('tenant_id', authed.tenantId).eq('id', paymentId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return res.status(404).json({ error: 'Payment not found.' });
    const action = String(body.action || 'match');
    let patch;
    if (action === 'match') {
      await validateAssociation(authed.db, authed.tenantId, body);
      if (!body.appointmentId && !body.eventContainerId && !body.eventServiceId && !String(body.invoiceReference || '').trim()) {
        return res.status(400).json({ error: 'Choose an appointment, event, service, or invoice.' });
      }
      patch = {
        appointment_id: body.appointmentId || null,
        event_container_id: body.eventContainerId || null,
        event_service_id: body.eventServiceId || null,
        invoice_reference: String(body.invoiceReference || '').trim().slice(0, 160) || null,
        reconciliation_status: 'matched', match_method: 'manual', match_confidence: 1,
        version: Number(current.data.version || 0) + 1,
      };
    } else if (action === 'ignore') {
      patch = { reconciliation_status: 'ignored', match_method: 'ignored', match_confidence: null, version: Number(current.data.version || 0) + 1 };
    } else if (action === 'unmatch') {
      patch = { appointment_id: null, event_container_id: null, event_service_id: null, invoice_reference: null, reconciliation_status: 'unmatched', match_method: null, match_confidence: null, version: Number(current.data.version || 0) + 1 };
    } else return res.status(400).json({ error: 'Unsupported reconciliation action.' });
    const updated = await authed.db.from('client_payments').update(patch).eq('tenant_id', authed.tenantId)
      .eq('id', paymentId).eq('version', current.data.version).select('*').maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return res.status(409).json({ error: 'Payment changed while you were editing it. Refresh and try again.' });
    await authed.db.from('payment_reconciliation_history').insert({
      tenant_id: authed.tenantId, payment_id: paymentId,
      previous_status: current.data.reconciliation_status, next_status: updated.data.reconciliation_status,
      association: patch, reason: String(body.reason || '').slice(0, 240) || null, created_by: authed.user.id,
    });
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId, actorProfileId: authed.user.id,
      action: `client_payment_${action}`, entityType: 'client_payments', entityId: paymentId,
      phiTouched: false, payload: { previous: current.data.reconciliation_status, next: updated.data.reconciliation_status },
    });
    return res.status(200).json({ ok: true, payment: updated.data });
  } catch (error) {
    console.warn('[admin/client-payments] failed', safeLogContext(error, 'client_payments_failed'));
    return res.status(error.status || 500).json({ error: error.message || 'Could not load client payments.', code: safeErrorCode(error, 'client_payments_failed') });
  }
}

