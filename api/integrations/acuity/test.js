/**
 * GET /api/integrations/acuity/test
 *
 * Verifies scheduling credentials from backend without exposing the API key.
 * Use this in the admin scheduling sync panel to confirm the connection.
 *
 * Response:
 *   200  { ok: true, connected: true, provider: 'scheduling', user_id: '...' }
 *   500  { ok: false, connected: false, error: '...' }
 */

import { getMe } from '../../_acuity.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { isLiveApiEnabled } from '../../_lib/pre-api-guard.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!isLiveApiEnabled()) {
      return res.status(200).json({
        ok: false,
        connected: false,
        provider: 'scheduling',
        mode: 'local-simulation-only',
        preApiHardWall: true,
      });
    }

    const authed = await requireAdmin(req, res);
    if (!authed) return;

    const me = await getMe();

    return res.status(200).json({
      ok:        true,
      connected: true,
      provider:  'scheduling',
      user_id:   process.env.ACUITY_USER_ID,
      // Safe fields from /me — never include the API key
      account: {
        name:     me.name  || null,
        email:    me.email || null,
        timezone: me.timezone || null,
      },
    });
  } catch (err) {
    console.error('[acuity/test]', safeLogContext(err, 'acuity_test_failed'));
    return res.status(500).json({
      ok:        false,
      connected: false,
      provider:  'scheduling',
      error:     'Scheduling connection check failed',
      code:      safeErrorCode(err, 'acuity_test_failed'),
    });
  }
}
