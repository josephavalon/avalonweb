/**
 * GET /api/integrations/attio/test
 *
 * Verifies Attio credentials from the backend without exposing the access token.
 */

import { getAttioConfigStatus, identifyAttio } from '../../_attio.js';
import { isLiveApiEnabled } from '../../_lib/pre-api-guard.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = getAttioConfigStatus();
    if (!isLiveApiEnabled()) {
      return res.status(200).json({
        ok: false,
        connected: false,
        provider: 'attio',
        configured: config.hasToken,
        mode: 'local-simulation-only',
        preApiHardWall: true,
      });
    }

    if (!config.hasToken) {
      return res.status(200).json({
        ok: false,
        connected: false,
        provider: 'attio',
        configured: false,
        error: 'ATTIO_ACCESS_TOKEN is not configured',
      });
    }

    const self = await identifyAttio();
    return res.status(200).json({
      ok: true,
      connected: true,
      provider: 'attio',
      configured: true,
      workspaceId: config.workspaceId,
      peopleObject: config.peopleObject,
      account: {
        active: self?.active ?? null,
        actor: self?.data?.actor || self?.actor || null,
        workspace: self?.data?.workspace || self?.workspace || null,
      },
    });
  } catch (err) {
    console.error('[attio/test]', err.message);
    return res.status(err.status || 500).json({
      ok: false,
      connected: false,
      provider: 'attio',
      configured: true,
      error: err.message,
    });
  }
}
