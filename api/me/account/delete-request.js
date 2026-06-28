/**
 * POST /api/me/account/delete-request
 *
 * Member-initiated account-deletion REQUEST. This deliberately does NOT delete
 * anything: clinical records carry medical-record retention obligations
 * (HIPAA / state retention schedules), so a member cannot self-erase their PHI.
 * Instead we:
 *   1. Stamp profiles.deletion_requested_at (+ reason) so the team sees a
 *      pending request on the member's row.
 *   2. Emit an audit event the staff can action / reconcile against the
 *      retention policy before any approved purge.
 *
 * The actual deletion/anonymisation is a staffed, retention-gated workflow
 * (see public.data_deletion_requests + data_retention_policies), out of scope
 * for self-serve. This endpoint only records intent.
 *
 * Body: { reason?: string }
 *
 * NOTE: profiles.deletion_requested_at / deletion_request_reason are NOT yet in
 * the schema. The migration is reported in the task summary. Until it lands,
 * the column write is best-effort: if the columns are missing we still write the
 * audit event and return ok, so the request is never silently lost.
 */
import { getAuthedUser } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { checkRateLimit } from '../../_lib/rate-limit.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, user, email, tenantId } = authed;

  const limit = await checkRateLimit({
    key: `me-delete-request:${user?.id || 'unknown'}`,
    windowMs: 60 * 1000,
    max: 5,
  });
  if (!limit.ok) {
    return res.status(429).json({ error: 'Too many attempts. Try again shortly.', code: 'rate_limited' });
  }

  const reason = String(req.body?.reason || '').trim().slice(0, 1000) || null;
  const requestedAt = new Date().toISOString();

  // Best-effort flag on the profile row. If the column doesn't exist yet (see
  // migration in the task report) the update fails — we log and fall through to
  // the audit event so the request is still durably recorded.
  let flagged = false;
  try {
    const { error } = await db.from('profiles')
      .update({ deletion_requested_at: requestedAt, deletion_request_reason: reason })
      .eq('id', user.id);
    if (error) throw error;
    flagged = true;
  } catch (err) {
    console.warn('[me/account/delete-request] could not flag profile (column may be missing)', safeLogContext(err, 'delete_flag_failed'));
  }

  // The audit event is the durable, retention-safe record of the request.
  const audit = await writeAuditEvent(db, {
    tenantId: tenantId || null,
    actorProfileId: user?.id || null,
    action: 'account_deletion_requested',
    entityType: 'profiles',
    entityId: user?.id || null,
    phiTouched: true,
    payload: { email: email || null, reason, requestedAt, flagged },
  });

  if (audit?.error && !flagged) {
    // Both paths failed — surface an error so the member can retry / contact us.
    return res.status(500).json({
      error: 'Could not submit your request. Please contact support.',
      code: safeErrorCode({ code: audit.error }, 'delete_request_failed'),
    });
  }

  return res.status(200).json({
    ok: true,
    status: 'requested',
    requestedAt,
    message: 'Your deletion request has been received. Our team will follow up — clinical records are retained as required by law.',
  });
}
