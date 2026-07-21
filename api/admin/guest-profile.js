/**
 * PATCH /api/admin/guest-profile
 *
 * Staff-editable hospitality dossier for a client profile. Non-PHI: social
 * handles, style/wardrobe notes, beverage/music preferences, free-form
 * "anything to help" notes. On successful persist, fires a HubSpot upsert with
 * the new values so the CRM stays in sync.
 *
 * Body:
 *   {
 *     profileId: uuid,
 *     guestProfile: {
 *       instagram?, tiktok?, linkedin?,
 *       style?, wardrobe?,
 *       beverage?, music?,
 *       notes?, context?
 *     }
 *   }
 *
 * PHI GUARD: free-text fields are scanned by `api/_hubspot.js`'s allowlist
 * before the HubSpot payload is sent. If a health-related term is detected,
 * this endpoint returns 400 and the row is NOT persisted (so the DB row and
 * HubSpot don't disagree on state).
 */

import { requireStaff } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { upsertHubspotContact, HubspotPhiRefused, buildHubspotProperties } from '../_hubspot.js';

const FREETEXT_MAX = 2000;
const HANDLE_MAX = 200;

function clean(value, max = HANDLE_MAX) {
  const str = String(value ?? '').trim();
  return str.length > max ? str.slice(0, max) : str;
}

function pickGuestProfile(input = {}) {
  return {
    instagram: clean(input.instagram),
    tiktok: clean(input.tiktok),
    linkedin: clean(input.linkedin, 400),
    style: clean(input.style, FREETEXT_MAX),
    wardrobe: clean(input.wardrobe, FREETEXT_MAX),
    beverage: clean(input.beverage),
    music: clean(input.music),
    notes: clean(input.notes, FREETEXT_MAX),
    context: clean(input.context, FREETEXT_MAX),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    res.setHeader('Allow', 'PATCH, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;
  const { db, user, tenantId } = authed;

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const profileId = String(body.profileId || '').trim();
  const guestProfile = pickGuestProfile(body.guestProfile || {});

  if (!profileId) return res.status(400).json({ error: 'profileId is required.' });

  // Pre-check the outbound payload for PHI-shaped tokens BEFORE persisting so
  // the DB row and HubSpot never fall out of sync on a bad edit.
  try {
    buildHubspotProperties({ email: 'placeholder@example.com', guestProfile });
  } catch (err) {
    if (err instanceof HubspotPhiRefused) {
      return res.status(400).json({
        ok: false,
        error: 'Hospitality field contained health-related terms. This is a hospitality profile, not a chart — no medical notes.',
        code: 'hubspot_phi_refused',
        property: err.property,
      });
    }
    throw err;
  }

  try {
    // Load the target profile — need email/name/phone/tenant to sync HubSpot,
    // and to verify the row exists in the same tenant scope as the staff.
    const { data: profile, error: readErr } = await db
      .from('profiles')
      .select('id, tenant_id, email, phone, full_name, guest_profile')
      .eq('id', profileId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    if (tenantId && profile.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Profile is not in your tenant.' });
    }

    const now = new Date().toISOString();
    const merged = {
      ...(profile.guest_profile || {}),
      ...guestProfile,
      updatedBy: user.id,
      updatedAt: now,
    };

    const { error: updateErr } = await db
      .from('profiles')
      .update({ guest_profile: merged })
      .eq('id', profileId);
    if (updateErr) throw updateErr;

    await writeAuditEvent(db, {
      tenantId: profile.tenant_id || tenantId || null,
      actorProfileId: user.id,
      action: 'guest_profile_edit',
      entityType: 'profiles',
      entityId: profileId,
      phiTouched: false,
      payload: { keys: Object.keys(guestProfile).filter((k) => guestProfile[k]) },
    });

    // HubSpot sync — non-blocking on failure.
    let hubspotResult = null;
    if (profile.email) {
      try {
        hubspotResult = await upsertHubspotContact({
          email: profile.email,
          name: profile.full_name,
          phone: profile.phone,
          guestProfile: merged,
        });
        if (hubspotResult?.id && !hubspotResult?.skipped) {
          await db
            .from('profiles')
            .update({ hubspot_contact_id: hubspotResult.id, hubspot_synced_at: now })
            .eq('id', profileId);
        }
      } catch (err) {
        console.warn('[admin/guest-profile] hubspot sync failed', safeLogContext(err, 'hubspot_sync_failed'));
      }
    }

    return res.status(200).json({
      ok: true,
      profileId,
      guestProfile: merged,
      hubspot: hubspotResult ? {
        id: hubspotResult.id || null,
        skipped: Boolean(hubspotResult.skipped),
        reason: hubspotResult.reason || null,
      } : null,
    });
  } catch (err) {
    console.error('[admin/guest-profile]', safeLogContext(err, 'guest_profile_update_failed'));
    return res.status(err.status || 500).json({
      ok: false,
      error: 'Could not update guest profile.',
      code: safeErrorCode(err, 'guest_profile_update_failed'),
    });
  }
}
