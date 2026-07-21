/**
 * /api/admin/deletion-requests
 *
 * Staff/admin workflow for actioning member-initiated account-deletion requests
 * (see api/me/account/delete-request.js + migration 022). Medical-record
 * retention forbids hard-delete, so "action" here means ANONYMIZE the
 * identifying PII on the profile + revoke auth, while leaving clinical,
 * appointment, charge and ledger rows intact.
 *
 *   GET  ?status=open|resolved  → list deletion requests in either bucket.
 *                                 Open  = deletion_requested_at IS NOT NULL
 *                                       AND deletion_resolved_at IS NULL
 *                                 Resolved = deletion_resolved_at IS NOT NULL
 *   POST { profileId, action: 'anonymize'|'deny', note? }
 *      'anonymize' →
 *         - profiles.email     := 'deleted+<id>@avalon.local'
 *         - profiles.full_name := 'Removed user'
 *         - profiles.phone     := null
 *         - profiles.deletion_resolved_at = now()
 *         - profiles.deletion_resolver_id = caller
 *         - profiles.deletion_resolution_note = note
 *         - auth user banned (ban_duration='876000h') + signed out globally.
 *           We DO NOT call auth.admin.deleteUser — public.profiles.id has an
 *           ON DELETE CASCADE FK to auth.users(id) (see migration 002), so
 *           hard-deleting the auth user would wipe the profile we just kept
 *           on purpose for retention. Ban + global signOut is the
 *           non-destructive equivalent of revoking the auth user.
 *      'deny' →
 *         - just stamps deletion_resolved_at + note (request stays on record).
 *   Both actions write an audit_event ('deletion_request_anonymized' /
 *   'deletion_request_denied').
 *
 * NOTE: requires new columns on profiles —
 *   deletion_resolved_at      timestamptz
 *   deletion_resolver_id      uuid
 *   deletion_resolution_note  text
 * The migration SQL is reported in the task summary; until it lands, the GET
 * falls back to listing by deletion_requested_at only, and the POST returns
 * 503 'migration_required' rather than silently doing the wrong thing.
 */
import { requireStaff } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const ANON_PLACEHOLDER_NAME = 'Removed user';
function anonEmail(profileId) {
  return `deleted+${profileId}@avalon.local`;
}

// Detect whether the new resolution columns exist by issuing a narrow select.
// We cache the result for the lifetime of the lambda so we don't re-probe per
// request. Returns true once we've seen the columns successfully respond.
let _resolutionColumnsKnown = null;
async function hasResolutionColumns(db) {
  if (_resolutionColumnsKnown !== null) return _resolutionColumnsKnown;
  try {
    const { error } = await db.from('profiles')
      .select('deletion_resolved_at, deletion_resolver_id, deletion_resolution_note')
      .limit(1);
    _resolutionColumnsKnown = !error;
  } catch {
    _resolutionColumnsKnown = false;
  }
  return _resolutionColumnsKnown;
}

