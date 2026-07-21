/**
 * /api/me/profile
 *
 * GET — return the signed-in client's unified profile: the identity + PHI +
 * comm-prefs the Account page edits, alongside the existing GFE cache +
 * Acuity-synced service address that BookNow consumes for fast checkout.
 *
 * PATCH — accept a subset of editable fields from the Account page and write
 * them back to `profiles`. Any change that touches PHI (the `phi` blob or
 * `emergency_contact`) emits an audit event so HIPAA logging stays intact even
 * when the patient self-edits.
 *
 * PHI surface: only the caller's own row is ever read/written.
 */
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

// Columns we expose on the profile API. Kept in one place so GET and PATCH
// agree on the wire shape, and the field allow-list for PATCH is derived from
// it (any other key in the body is dropped silently).
const PROFILE_COLUMNS = `
  id, email, phone, role, status, tenant_id,
  full_name, preferred_name, address, date_of_birth,
  emergency_contact, phi, comm_prefs, stripe_customer_id,
  gfe, saved_address
`;

// Map snake_case DB row → the camelCase shape the React client uses. Returning
// a stable shape (with explicit nulls) means the page can rely on optional
// chaining without a null-row check.
function toClientProfile(row, authedEmail) {
  if (!row) {
    return {
      id: null,
      email: authedEmail || null,
      phone: null,
      fullName: null,
      preferredName: null,
      address: null,
      dateOfBirth: null,
      emergencyContact: null,
      phi: null,
      commPrefs: null,
      stripeCustomerId: null,
      gfe: null,
      savedAddress: null,
    };
  }
  const gfe = row.gfe && Object.keys(row.gfe).length ? row.gfe : null;
  return {
    id: row.id || null,
    email: row.email || authedEmail || null,
    phone: row.phone || null,
    fullName: row.full_name || null,
    preferredName: row.preferred_name || null,
    address: row.address || null,
    dateOfBirth: row.date_of_birth || null,
    emergencyContact: row.emergency_contact || null,
    phi: row.phi || null,
    commPrefs: row.comm_prefs || null,
    stripeCustomerId: row.stripe_customer_id || null,
    gfe,
    savedAddress: row.saved_address || null,
  };
}

// camelCase body → snake_case update patch. Unknown keys are dropped. Returns
// { patch, phiFields } so the caller can decide whether to write an audit row.
function buildUpdatePatch(body = {}) {
  const patch = {};
  const phiFields = [];
  if (Object.prototype.hasOwnProperty.call(body, 'fullName'))         patch.full_name         = body.fullName ?? null;
  if (Object.prototype.hasOwnProperty.call(body, 'preferredName'))    patch.preferred_name    = body.preferredName ?? null;
  if (Object.prototype.hasOwnProperty.call(body, 'address'))          patch.address           = body.address ?? null;
  if (Object.prototype.hasOwnProperty.call(body, 'dateOfBirth'))      patch.date_of_birth     = body.dateOfBirth || null;
  if (Object.prototype.hasOwnProperty.call(body, 'phone'))            patch.phone             = body.phone ?? null;
  if (Object.prototype.hasOwnProperty.call(body, 'emergencyContact')) {
    patch.emergency_contact = body.emergencyContact ?? null;
    phiFields.push('emergency_contact');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'phi')) {
    patch.phi = body.phi ?? null;
    phiFields.push('phi');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'commPrefs')) {
    patch.comm_prefs = body.commPrefs ?? null;
  }
  return { patch, phiFields };
}

async function readProfileRow(db, userId, email) {
  // Prefer the auth-id match (post-007 trigger seeds it); fall back to email
  // for legacy rows that pre-date the auth trigger.
  let { data, error } = await db.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
  if (!data && email) {
    ({ data, error } = await db.from('profiles').select(PROFILE_COLUMNS).eq('email', email).maybeSingle());
  }
  return { data: data || null, error: error || null };
}

export default async function handler(req, res) {
  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, user, email, tenantId } = authed;

  if (req.method === 'GET') {
    if (!email) {
      // Mirror legacy behaviour: a session with no email still gets a 200 +
      // empty shape so the page can render the form skeleton without erroring.
      const empty = toClientProfile(null, null);
      return res.status(200).json({ profile: empty, gfe: null, savedAddress: null });
    }
    try {
      const { data, error } = await readProfileRow(db, user.id, email);
      if (error) throw error;
      const profile = toClientProfile(data, email);
      // Legacy fields stay at the top level for BookNow / GFE consumers that
      // already read { gfe, savedAddress } from this endpoint.
      return res.status(200).json({ profile, gfe: profile.gfe, savedAddress: profile.savedAddress });
    } catch (err) {
      console.warn('[me/profile] read failed', safeLogContext(err, 'me_profile_read_failed'));
      return res.status(500).json({ error: 'Could not load profile.', code: safeErrorCode(err, 'me_profile_read_failed') });
    }
  }

  if (req.method === 'PATCH') {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const { patch, phiFields } = buildUpdatePatch(body);
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'No editable fields in request body.' });
    }
    try {
      // Constrain the update to the caller's own row. Service-role bypasses
      // RLS, so the `eq('id', user.id)` is the actual authorization boundary.
      const { data, error } = await db.from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select(PROFILE_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // No row matched the auth id — likely a legacy email-only profile. Try
        // an update by email so the patient can still save while the trigger
        // backfill catches up.
        if (email) {
          const { data: byEmail, error: byEmailErr } = await db.from('profiles')
            .update(patch)
            .eq('email', email)
            .select(PROFILE_COLUMNS)
            .maybeSingle();
          if (byEmailErr) throw byEmailErr;
          if (byEmail) {
            if (phiFields.length) {
              await writeAuditEvent(db, {
                tenantId: byEmail.tenant_id || tenantId || null,
                actorProfileId: byEmail.id || null,
                action: 'profile_self_edit_phi',
                entityType: 'profiles',
                entityId: byEmail.id || null,
                phiTouched: true,
                payload: { fields: phiFields },
              });
            }
            return res.status(200).json({ profile: toClientProfile(byEmail, email) });
          }
        }
        return res.status(404).json({ error: 'Profile not found for this account.' });
      }

      if (phiFields.length) {
        await writeAuditEvent(db, {
          tenantId: data.tenant_id || tenantId || null,
          actorProfileId: data.id || user.id || null,
          action: 'profile_self_edit_phi',
          entityType: 'profiles',
          entityId: data.id || user.id || null,
          phiTouched: true,
          payload: { fields: phiFields },
        });
      }

      return res.status(200).json({ profile: toClientProfile(data, email) });
    } catch (err) {
      console.warn('[me/profile] write failed', safeLogContext(err, 'me_profile_write_failed'));
      return res.status(500).json({ error: 'Could not save profile.', code: safeErrorCode(err, 'me_profile_write_failed') });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
