/**
 * /api/admin/reviews
 *
 * Admin/staff moderation for the post-visit NPS + review capture.
 *
 *   GET  → list (newest-first) submitted reviews for the caller's tenant,
 *           joined with appointment context for the UI.
 *           Query: ?scope=submitted (default) | all | public-candidates
 *                  ?limit (default 200, max 500)
 *
 *   POST → moderation actions:
 *           { id, action: 'approve' | 'unapprove' | 'hide' | 'unhide' }
 *           Returns the updated row.
 *
 * Only `approved && allow_public && nps_score >= 8 && !hidden` rows would be
 * eligible for a future public testimonials endpoint — but that endpoint is
 * NOT built here, only the moderation surface that prepares the queue.
 *
 * RLS: the service-role client bypasses RLS, so tenant scope is applied
 * server-side via the caller's profiles.tenant_id (same pattern as
 * api/admin/bookings.js).
 */

import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const VALID_ACTIONS = new Set(['approve', 'unapprove', 'hide', 'unhide']);

function isMissingTableError(err) {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42p01' ||
    code === 'pgrst205' ||
    (msg.includes('reviews') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  );
}

function shapeReview(row, apptById) {
  const appt = apptById.get(row.appointment_id) || {};
  const payload = appt.external_payload || {};
  const contact = payload.contact || {};
  const name = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    profileId: row.profile_id,
    email: row.email,
    npsScore: row.nps_score,
    text: row.text,
    allowPublic: Boolean(row.allow_public),
    approved: Boolean(row.approved),
    hidden: Boolean(row.hidden),
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    // Appointment context — purely for the admin moderation list. PHI-free
    // (member name + visit date are already shown across the admin app).
    customerName: name || '—',
    customerEmail: contact.email || row.email,
    visitStartsAt: appt.starts_at || null,
    visitService: payload.primaryService || appt.protocol_key || 'Avalon Visit',
  };
}

export default async function handler(req, res) {
  const authed = await requireStaff(req, res);
  if (!authed) return;

  const { db, tenantId, user } = authed;

  if (req.method === 'GET') {
    const limit = Math.min(Number(req.query?.limit) || 200, 500);
    const scope = String(req.query?.scope || 'submitted');

    let query = db
      .from('reviews')
      .select('id, tenant_id, appointment_id, profile_id, email, nps_score, text, allow_public, approved, hidden, submitted_at, created_at')
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    if (scope !== 'all') query = query.not('submitted_at', 'is', null);
    if (scope === 'public-candidates') {
      query = query.eq('allow_public', true).eq('hidden', false).gte('nps_score', 8);
    }

    let rows;
    try {
      const { data, error } = await query;
      if (error) throw error;
      rows = data || [];
    } catch (err) {
      if (isMissingTableError(err)) {
        return res.status(503).json({
          error: 'The reviews table has not been created yet. Run the migration, then refresh.',
          code: 'migration_required',
        });
      }
      console.warn('[admin/reviews] list failed', safeLogContext(err, 'admin_reviews_list_failed'));
      return res.status(500).json({
        error: 'Could not load reviews.',
        code: safeErrorCode(err, 'admin_reviews_list_failed'),
      });
    }

    // Pull appointment context in a single round trip so the UI shows who the
    // review is from / when the visit was. Service-role bypasses RLS; tenant
    // already constrained above.
    const apptIds = Array.from(new Set(rows.map((r) => r.appointment_id).filter(Boolean)));
    const apptById = new Map();
    if (apptIds.length > 0) {
      try {
        const { data: appts } = await db
          .from('appointments')
          .select('id, starts_at, protocol_key, external_payload')
          .in('id', apptIds);
        (appts || []).forEach((a) => apptById.set(a.id, a));
      } catch (err) {
        // Non-fatal — the list still renders without context.
        console.warn('[admin/reviews] appt context failed', safeLogContext(err, 'admin_reviews_context_failed'));
      }
    }

    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: user?.id || null,
      action: 'admin_reviews_read',
      entityType: 'reviews',
      phiTouched: false,
      payload: { route: 'api/admin/reviews', scope, limit, resultCount: rows.length },
    });

    return res.status(200).json({ reviews: rows.map((r) => shapeReview(r, apptById)) });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing review id.', code: 'missing_id' });
    if (!VALID_ACTIONS.has(action)) return res.status(400).json({ error: 'Unknown action.', code: 'unknown_action' });

    const patch =
      action === 'approve'   ? { approved: true,  hidden: false } :
      action === 'unapprove' ? { approved: false } :
      action === 'hide'      ? { hidden: true,    approved: false } :
      /* unhide */             { hidden: false };

    let updated;
    try {
      let q = db.from('reviews').update(patch).eq('id', id);
      if (tenantId) q = q.eq('tenant_id', tenantId);
      const { data, error } = await q
        .select('id, tenant_id, appointment_id, profile_id, email, nps_score, text, allow_public, approved, hidden, submitted_at, created_at')
        .single();
      if (error) throw error;
      updated = data;
    } catch (err) {
      if (isMissingTableError(err)) {
        return res.status(503).json({
          error: 'The reviews table has not been created yet. Run the migration, then save again.',
          code: 'migration_required',
        });
      }
      console.warn('[admin/reviews] update failed', safeLogContext(err, 'admin_reviews_update_failed'));
      return res.status(500).json({
        error: 'Could not update the review.',
        code: safeErrorCode(err, 'admin_reviews_update_failed'),
      });
    }

    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: user?.id || null,
      action: `admin_review_${action}`,
      entityType: 'reviews',
      entityId: id,
      phiTouched: false,
      payload: { route: 'api/admin/reviews', action },
    });

    return res.status(200).json({ ok: true, review: shapeReview(updated, new Map()) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