async function listRequests(db, tenantId, statusFilter) {
  const hasResCols = await hasResolutionColumns(db);
  // Always scope to the caller's tenant — the requireStaff gate has already
  // verified the role + tenant binding, mirror it on the query.
  const baseColumns = [
    'id', 'email', 'full_name', 'phone', 'created_at',
    'deletion_requested_at', 'deletion_request_reason',
  ];
  if (hasResCols) baseColumns.push('deletion_resolved_at', 'deletion_resolver_id', 'deletion_resolution_note');

  let q = db.from('profiles').select(baseColumns.join(',')).not('deletion_requested_at', 'is', null);
  if (tenantId) q = q.eq('tenant_id', tenantId);

  if (hasResCols) {
    if (statusFilter === 'resolved') q = q.not('deletion_resolved_at', 'is', null);
    else q = q.is('deletion_resolved_at', null);
  } else if (statusFilter === 'resolved') {
    // Without the resolution columns we can't tell resolved from open — return
    // an empty list for the resolved tab rather than mislabeling open requests.
    return [];
  }

  q = q.order('deletion_requested_at', { ascending: false }).limit(500);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    email: row.email || null,
    full_name: row.full_name || null,
    phone: row.phone || null,
    created_at: row.created_at || null,
    requested_at: row.deletion_requested_at || null,
    reason: row.deletion_request_reason || null,
    resolved_at: row.deletion_resolved_at || null,
    resolver_id: row.deletion_resolver_id || null,
    resolution_note: row.deletion_resolution_note || null,
  }));
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
    try {
      const requests = await listRequests(db, tenantId, status);
      return res.status(200).json({ requests, status, resolutionColumnsPresent: await hasResolutionColumns(db) });
    } catch (err) {
      return res.status(500).json({ error: 'Could not load deletion requests.', code: safeErrorCode(err, 'deletion_list_failed') });
    }
  }

  // POST — resolve a request.
  const profileId = String(req.body?.profileId || '').trim();
  const action = String(req.body?.action || '').toLowerCase();
  const note = (req.body?.note != null ? String(req.body.note) : '').trim().slice(0, 1000) || null;
  if (!profileId) return res.status(400).json({ error: 'profileId is required.' });
  if (action !== 'anonymize' && action !== 'deny') {
    return res.status(400).json({ error: "action must be 'anonymize' or 'deny'." });
  }
  // Self-anonymize would wipe the actor row mid-request — refuse.
  if (profileId === user?.id) {
    return res.status(409).json({ error: "You can't action your own deletion request.", code: 'self_resolve' });
  }

  const hasResCols = await hasResolutionColumns(db);
  if (!hasResCols) {
    return res.status(503).json({
      error: 'Deletion-request resolution columns are missing. Apply the pending migration.',
      code: 'migration_required',
    });
  }

  try {
    // Load the target row (tenant-scoped) so we can confirm it exists, has a
    // pending request, and capture the prior email for the audit payload.
    let targetQ = db.from('profiles')
      .select('id, email, full_name, phone, tenant_id, deletion_requested_at, deletion_resolved_at')
      .eq('id', profileId);
    if (tenantId) targetQ = targetQ.eq('tenant_id', tenantId);
    const { data: target, error: tErr } = await targetQ.maybeSingle();
    if (tErr) throw tErr;
    if (!target) return res.status(404).json({ error: 'Profile not found.' });
    if (!target.deletion_requested_at) {
      return res.status(409).json({ error: 'This profile has no pending deletion request.', code: 'no_pending_request' });
    }
    // Idempotency: if already resolved, return ok with the existing state.
    if (target.deletion_resolved_at) {
      return res.status(200).json({ ok: true, status: 'already_resolved', resolvedAt: target.deletion_resolved_at });
    }

    const resolvedAt = new Date().toISOString();
    const priorEmail = target.email || null;

    if (action === 'anonymize') {
      // 1. Scrub PII on the profile (keep the row + its id so clinical/billing
      //    FKs survive). We do NOT touch role/tenant/status here — operator
      //    status is handled below via ban + signOut.
      const { error: updErr } = await db.from('profiles').update({
        email: anonEmail(profileId),
        full_name: ANON_PLACEHOLDER_NAME,
        phone: null,
        deletion_resolved_at: resolvedAt,
        deletion_resolver_id: user?.id || null,
        deletion_resolution_note: note,
      }).eq('id', profileId);
      if (updErr) throw updErr;

      // 2. Revoke auth: ban the user so the JWT can't be re-issued, then sign
      //    out every existing session so the current access token stops
      //    working immediately. We deliberately do NOT call deleteUser — see
      //    file header re: cascade FK on auth.users.
      try {
        await db.auth.admin.updateUserById(profileId, { ban_duration: '876000h' });
      } catch (banErr) {
        console.warn('[deletion-requests] auth ban failed', safeLogContext(banErr, 'auth_ban_failed'));
      }
      try {
        await db.auth.admin.signOut(profileId, 'global');
      } catch (signOutErr) {
        console.warn('[deletion-requests] auth signOut failed', safeLogContext(signOutErr, 'auth_signout_failed'));
      }

      await writeAuditEvent(db, {
        tenantId: tenantId || null,
        actorProfileId: user?.id || null,
        action: 'deletion_request_anonymized',
        entityType: 'profiles',
        entityId: profileId,
        phiTouched: true,
        payload: { priorEmail, resolvedAt, note, retention: 'clinical_financial_preserved' },
      });

      return res.status(200).json({ ok: true, action: 'anonymize', resolvedAt });
    }

    // action === 'deny'
    const { error: denyErr } = await db.from('profiles').update({
      deletion_resolved_at: resolvedAt,
      deletion_resolver_id: user?.id || null,
      deletion_resolution_note: note,
    }).eq('id', profileId);
    if (denyErr) throw denyErr;

    await writeAuditEvent(db, {
      tenantId: tenantId || null,
      actorProfileId: user?.id || null,
      action: 'deletion_request_denied',
      entityType: 'profiles',
      entityId: profileId,
      phiTouched: false,
      payload: { priorEmail, resolvedAt, note },
    });

    return res.status(200).json({ ok: true, action: 'deny', resolvedAt });
  } catch (err) {
    return res.status(500).json({
      error: 'Could not action the deletion request.',
      code: safeErrorCode(err, 'deletion_resolve_failed'),
    });
  }
}
