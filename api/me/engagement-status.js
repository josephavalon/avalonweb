import { requireRole } from '../_lib/supabase-auth.js';
import { safeLogContext } from '../_lib/safe-error.js';
import {
  NURSE_ROLES,
  engagementFromPreferences,
  loadWorkPreferences,
  publicProvider,
  resolveNurseProvider,
  sendNurseWorkflowError,
} from '../_lib/nurse-workflow.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    const provider = await resolveNurseProvider(authed);
    const preferences = await loadWorkPreferences(authed.db, authed.tenantId, provider.id);
    const engagementStatus = engagementFromPreferences(preferences);
    return res.status(200).json({
      provider: publicProvider(provider, engagementStatus),
      engagement_status: engagementStatus,
      version: preferences?.version || null,
      updated_at: preferences?.updated_at || null,
    });
  } catch (error) {
    console.warn('[me/engagement-status] failed', safeLogContext(error, 'nurse_engagement_status_failed'));
    return sendNurseWorkflowError(res, error, 'Could not load nurse engagement status.');
  }
}

