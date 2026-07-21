/**
 * POST /api/admin/events/organizer-invite
 *
 * Admin-only approval handoff. Binds an organizer identity to one already
 * approved event. Existing organizers are assigned immediately; first-time
 * organizers receive the same hashed-token account invitation used by staff.
 */
import { requireAdmin } from '../../_lib/supabase-auth.js';
import { checkRateLimit, clientIp } from '../../_lib/rate-limit.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { sendInviteEmail } from '../../_lib/invite-email.js';
import { generateToken, generateCode, hashToken, hashCode } from '../../_lib/invite-token.js';
import { safeErrorCode } from '../../_lib/safe-error.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPROVED_STATUSES = new Set(['presale', 'public', 'sold_out']);

function siteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://avalonvitality.co').replace(/\/$/, '');
}

async function grantOrganizerPortal(db, userId) {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data?.user) throw error || new Error('Existing account not found.');
  const currentMetadata = data.user.app_metadata || {};
  const currentPortals = Array.isArray(currentMetadata.portal_access) ? currentMetadata.portal_access : [];
  const portalAccess = [...new Set([...currentPortals, 'organizer'])];
  const { error: updateError } = await db.auth.admin.updateUserById(userId, {
    app_metadata: { ...currentMetadata, portal_access: portalAccess },
  });
  if (updateError) throw updateError;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authed = await requireAdmin(req, res);
  if (!authed) return;

  const limit = await checkRateLimit({ key: `event-organizer-invite:${clientIp(req)}`, windowMs: 60_000, max: 20 });
  if (!limit.ok) return res.status(429).json({ error: 'Too many organizer invites. Try again shortly.' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const fullName = String(req.body?.fullName || '').trim() || null;
  const containerId = String(req.body?.containerId || '').trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid organizer email is required.' });
  if (!containerId) return res.status(400).json({ error: 'An approved event is required.' });

  const { db, tenantId } = authed;
  try {
    let eventQuery = db.from('event_containers').select('id, name, slug, status, tenant_id').eq('id', containerId);
    if (tenantId) eventQuery = eventQuery.eq('tenant_id', tenantId);
    const { data: event, error: eventError } = await eventQuery.maybeSingle();
    if (eventError) throw eventError;
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (!APPROVED_STATUSES.has(event.status)) {
      return res.status(409).json({ error: 'Approve the event before issuing organizer access.', code: 'event_not_approved' });
    }

    let profileQuery = db.from('profiles').select('id, role, status, tenant_id').eq('email', email);
    if (tenantId) profileQuery = profileQuery.eq('tenant_id', tenantId);
    const { data: profile } = await profileQuery.maybeSingle();

    if (profile?.status === 'active') {
      const { error } = await db.from('event_promoters').upsert({
        tenant_id: event.tenant_id,
        profile_id: profile.id,
        container_id: event.id,
        created_by: authed.user?.id || null,
      }, { onConflict: 'profile_id,container_id' });
      if (error) throw error;
      // Existing users keep the same auth identity, password, and canonical
      // role. Event Hub is an additional scoped portal entitlement.
      await grantOrganizerPortal(db, profile.id);
      await writeAuditEvent(db, {
        tenantId: event.tenant_id,
        actorProfileId: authed.user?.id || null,
        action: 'event_organizer_assigned',
        entityType: 'event_container',
        entityId: event.id,
        payload: { organizer_profile_id: profile.id, preserved_role: profile.role, reused_credentials: true },
      });
      return res.status(200).json({
        ok: true,
        assigned: true,
        invited: false,
        reusedCredentials: true,
        preservedRole: profile.role,
        event: { id: event.id, name: event.name, slug: event.slug },
      });
    }
    if (profile && profile.status !== 'active') return res.status(409).json({ error: 'That Avalon account is not active.' });

    const token = generateToken();
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await db.from('invitations').update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('email', email).eq('invited_role', 'promoter').eq('status', 'pending');

    const { data: invitation, error: inviteError } = await db.from('invitations').insert({
      tenant_id: event.tenant_id,
      email,
      full_name: fullName,
      invited_role: 'promoter',
      event_container_id: event.id,
      invited_by: authed.user?.id || null,
      status: 'pending',
      token_hash: hashToken(token),
      code_hash: hashCode(email, code),
      expires_at: expiresAt,
    }).select('id').single();
    if (inviteError) throw inviteError;

    const inviteUrl = `${siteUrl()}/invite/accept?token=${encodeURIComponent(token)}`;
    await sendInviteEmail({ to: email, inviteUrl, code, role: 'promoter', inviterName: authed.email });
    await writeAuditEvent(db, {
      tenantId: event.tenant_id,
      actorProfileId: authed.user?.id || null,
      action: 'event_organizer_invited',
      entityType: 'event_container',
      entityId: event.id,
      payload: { invitation_id: invitation.id, organizer_email: email },
    });
    return res.status(200).json({ ok: true, assigned: false, invited: true, inviteId: invitation.id, event: { id: event.id, name: event.name, slug: event.slug } });
  } catch (error) {
    console.error('[event-organizer-invite]', error?.message || error);
    return res.status(error?.status || 500).json({ error: 'Could not issue organizer access.', code: safeErrorCode(error, 'event_organizer_invite_failed') });
  }
}
