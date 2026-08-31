import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { postBalancedLedger } from '../_lib/operational-workflows.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const TRANSITIONS = Object.freeze({
  submitted: ['approved', 'correction_required', 'rejected'],
  correction_required: ['approved', 'rejected'],
  approved: ['paid', 'correction_required'],
  paid: [],
  rejected: [],
});

async function withLines(db, tenantId, invoices) {
  const ids = invoices.map((row) => row.id);
  if (!ids.length) return invoices;
  const { data, error } = await db.from('nurse_invoice_lines').select('*')
    .eq('tenant_id', tenantId).in('invoice_id', ids).order('sort_order', { ascending: true });
  if (error) throw error;
  const byInvoice = new Map();
  for (const line of data || []) byInvoice.set(line.invoice_id, [...(byInvoice.get(line.invoice_id) || []), line]);
  return invoices.map((invoice) => ({ ...invoice, lines: byInvoice.get(invoice.id) || [] }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const authed = await requireStaff(req, res);
  if (!authed) return;
  try {
    if (req.method === 'GET') {
      let query = authed.db.from('nurse_invoices').select('*').eq('tenant_id', authed.tenantId)
        .order('submitted_at', { ascending: false }).limit(Math.min(500, Number(req.query?.limit) || 250));
      if (req.query?.status) query = query.eq('status', String(req.query.status));
      const { data, error } = await query;
      if (error) throw error;
      const invoices = await withLines(authed.db, authed.tenantId, data || []);
      const metrics = {
        submitted: invoices.filter((row) => row.status === 'submitted').length,
        correctionRequired: invoices.filter((row) => row.status === 'correction_required').length,
        approvedCents: invoices.filter((row) => row.status === 'approved').reduce((sum, row) => sum + Number(row.total_cents || 0), 0),
        paidCents: invoices.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.total_cents || 0), 0),
      };
      return res.status(200).json({ invoices, metrics });
    }
    if (req.method !== 'PATCH') {
      res.setHeader('Allow', 'GET, PATCH');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const invoiceId = String(body.invoiceId || '');
    const nextStatus = String(body.status || '');
    const current = await authed.db.from('nurse_invoices').select('*')
      .eq('tenant_id', authed.tenantId).eq('id', invoiceId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return res.status(404).json({ error: 'Invoice not found.' });
    if (!(TRANSITIONS[current.data.status] || []).includes(nextStatus)) {
      return res.status(409).json({ error: `A ${current.data.status.replace(/_/g, ' ')} invoice cannot move to ${nextStatus.replace(/_/g, ' ')}.` });
    }
    const note = String(body.reviewNote || '').trim().slice(0, 1000);
    if (['correction_required', 'rejected'].includes(nextStatus) && !note) {
      return res.status(400).json({ error: 'Add a note explaining what the nurse needs to correct.' });
    }
    const now = new Date().toISOString();
    const patch = {
      status: nextStatus, reviewed_by: authed.user.id, reviewed_at: now,
      review_note: note || current.data.review_note || null,
      payment_reference: nextStatus === 'paid' ? String(body.paymentReference || '').trim().slice(0, 160) || null : current.data.payment_reference,
      paid_at: nextStatus === 'paid' ? now : current.data.paid_at,
      version: Number(current.data.version || 0) + 1,
    };
    const updated = await authed.db.from('nurse_invoices').update(patch)
      .eq('tenant_id', authed.tenantId).eq('id', invoiceId).eq('version', current.data.version)
      .select('*').maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return res.status(409).json({ error: 'Invoice changed while you were reviewing it. Refresh and try again.' });

    if (nextStatus === 'approved') {
      await postBalancedLedger(authed.db, {
        tenantId: authed.tenantId, sourceType: 'nurse_invoice_approved', sourceId: current.data.invoice_number,
        occurredAt: now, amountCents: current.data.total_cents, currency: current.data.currency,
        debit: { account_code: '6100', account_name: 'Contractor nursing expense', account_type: 'expense' },
        credit: { account_code: '2000', account_name: 'Accounts payable', account_type: 'liability' },
        memo: `Nurse invoice ${current.data.invoice_number} approved`,
        dimensions: { nurse_profile_id: current.data.nurse_profile_id }, actorProfileId: authed.user.id,
      });
    }
    if (nextStatus === 'paid') {
      await postBalancedLedger(authed.db, {
        tenantId: authed.tenantId, sourceType: 'nurse_invoice_paid', sourceId: current.data.invoice_number,
        occurredAt: now, amountCents: current.data.total_cents, currency: current.data.currency,
        debit: { account_code: '2000', account_name: 'Accounts payable', account_type: 'liability' },
        credit: { account_code: '1000', account_name: 'Cash clearing', account_type: 'asset' },
        memo: `Nurse invoice ${current.data.invoice_number} paid`,
        dimensions: { payment_reference: patch.payment_reference }, actorProfileId: authed.user.id,
      });
    }
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId, actorProfileId: authed.user.id,
      action: `nurse_invoice_${nextStatus}`, entityType: 'nurse_invoices', entityId: invoiceId,
      phiTouched: false, payload: { invoiceNumber: current.data.invoice_number, previousStatus: current.data.status, nextStatus },
    });
    return res.status(200).json({ ok: true, invoice: updated.data });
  } catch (error) {
    console.warn('[admin/nurse-invoices] failed', safeLogContext(error, 'nurse_invoices_failed'));
    return res.status(error.status || 500).json({ error: error.message || 'Could not process nurse invoices.', code: safeErrorCode(error, 'nurse_invoices_failed') });
  }
}

