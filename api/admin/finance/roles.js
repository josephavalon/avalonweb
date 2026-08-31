import {
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanReasonCode,
  cleanUuid,
  FINANCE_ROLES,
  normalizePayOpsDbError,
  PayOpsError,
  sendPayOpsError,
} from '../../_lib/payops-core.js';
import { getAuthedUser } from '../../_lib/supabase-auth.js';

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}

async function requireFinanceAdmin(req, res, { stepUp = false } = {}) {
  const authed = await getAuthedUser(req);
  if (!authed) {
    res.status(401).json({ error: 'Sign in required' });
    return null;
  }
  if (!['admin', 'founder'].includes(authed.role) || !authed.tenantId) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  if (stepUp && authed.aal !== 'aal2') {
    res.status(403).json({ error: 'Recent multi-factor authentication is required.', code: 'finance_step_up_required' });
    return null;
  }
  return authed;
}

function roleView(row, profilesById) {
  const profile = profilesById.get(row.profile_id) || {};
  return {
    id: row.id,
    profileId: row.profile_id,
    displayName: profile.full_name || profile.email || 'Finance operator',
    email: profile.email || null,
    financeRole: row.finance_role,
    effectiveAt: row.effective_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    version: row.version,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const authed = await requireFinanceAdmin(req, res);
      if (!authed) return;
      const rolesResult = await authed.db.from('finance_role_assignments')
        .select('id,profile_id,finance_role,effective_at,expires_at,revoked_at,version,created_at')
        .eq('tenant_id', authed.tenantId)
        .order('created_at', { ascending: false });
      if (rolesResult.error) throw rolesResult.error;
      const profileIds = [...new Set((rolesResult.data || []).map((row) => row.profile_id))];
      let profilesById = new Map();
      if (profileIds.length) {
        const profileResult = await authed.db.from('profiles')
          .select('id,full_name,email,status')
          .eq('tenant_id', authed.tenantId)
          .in('id', profileIds);
        if (profileResult.error) throw profileResult.error;
        profilesById = new Map((profileResult.data || []).map((row) => [row.id, row]));
      }
      return res.status(200).json({
        roles: (rolesResult.data || []).map((row) => roleView(row, profilesById)),
        allowedRoles: FINANCE_ROLES,
      });
    }

    if (req.method === 'POST') {
      const authed = await requireFinanceAdmin(req, res, { stepUp: true });
      if (!authed) return;
      const body = parseBody(req);
      const targetProfileId = cleanUuid(body.profileId, 'profileId');
      const financeRole = String(body.financeRole || '').trim();
      if (!FINANCE_ROLES.includes(financeRole)) {
        throw new PayOpsError('Finance role is invalid.', 'finance_role_invalid', 400);
      }
      const reasonCode = cleanReasonCode(body.reasonCode).toLowerCase();
      const assignmentKey = cleanIdempotencyKey(req);
      const effectiveAt = body.effectiveAt ? new Date(body.effectiveAt).toISOString() : new Date().toISOString();
      if (body.effectiveAt && Number.isNaN(new Date(body.effectiveAt).getTime())) {
        throw new PayOpsError('Role effective time is invalid.', 'finance_role_effective_invalid', 400);
      }
      const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
      if (body.expiresAt && Number.isNaN(new Date(body.expiresAt).getTime())) {
        throw new PayOpsError('Role expiration is invalid.', 'finance_role_expiry_invalid', 400);
      }

      const targetResult = await authed.db.from('profiles')
        .select('id,status,role')
        .eq('tenant_id', authed.tenantId)
        .eq('id', targetProfileId)
        .maybeSingle();
      if (targetResult.error) throw targetResult.error;
      if (!targetResult.data || targetResult.data.status !== 'active') {
        throw new PayOpsError('The finance operator must be active.', 'finance_operator_invalid', 409);
      }

      const result = await authed.db.rpc('assign_finance_role', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_target_profile_id: targetProfileId,
        p_finance_role: financeRole,
        p_reason_code: reasonCode,
        p_assignment_key: assignmentKey,
        p_effective_at: effectiveAt,
        p_expires_at: expiresAt,
      });
      if (result.error) throw normalizePayOpsDbError(result.error);
      return res.status(201).json({ role: roleView(result.data, new Map()) });
    }

    if (req.method === 'PATCH') {
      const authed = await requireFinanceAdmin(req, res, { stepUp: true });
      if (!authed) return;
      const body = parseBody(req);
      const assignmentId = cleanUuid(body.assignmentId, 'assignmentId');
      const expectedVersion = cleanExpectedVersion(body.expectedVersion);
      const reasonCode = cleanReasonCode(body.reasonCode);
      const idempotencyKey = cleanIdempotencyKey(req);
      const result = await authed.db.rpc('revoke_finance_role', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_assignment_id: assignmentId,
        p_expected_version: expectedVersion,
        p_reason_code: reasonCode,
        p_idempotency_key: idempotencyKey,
      });
      if (result.error) throw normalizePayOpsDbError(result.error);
      return res.status(200).json({ role: roleView(result.data, new Map()) });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'Finance role management is unavailable.');
  }
}
