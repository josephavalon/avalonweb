/**
 * GET /api/admin/communications/threads
 *
 * Staff/admin: list client message threads (SMS today) for the inbox, newest
 * activity first. Null-tenant threads are deliberately excluded: the
 * service-role client bypasses RLS, and unassigned data has no authorized
 * operator audience.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;
  const { db, tenantId } = authed;

  const query = db
    .from('comm_threads')
    .select('id, channel, contact, customer_name, last_message_at, last_message_preview, last_direction, unread_count')
    .eq('tenant_id', tenantId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(500);

  const { data, error } = await query;
  if (error) {
    console.warn('[admin/threads] query failed', safeLogContext(error, 'admin_threads_query_failed'));
    return res.status(500).json({ error: 'Could not load conversations.', code: safeErrorCode(error, 'admin_threads_query_failed') });
  }
  return res.status(200).json({ threads: data || [] });
}
