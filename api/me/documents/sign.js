/**
 * POST /api/me/documents/sign
 *
 * Capture a patient's typed e-signature against an active consent document.
 *
 * Body: { documentId, typedName, agree }
 * Guards: agree must be `true`, typedName must be ≥ 3 chars after trim, doc
 * must be `status='active'` and not retired. Idempotent — if the user already
 * signed THIS version, returns the existing signature with 200.
 *
 * Schema note (see migrations/003_healthcare_os_core.sql):
 *   consent_signatures requires `signature_hash` (text NOT NULL). There is no
 *   `signature_data jsonb` column — we encode {typedName, ip, userAgent} into
 *   the signature_hash payload (sha256 hex) and also persist `ip_address` and
 *   `user_agent` to the dedicated columns. The plain-text typed name is NOT
 *   stored — the hash is the tamper-evident record, matching the
 *   `immutable=true` default and the trigger that blocks UPDATE/DELETE on
 *   signed rows.
 */
import crypto from 'crypto';
import { getAuthedUser } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { upsertHubspotContact } from '../../_hubspot.js';

function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || null;
}

// Best-effort sanitiser: Postgres `inet` rejects strings like "::ffff:1.2.3.4"
// in some pools — strip the IPv6→IPv4 prefix. Return null on anything weird.
function safeInet(addr) {
  if (!addr) return null;
  const s = String(addr).trim();
  if (!s) return null;
  if (s.startsWith('::ffff:')) return s.slice(7);
  return s;
}

function hashSignature({ typedName, version, ip, userAgent, signedAt }) {
  const payload = JSON.stringify({
    typedName: String(typedName).trim().toLowerCase(),
    version: String(version || ''),
    ip: ip || '',
    userAgent: userAgent || '',
    signedAt: signedAt || '',
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/** Resolve or create the `people` row for the signing user. */
async function getOrCreatePerson(db, user, email, tenantId) {
  // Prefer the explicit auth-link.
  let { data } = await db.from('people').select('id').eq('profile_id', user.id).limit(1);
  if (data && data[0]?.id) return data[0].id;
  if (email) {
    let q = db.from('people').select('id').ilike('email', email).limit(1);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data: byEmail } = await q;
    if (byEmail && byEmail[0]?.id) {
      // Backfill the profile link so future lookups are O(1).
      try { await db.from('people').update({ profile_id: user.id }).eq('id', byEmail[0].id); } catch { /* best-effort */ }
      return byEmail[0].id;
    }
  }
  // No row yet — create one so the signature has a valid FK target.
  if (!tenantId) return null; // schema requires tenant_id NOT NULL
  const displayName = (user.user_metadata?.full_name || email || 'Member').trim();
  const { data: created, error } = await db.from('people')
    .insert({
      tenant_id: tenantId,
      profile_id: user.id,
      display_name: displayName,
      email: email || null,
      source_of_truth: 'avalon_os',
      phi_classification: 'phi',
    })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return created?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, user, email, tenantId } = authed;

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const documentId = String(body.documentId || '').trim();
  const typedName = String(body.typedName || '').trim();
  const agree = body.agree === true;

  if (!documentId) return res.status(400).json({ error: 'documentId is required.' });
  if (!agree) return res.status(400).json({ error: 'You must agree to the consent to sign.' });
  if (typedName.length < 3) return res.status(400).json({ error: 'Please type your full legal name.' });

  try {
    // Load the document; verify it's active for this tenant.
    let docQuery = db.from('consent_documents')
      .select('id, tenant_id, consent_type, title, version, status, retired_at')
      .eq('id', documentId)
      .maybeSingle();
    const { data: doc, error: docErr } = await docQuery;
    if (docErr) throw docErr;
    if (!doc) return res.status(404).json({ error: 'Consent document not found.' });
    if (tenantId && doc.tenant_id !== tenantId) return res.status(403).json({ error: 'Consent not available to your account.' });
    if (doc.status !== 'active' || doc.retired_at) {
      return res.status(409).json({ error: 'This consent is no longer active.' });
    }

    const personId = await getOrCreatePerson(db, user, email, doc.tenant_id);
    if (!personId) return res.status(409).json({ error: 'Could not link signer to a patient record.' });

    // Idempotency: already signed THIS version?
    const { data: existing, error: existingErr } = await db.from('consent_signatures')
      .select('id, signed_at')
      .eq('consent_document_id', doc.id)
      .eq('patient_person_id', personId)
      .order('signed_at', { ascending: false })
      .limit(1);
    if (existingErr) throw existingErr;
    if (existing && existing[0]) {
      return res.status(200).json({
        ok: true,
        idempotent: true,
        signature: {
          id: existing[0].id,
          documentId: doc.id,
          signedAt: existing[0].signed_at,
          version: doc.version,
        },
      });
    }

    const signedAt = new Date().toISOString();
    const ipRaw = clientIp(req);
    const ip = safeInet(ipRaw);
    const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 500) || null;
    const signatureHash = hashSignature({
      typedName,
      version: doc.version,
      ip: ipRaw || '',
      userAgent,
      signedAt,
    });

    const { data: inserted, error: insertErr } = await db.from('consent_signatures')
      .insert({
        tenant_id: doc.tenant_id,
        patient_person_id: personId,
        consent_document_id: doc.id,
        signer_role: 'patient',
        signature_hash: signatureHash,
        signed_at: signedAt,
        ip_address: ip,
        user_agent: userAgent,
        immutable: true,
      })
      .select('id, signed_at')
      .maybeSingle();
    if (insertErr) throw insertErr;

    await writeAuditEvent(db, {
      tenantId: doc.tenant_id || tenantId || null,
      actorProfileId: user.id || null,
      action: 'consent_signed',
      entityType: 'consent_signatures',
      entityId: inserted?.id || null,
      phiTouched: false,
      payload: {
        documentSlug: `${doc.consent_type}-${doc.version}`,
        consentType: doc.consent_type,
        version: doc.version,
      },
    });

    // Fire-and-forget HubSpot metadata update. NEVER send the signature hash,
    // the typed name, ip, or user_agent — only the consent-type timestamp +
    // version. Best-effort; consent signing must not block on CRM.
    if (email) {
      const consentPayload = { email };
      if (doc.consent_type === 'hipaa') {
        consentPayload.hipaaNppSignedAt = inserted?.signed_at || signedAt;
        consentPayload.hipaaNppVersion = doc.version || null;
      } else if (doc.consent_type === 'general_treatment') {
        consentPayload.termsSignedAt = inserted?.signed_at || signedAt;
      }
      // Only fire when we have something to update beyond the email.
      if (consentPayload.hipaaNppSignedAt || consentPayload.termsSignedAt) {
        upsertHubspotContact(consentPayload).catch((err) => {
          console.warn('[me/documents/sign] hubspot consent sync failed', safeLogContext(err, 'hubspot_consent_sync_failed'));
        });
      }
    }

    return res.status(200).json({
      ok: true,
      signature: {
        id: inserted?.id || null,
        documentId: doc.id,
        signedAt: inserted?.signed_at || signedAt,
        version: doc.version,
      },
    });
  } catch (err) {
    console.warn('[me/documents/sign] failed', safeLogContext(err, 'me_documents_sign_failed'));
    return res.status(500).json({
      error: 'Could not save your signature.',
      code: safeErrorCode(err, 'me_documents_sign_failed'),
    });
  }
}
