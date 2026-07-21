/**
 * POST /api/me/conversations/create
 *
 * Let a signed-in member START a new conversation with their care team.
 *
 * Security invariant (HARD): a member may only open a thread with the CLINIC's
 * care team — active `admin` / `nurse` profiles in the member's own tenant.
 * A member can NEVER be wired up to message another patient. We resolve the
 * recipients server-side from the roster (the request body cannot name them),
 * and we run on the service-role client (RLS bypass) but re-enforce the
 * tenant + care-team-role filter in JS — mirroring the launch messaging RLS
 * (002/011/020): "clients can start support conversations with active
 * admins/nurses."
 *
 * Body: { body: string (required), subject?: string }
 * Returns: { conversation: { id, subject, counterpartyName }, message: {...} }
 *   shaped so Messages.jsx can refresh threads and open the new one.
 */

import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { getAuthedUser } from '../../_lib/supabase-auth.js';

// Active operator/clinical roles a member is allowed to be matched with.
// Matches the launch messaging RLS support directory (admin | nurse).
const CARE_TEAM_ROLES = ['nurse', 'admin'];

// Body length mirrors the messages table CHECK constraint (1..4000).
const MAX_BODY = 4000;
const MAX_SUBJECT = 200;
// Cap how many care-team members we attach so a large tenant roster doesn't
// balloon the participant list. The whole point is "reaches the care team."
const MAX_CARE_TEAM_PARTICIPANTS = 8;

function cleanString(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

/**
 * Resolve the care-team recipients for this member: active admin/nurse profiles
 * in the member's tenant. Clinical (nurse) first, then admins. Never clients.
 */
async function resolveCareTeam(db, tenantId, memberId) {
  let q = db
    .from('profiles')
    .select('id, full_name, role')
    .in('role', CARE_TEAM_ROLES)
    .eq('status', 'active')
    .neq('id', memberId);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q;
  if (error) throw error;

  const rows = (data || []).filter((p) => p?.id && CARE_TEAM_ROLES.includes(p.role));
  // Clinical staff first so the thread title reads as the care team, not ops.
  rows.sort((a, b) => CARE_TEAM_ROLES.indexOf(a.role) - CARE_TEAM_ROLES.indexOf(b.role));
  return rows.slice(0, MAX_CARE_TEAM_PARTICIPANTS);
}

function counterpartyNameFor(careTeam) {
  const names = careTeam
    .map((p) => p.full_name || (p.role ? `${p.role[0].toUpperCase()}${p.role.slice(1)}` : ''))
    .filter(Boolean);
  if (!names.length) return 'Avalon Care Team';
  return names.join(', ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });

  // Only members start care-team threads here. Operators (admin/nurse/staff)
  // have their own admin/team surfaces; don't let this client route create
  // operator-initiated threads.
  if (authed.role !== 'client') {
    return res.status(403).json({ error: 'This endpoint is for members.' });
  }

  const { db, user, tenantId } = authed;
  const memberId = user?.id;
  if (!memberId) return res.status(401).json({ error: 'Sign in required' });

  const rawBody = req.body && typeof req.body === 'object' ? req.body : {};
  const body = cleanString(rawBody.body, MAX_BODY);
  const subject = cleanString(rawBody.subject, MAX_SUBJECT) || null;

  if (!body) {
    return res.status(400).json({ error: 'Message body is required.' });
  }

  let careTeam;
  try {
    careTeam = await resolveCareTeam(db, tenantId, memberId);
  } catch (err) {
    console.warn('[me/conversations/create] care-team lookup failed', safeLogContext(err, 'care_team_lookup_failed'));
    return res.status(500).json({
      error: 'Could not reach your care team. Try again.',
      code: safeErrorCode(err, 'care_team_lookup_failed'),
    });
  }

  if (!careTeam.length) {
    // No active care-team member to route to. Better to tell the member than to
    // silently create a one-sided thread nobody on staff can see.
    return res.status(503).json({
      error: 'Your care team is unavailable right now. Please try again shortly.',
      code: 'care_team_unavailable',
    });
  }

  // 1) Create the conversation.
  const { data: convo, error: convoErr } = await db
    .from('conversations')
    .insert({ type: 'direct', subject })
    .select('id, subject')
    .single();
  if (convoErr || !convo) {
    console.warn('[me/conversations/create] conversation insert failed', safeLogContext(convoErr, 'conversation_insert_failed'));
    return res.status(500).json({
      error: 'Could not start the conversation. Try again.',
      code: safeErrorCode(convoErr, 'conversation_insert_failed'),
    });
  }

  // 2) Participants: the member (role 'client') + the resolved care team.
  //    These come from the roster, never from the request body.
  const now = new Date().toISOString();
  const participantRows = [
    { conversation_id: convo.id, user_id: memberId, role: 'client', last_read_at: now },
    ...careTeam.map((p) => ({ conversation_id: convo.id, user_id: p.id, role: p.role })),
  ];
  const { error: partErr } = await db.from('conversation_participants').insert(participantRows);
  if (partErr) {
    // Roll back the orphan conversation so the inbox doesn't show an empty,
    // un-joinable thread.
    try { await db.from('conversations').delete().eq('id', convo.id); } catch { /* best-effort */ }
    console.warn('[me/conversations/create] participants insert failed', safeLogContext(partErr, 'participants_insert_failed'));
    return res.status(500).json({
      error: 'Could not start the conversation. Try again.',
      code: safeErrorCode(partErr, 'participants_insert_failed'),
    });
  }

  // 3) First message from the member.
  const { data: message, error: msgErr } = await db
    .from('messages')
    .insert({ conversation_id: convo.id, sender_id: memberId, body })
    .select('id, conversation_id, sender_id, body, created_at')
    .single();
  if (msgErr || !message) {
    try { await db.from('conversations').delete().eq('id', convo.id); } catch { /* best-effort */ }
    console.warn('[me/conversations/create] first message insert failed', safeLogContext(msgErr, 'first_message_insert_failed'));
    return res.status(500).json({
      error: 'Could not send your message. Try again.',
      code: safeErrorCode(msgErr, 'first_message_insert_failed'),
    });
  }

  await writeAuditEvent(db, {
    tenantId: tenantId || null,
    actorProfileId: memberId,
    action: 'member_conversation_started',
    entityType: 'conversations',
    entityId: convo.id,
    phiTouched: true,
    payload: {
      route: 'api/me/conversations/create',
      careTeamCount: careTeam.length,
      hasSubject: Boolean(subject),
      tenantScoped: Boolean(tenantId),
    },
  });

  return res.status(201).json({
    conversation: {
      id: convo.id,
      subject: convo.subject || null,
      counterpartyName: counterpartyNameFor(careTeam),
    },
    message,
  });
}
