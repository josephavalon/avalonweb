/**
 * GET /api/admin/expiring-credits
 *
 * Staff/admin read-only list of member credit grants that will expire within
 * the next 30 days and have NOT yet been expired or refunded. Powers the
 * "Credits expiring soon" admin widget so staff can reach out to members
 * before their visit credits vanish.
 *
 * Selection rules (mirrors `expireStaleCredits` in api/_lib/member-credits.js):
 *   - Grant row: units > 0, expires_at IS NOT NULL, expires_at within now..+30d.
 *   - Not already expired: no `credit_expiry` row in the same tenant whose
 *     `external_payload->>'expiredGrantId'` matches the grant id.
 *   - Returns each grant joined to the member's profile (email, name) so the
 *     widget can render a "Mailto" handoff.
 *
 * Sort: soonest-to-expire first. Cap: 200 rows.
 */

import { requireStaff } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const WINDOW_DAYS = 30;
const MAX_ROWS = 200;

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const { db, tenantId } = authed;

  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const horizonIso = horizon.toISOString();

    // 1. Candidate grants in the window. Tenant-isolated.
    let grantQ = db.from('member_credit_ledger')
      .select('id, tenant_id, profile_id, member_email, units, credit_value_cents, expires_at, created_at, source, description')
      .gt('units', 0)
      .not('expires_at', 'is', null)
      .gte('expires_at', nowIso)
      .lte('expires_at', horizonIso)
      .order('expires_at', { ascending: true })
      .limit(MAX_ROWS);
    if (tenantId) grantQ = grantQ.eq('tenant_id', tenantId);
    const { data: grants, error: grantErr } = await grantQ;
    if (grantErr) throw grantErr;

    if (!grants || grants.length === 0) {
      return res.status(200).json({ rows: [], windowDays: WINDOW_DAYS });
    }

    // 2. Filter out grants that already have a credit_expiry offset (idempotent
    //    sweep may have run early, or a manual expiry was posted). This mirrors
    //    the dedupe key in expireStaleCredits().
    const grantIds = grants.map((g) => g.id);
    let alreadyQ = db.from('member_credit_ledger')
      .select('external_payload')
      .eq('source', 'credit_expiry')
      .in('external_payload->>expiredGrantId', grantIds);
    if (tenantId) alreadyQ = alreadyQ.eq('tenant_id', tenantId);
    const { data: already, error: alreadyErr } = await alreadyQ;
    // The `->>` operator may not be supported by very old PostgREST; fall back
    // to "no rows already expired" rather than 500 the whole widget.
    const expiredSet = new Set(
      (alreadyErr ? [] : (already || []))
        .map((r) => r?.external_payload?.expiredGrantId)
        .filter(Boolean)
    );

    const liveGrants = grants.filter((g) => !expiredSet.has(g.id));
    if (liveGrants.length === 0) {
      return res.status(200).json({ rows: [], windowDays: WINDOW_DAYS });
    }

    // 3. Resolve member display info. Prefer profile join by id; fall back to
    //    email lookup so legacy grants without profile_id still render.
    const profileIds = Array.from(new Set(liveGrants.map((g) => g.profile_id).filter(Boolean)));
    const emails = Array.from(new Set(
      liveGrants
        .filter((g) => !g.profile_id && g.member_email)
        .map((g) => normalizeEmail(g.member_email))
        .filter(Boolean)
    ));

    const profileById = new Map();
    if (profileIds.length) {
      let q = db.from('profiles')
        .select('id, email, full_name, preferred_name')
        .in('id', profileIds);
      if (tenantId) q = q.eq('tenant_id', tenantId);
      const { data, error } = await q;
      if (error) throw error;
      (data || []).forEach((p) => profileById.set(p.id, p));
    }
    const profileByEmail = new Map();
    if (emails.length) {
      let q = db.from('profiles')
        .select('id, email, full_name, preferred_name')
        .in('email', emails);
      if (tenantId) q = q.eq('tenant_id', tenantId);
      const { data, error } = await q;
      if (error) throw error;
      (data || []).forEach((p) => {
        const key = normalizeEmail(p.email);
        if (key) profileByEmail.set(key, p);
      });
    }

    const rows = liveGrants.map((g) => {
      const profile = (g.profile_id && profileById.get(g.profile_id))
        || (g.member_email && profileByEmail.get(normalizeEmail(g.member_email)))
        || null;
      const expiresMs = new Date(g.expires_at).getTime();
      const daysLeft = Math.max(0, Math.ceil((expiresMs - now.getTime()) / (24 * 60 * 60 * 1000)));
      return {
        grantId: g.id,
        profileId: profile?.id || g.profile_id || null,
        fullName: profile?.full_name || profile?.preferred_name || null,
        email: profile?.email || g.member_email || null,
        units: Number(g.units || 0),
        creditValueCents: Number(g.credit_value_cents || 0),
        expiresAt: g.expires_at,
        daysLeft,
        source: g.source,
        description: g.description || null,
        grantedAt: g.created_at || null,
      };
    });

    return res.status(200).json({ rows, windowDays: WINDOW_DAYS });
  } catch (err) {
    console.warn('[admin/expiring-credits] failed',
      safeLogContext(err, 'admin_expiring_credits_failed'));
    return res.status(500).json({
      error: 'Could not load expiring credits.',
      code: safeErrorCode(err, 'admin_expiring_credits_failed'),
    });
  }
}
