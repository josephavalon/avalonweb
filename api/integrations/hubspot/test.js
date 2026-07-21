/**
 * GET /api/integrations/hubspot/test
 *
 * Verifies HubSpot credentials from the backend without exposing the access token.
 */

import { getHubspotConfigStatus, identifyHubspot } from '../../_hubspot.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { isLiveApiEnabled } from '../../_lib/pre-api-guard.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = getHubspotConfigStatus();
    if (!isLiveApiEnabled()) {
      return res.status(200).json({
        ok: false,
        connected: false,
        provider: 'hubspot',
        configured: config.hasToken,
        syncEnabled: config.syncEnabled,
        mode: 'local-simulation-only',
        preApiHardWall: true,
      });
    }

    const authed = await requireAdmin(req, res);
    if (!authed) return;

    if (!config.hasToken) {
      return res.status(200).json({
        ok: false,
        connected: false,
        provider: 'hubspot',
        configured: false,
        syncEnabled: config.syncEnabled,
        error: 'HUBSPOT_ACCESS_TOKEN is not configured',
      });
    }

    const self = await identifyHubspot();
    if (self?.skipped) {
      return res.status(200).json({
        ok: false,
        connected: false,
        provider: 'hubspot',
        configured: true,
        syncEnabled: false,
        error: 'HUBSPOT_SYNC_ENABLED is not true — sync is kill-switched off',
      });
    }
    return res.status(200).json({
      ok: true,
      connected: true,
      provider: 'hubspot',
      configured: true,
      syncEnabled: config.syncEnabled,
      portalId: self?.portalId || config.portalId || null,
      account: {
        portalId: self?.portalId || null,
        accountType: self?.accountType || null,
        timeZone: self?.timeZone || null,
        currency: self?.companyCurrency || null,
      },
    });
  } catch (err) {
    console.error('[hubspot/test]', safeLogContext(err, 'hubspot_test_failed'));
    return res.status(err.status || 500).json({
      ok: false,
      connected: false,
      provider: 'hubspot',
      configured: true,
      error: 'CRM connection check failed',
      code: safeErrorCode(err, 'hubspot_test_failed'),
    });
  }
}
