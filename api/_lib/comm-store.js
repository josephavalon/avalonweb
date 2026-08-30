/**
 * comm-store — persistence for the two-way client messaging inbox.
 *
 * Threads are keyed by (tenant, channel, contact) where contact is an E.164
 * phone or an email. Outbound is logged when the admin sends; inbound is logged
 * by the Quo webhook. All access goes through the service-role client
 * (RLS-bypassing), so tenantId is mandatory on every read and write. These
 * helpers are server-only. Every exported function is best-effort and never
 * throws so a logging failure can't break the actual send.
 */
import { getServiceClient } from './supabase-auth.js';
import { safeLogContext } from './safe-error.js';

function preview(body) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

async function upsertThread(db, { tenantId, channel, contact, name, body, direction, bumpUnread }) {
  if (!tenantId) throw new Error('comm_tenant_id_required');
  const now = new Date().toISOString();
  // Find an existing thread only inside the explicitly authorized tenant.
  const { data: existing, error: lookupError } = await db
    .from('comm_threads')
    .select('id, unread_count, customer_name')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .eq('contact', contact)
    .limit(2);
  if (lookupError) throw lookupError;
  if ((existing || []).length > 1) throw new Error('comm_thread_scope_ambiguous');
  const row = existing?.[0];

  if (row) {
    const update = {
      last_message_at: now,
      last_message_preview: preview(body),
      last_direction: direction,
      updated_at: now,
    };
    if (name && !row.customer_name) update.customer_name = name;
    if (bumpUnread) update.unread_count = (row.unread_count || 0) + 1;
    const { error: updateError } = await db.from('comm_threads')
      .update(update)
      .eq('id', row.id)
      .eq('tenant_id', tenantId)
      .eq('channel', channel)
      .eq('contact', contact);
    if (updateError) throw updateError;
    return row.id;
  }

  const { data: created, error } = await db
    .from('comm_threads')
    .insert({
      tenant_id: tenantId,
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
export async function recordOutbound({ tenantId, channel = 'sms', contact, name = null, body, providerMessageId = null, sentBy = null }) {
  try {
    const db = await getServiceClient();
    if (!db || !tenantId || !contact || !body) return null;
    const threadId = await upsertThread(db, { tenantId, channel, contact, name, body, direction: 'outbound', bumpUnread: false });
    if (!threadId) return null;
    const { error } = await db.from('comm_messages').insert({
      thread_id: threadId, tenant_id: tenantId, direction: 'outbound', channel,
      body: String(body), provider_message_id: providerMessageId, sent_by: sentBy,
    });
    if (error) throw error;
    return threadId;
  } catch (err) {
    console.warn('[comm-store] recordOutbound failed', safeLogContext(err, 'comm_record_outbound_failed'));
    return null;
  }
}

/** Log a message a client sent us (called by the Quo inbound webhook). */
export async function recordInbound({ tenantId, channel = 'sms', contact, name = null, body, providerMessageId = null }) {
  try {
    const db = await getServiceClient();
    if (!db || !tenantId || !contact || !body) return null;
    const threadId = await upsertThread(db, { tenantId, channel, contact, name, body, direction: 'inbound', bumpUnread: true });
    if (!threadId) return null;
    const { error } = await db.from('comm_messages').insert({
      thread_id: threadId, tenant_id: tenantId, direction: 'inbound', channel,
      body: String(body), provider_message_id: providerMessageId, sent_by: null,
    });
    if (error) throw error;
    return threadId;
  } catch (err) {
    console.warn('[comm-store] recordInbound failed', safeLogContext(err, 'comm_record_inbound_failed'));
    return null;
  }
}
