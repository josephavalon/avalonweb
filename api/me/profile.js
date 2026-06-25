/**
 * GET /api/me/profile
 *
 * The signed-in client's fast-checkout cache: their synced GFE record and saved
 * service address (populated from Acuity by the GFE sync). BookNow reads this to
 * prefill the address and treat a cleared (<1yr) GFE as on-file. PHI-light: only
 * the caller's own GFE status/expiry + their saved address.
 */
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  if (!authed.email) return res.status(200).json({ gfe: null, savedAddress: null });

  const { db, email } = authed;
  const { data, error } = await db.from('profiles')
    .select('gfe, saved_address')
    .eq('email', email)
    .maybeSingle();
  if (error) {
    console.warn('[me/profile] read failed', safeLogContext(error, 'me_profile_read_failed'));
    return res.status(500).json({ error: 'Could not load profile.', code: safeErrorCode(error, 'me_profile_read_failed') });
  }
  const gfe = data?.gfe && Object.keys(data.gfe).length ? data.gfe : null;
  return res.status(200).json({ gfe, savedAddress: data?.saved_address || null });
}
