import { requireRole } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await requireRole(req, res, ['nurse', 'rn', 'np', 'admin']);
  if (!authed) return;
  try {
    const [profileRows, emailRows] = await Promise.all([
      authed.db.from('nurse_invoices').select('*').eq('tenant_id', authed.tenantId)
        .eq('nurse_profile_id', authed.user.id).order('submitted_at', { ascending: false }).limit(100),
      authed.email ? authed.db.from('nurse_invoices').select('*').eq('tenant_id', authed.tenantId)
        .ilike('nurse_email', authed.email).order('submitted_at', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    ]);
    if (profileRows.error) throw profileRows.error;
    if (emailRows.error) throw emailRows.error;
    const invoices = [...new Map([...(profileRows.data || []), ...(emailRows.data || [])].map((row) => [row.id, row])).values()]
      .sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at)).slice(0, 100);
    return res.status(200).json({ invoices });
  } catch (error) {
    console.warn('[me/nurse-invoices] failed', safeLogContext(error, 'me_nurse_invoices_failed'));
    return res.status(500).json({ error: 'Could not load invoices.', code: safeErrorCode(error, 'me_nurse_invoices_failed') });
  }
}
