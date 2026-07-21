/**
 * comm-store — persistence for the two-way client messaging inbox.
 *
 * Threads are keyed by (channel, contact) where contact is an E.164 phone or an
 * email. Outbound is logged when the admin sends; inbound is logged by the Quo
 * webhook. All access goes through the service-role client (RLS-bypassing) —
 * these helpers are server-only. Every function is best-effort and never throws
 * so a logging failure can't break the actual send.
 */
import { getServiceClient } from './supabase-auth.js';
import { safeLogContext } from './safe-error.js';

function preview(body) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

async function upsertThread(db, { tenantId, channel, contact, name, body, direction, bumpUnread }) {
  const now = new Date().toISOString();
  // Find existing thread for this contact + channel.
  const { data: existing } = await db
    .from('comm_threads')
    .select('id, unread_count, customer_name, tenant_id')
    .eq('channel', channel)
    .eq('contact', contact)
    .limit(1);
  const row = existing?.[0];

  if (row) {
    const update = {
      last_message_at: now,
      last_message_preview: preview(body),
      last_direction: direction,
      updated_at: now,
    };
    if (name && !row.customer_name) update.customer_name = name;
    if (tenantId && !row.tenant_id) update.tenant_id = tenantId;
    if (bumpUnread) update.unread_count = (row.unread_count || 0) + 1;
    await db.from('comm_threads').update(update).eq('id', row.id);
    return row.id;
  }

  const { data: created, error } = await db
    .from('comm_threads')
    .insert({
      tenant_id: tenantId || null,
      channel,
      contact,
      customer_name: name || null,
      last_message_at: now,
      last_message_preview: preview(body),
      last_direction: direction,
      unread_count: bumpUnread ? 1 : 0,
    })
    .select('id')
    .limit(1);
  if (error) throw error;
  return created?.[0]?.id || null;
}

/** Log a message the admin sent (call after the provider accepts it). */
export async function recordOutbound({ tenantId = null, channel = 'sms', contact, name = null, body, providerMessageId = null, sentBy = null }) {
  try {
    const db = await getServiceClient();
    if (!db || !contact || !body) return;
    const threadId = await upsertThread(db, { tenantId, channel, contact, name, body, direction: 'outbound', bumpUnread: false });
    if (!threadId) return;
    await db.from('comm_messages').insert({
      thread_id: threadId, tenant_id: tenantId || null, direction: 'outbound', channel,
      body: String(body), provider_message_id: providerMessageId, sent_by: sentBy,
    });
  } catch (err) {
    console.warn('[comm-store] recordOutbound failed', safeLogContext(err, 'comm_record_outbound_failed'));
  }
}

/** Log a message a client sent us (called by the Quo inbound webhook). */
export async function recordInbound({ channel = 'sms', contact, name = null, body, providerMessageId = null, tenantId = null }) {
  try {
    const db = await getServiceClient();
    if (!db || !contact || !body) return null;
    const threadId = await upsertThread(db, { tenantId, channel, contact, name, body, direction: 'inbound', bumpUnread: true });
    if (!threadId) return null;
    await db.from('comm_messages').insert({
      thread_id: threadId, tenant_id: tenantId || null, direction: 'inbound', channel,
      body: String(body), provider_message_id: providerMessageId, sent_by: null,
    });
    return threadId;
  } catch (err) {
    console.warn('[comm-store] recordInbound failed', safeLogContext(err, 'comm_record_inbound_failed'));
    return null;
  }
}
