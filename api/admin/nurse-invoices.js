import { requireAdmin } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { receiptsWithSignedUrls } from '../_lib/nurse-invoice-store.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const TRANSITIONS = Object.freeze({
  quarantined: ['submitted', 'rejected'],
  submitted: ['approved', 'correction_required', 'rejected'],
  correction_required: ['approved', 'rejected'],
  approved: ['paid', 'correction_required'],
  paid: [],
  rejected: [],
});

async function hydrateInvoices(db, tenantId, invoices) {
  const ids = invoices.map((row) => row.id);
  if (!ids.length) return invoices.map((row) => ({ ...row, lines: [], receipts: [] }));
  const [lineResult, receiptResult, eventResult] = await Promise.all([
    db.from('nurse_invoice_lines').select('*')
      .eq('tenant_id', tenantId).in('invoice_id', ids).order('sort_order', { ascending: true }),
    db.from('nurse_invoice_receipts').select('*')
      .eq('tenant_id', tenantId).in('invoice_id', ids).order('receipt_index', { ascending: true }),
    db.from('nurse_invoice_status_events').select('*')
      .eq('tenant_id', tenantId).in('invoice_id', ids).order('created_at', { ascending: false }),
  ]);
  if (lineResult.error) throw lineResult.error;
  if (receiptResult.error) throw receiptResult.error;
  if (eventResult.error) throw eventResult.error;
  const linesByInvoice = new Map();
  const receiptsByInvoice = new Map();
  const eventsByInvoice = new Map();
  for (const line of lineResult.data || []) {
    linesByInvoice.set(line.invoice_id, [...(linesByInvoice.get(line.invoice_id) || []), line]);
  }
  for (const receipt of receiptResult.data || []) {
    receiptsByInvoice.set(receipt.invoice_id, [...(receiptsByInvoice.get(receipt.invoice_id) || []), receipt]);
  }
  for (const event of eventResult.data || []) {
    eventsByInvoice.set(event.invoice_id, [...(eventsByInvoice.get(event.invoice_id) || []), event]);
  }
  return Promise.all(invoices.map(async (invoice) => ({
    ...invoice,
    lines: linesByInvoice.get(invoice.id) || [],
    receipts: await receiptsWithSignedUrls(db, receiptsByInvoice.get(invoice.id) || []),
    statusEvents: eventsByInvoice.get(invoice.id) || [],
  })));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireAdmin(req, res);
  if (!authed) return;

  try {
    if (req.method === 'GET') {
      const limit = Math.min(250, Math.max(1, Number(req.query?.limit) || 100));
      const offset = Math.max(0, Math.floor(Number(req.query?.offset) || 0));
      let query = authed.db.from('nurse_invoices').select('*', { count: 'exact' })
        .eq('tenant_id', authed.tenantId)
        .order('submitted_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (req.query?.status) query = query.eq('status', String(req.query.status));
      if (req.query?.invoiceId) query = query.eq('id', String(req.query.invoiceId));
      const result = await query;
      if (result.error) throw result.error;
      const metricsResult = await authed.db.rpc('nurse_invoice_metrics', { p_tenant_id: authed.tenantId });
      if (metricsResult.error) throw metricsResult.error;
      const invoices = await hydrateInvoices(authed.db, authed.tenantId, result.data || []);
      const total = Number(result.count || 0);
      await writeAuditEvent(authed.db, {
        tenantId: authed.tenantId,
        actorProfileId: authed.user.id,
        action: 'admin_nurse_invoices_read',
        entityType: 'nurse_invoices',
        phiTouched: false,
        payload: { count: invoices.length, offset, status: req.query?.status || null },
      });
      return res.status(200).json({
        invoices,
        metrics: metricsResult.data || {},
        pagination: {
          offset,
          limit,
          total,
          hasMore: offset + invoices.length < total,
          nextOffset: offset + invoices.length,
        },
      });
    }

    if (req.method !== 'PATCH') {
      res.setHeader('Allow', 'GET, PATCH');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const invoiceId = String(body.invoiceId || '').trim();
    const nextStatus = String(body.status || '').trim();
    const expectedVersion = Number(body.expectedVersion);
    if (!invoiceId || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      return res.status(400).json({ error: 'Invoice id and expected version are required.', code: 'invoice_version_required' });
    }

    const currentResult = await authed.db.from('nurse_invoices').select('*')
      .eq('tenant_id', authed.tenantId).eq('id', invoiceId).maybeSingle();
    if (currentResult.error) throw currentResult.error;
    const current = currentResult.data;
    if (!current) return res.status(404).json({ error: 'Invoice not found.' });
    if (Number(current.version) !== expectedVersion) {
      return res.status(409).json({ error: 'Invoice changed while you were reviewing it. Refresh and try again.', code: 'invoice_version_conflict' });
    }
    if (!(TRANSITIONS[current.status] || []).includes(nextStatus)) {
      return res.status(409).json({
        error: `A ${current.status.replace(/_/g, ' ')} invoice cannot move to ${nextStatus.replace(/_/g, ' ')}.`,
        code: 'invalid_invoice_transition',
      });
    }

    const note = String(body.reviewNote || '').trim().slice(0, 1000);
    if ((current.status === 'quarantined' || ['correction_required', 'rejected'].includes(nextStatus)) && !note) {
      return res.status(400).json({
        error: current.status === 'quarantined'
          ? 'Add a note documenting how identity was verified.'
          : 'Add a review note explaining the correction or rejection.',
        code: 'review_note_required',
      });
    }
    const paymentReference = String(body.paymentReference || '').trim().slice(0, 160);
    if (nextStatus === 'paid' && !paymentReference) {
      return res.status(400).json({ error: 'A payment reference is required before marking an invoice paid.', code: 'payment_reference_required' });
    }

    const now = new Date().toISOString();
    const patch = {
      status: nextStatus,
      reviewed_by: authed.user.id,
      reviewed_at: now,
      review_note: note || current.review_note || null,
      version: expectedVersion + 1,
      ...(current.status === 'quarantined' && nextStatus === 'submitted' ? {
        identity_assurance: 'admin_verified_shared_door',
        identity_verified_by: authed.user.id,
        identity_verified_at: now,
      } : {}),
      ...(nextStatus === 'paid' ? { paid_at: now, payment_reference: paymentReference } : {}),
    };
    const updateResult = await authed.db.from('nurse_invoices').update(patch)
      .eq('tenant_id', authed.tenantId)
      .eq('id', invoiceId)
      .eq('version', expectedVersion)
      .select('*')
      .maybeSingle();
    if (updateResult.error) throw updateResult.error;
    if (!updateResult.data) {
      return res.status(409).json({ error: 'Invoice changed while you were reviewing it. Refresh and try again.', code: 'invoice_version_conflict' });
    }

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: `nurse_invoice_${nextStatus}`,
      entityType: 'nurse_invoices',
      entityId: invoiceId,
      phiTouched: false,
      payload: {
        invoiceNumber: current.invoice_number,
        previousStatus: current.status,
        nextStatus,
        expectedVersion,
        receiptStorageStatus: current.receipt_storage_status,
      },
    });
    const hydrated = await hydrateInvoices(authed.db, authed.tenantId, [updateResult.data]);
    return res.status(200).json({ ok: true, invoice: hydrated[0] });
  } catch (error) {
    console.warn('[admin/nurse-invoices] failed', safeLogContext(error, 'nurse_invoices_failed'));
    return res.status(500).json({
      error: 'Could not process nurse invoices.',
      code: safeErrorCode(error, 'nurse_invoices_failed'),
    });
  }
}
