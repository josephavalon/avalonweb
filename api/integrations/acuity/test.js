/**
 * GET /api/integrations/acuity/test
 *
 * Verifies Acuity credentials from backend without exposing the API key.
 * Use this in the admin Acuity sync panel to confirm the connection.
 *
 * Response:
 *   200  { ok: true, connected: true, provider: 'acuity', user_id: '...' }
 *   500  { ok: false, connected: false, error: '...' }
 */

import { getMe } from '../../_acuity.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // In production: enforce admin auth here before exposing
  // e.g. verifySupabaseSession(req) and check role === 'admin'

  try {
    const me = await getMe();

    return res.status(200).json({
      ok:        true,
      connected: true,
      provider:  'acuity',
      user_id:   process.env.ACUITY_USER_ID,
      // Safe fields from /me — never include the API key
      account: {
        name:     me.name  || null,
        email:    me.email || null,
        timezone: me.timezone || null,
      },
    });
  } catch (err) {
    console.error('[acuity/test]', err.message);
    return res.status(500).json({
      ok:        false,
      connected: false,
      provider:  'acuity',
      error:     err.message,
    });
  }
}
