/**
 * GET /api/me/documents
 *
 * Return the signed-in patient's consent documents — active versions for the
 * tenant joined against the caller's existing signatures, so the frontend can
 * render "pending / outdated / signed / historical" with one round-trip.
 *
 * Schema note (see migrations/003_healthcare_os_core.sql):
 *   - `consent_documents` does NOT carry body markdown; only body_hash. The
 *     human-readable body is templated client-side based on consent_type.
 *   - `consent_signatures.patient_person_id` references `public.people(id)`,
 *     which is resolved from the auth user via `people.profile_id = auth.uid`
 *     (or, as a fallback, by matching email).
 *
 * PHI surface: a signed-in member only ever sees their own signatures.
 */
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

// Per consent_type → human title + short summary used in the list view.
// Falls back to the row's own title when type isn't recognised.
const CONSENT_META = {
  hipaa: {
    fallbackTitle: 'HIPAA Notice of Privacy Practices',
    summary: 'How we use, share, and protect your health information.',
  },
  telehealth: {
    fallbackTitle: 'Telehealth Consent',
    summary: 'You consent to video/audio evaluation by a licensed provider before treatment.',
  },
  general_treatment: {
    fallbackTitle: 'General Treatment Consent',
    summary: 'Consent to IV therapy, intramuscular injections, and standard nursing assessment.',
  },
  treatment_specific: {
    fallbackTitle: 'Treatment-Specific Consent',
    summary: 'Risks, benefits, and alternatives for the protocol you booked.',
  },
  privacy: {
    fallbackTitle: 'Privacy Policy',
    summary: 'How your account data is handled outside of clinical records.',
  },
  liability: {
    fallbackTitle: 'Liability & Aftercare Acknowledgement',
    summary: 'Aftercare expectations and acknowledgement of inherent risks.',
  },
};

/** Lookup (do not create) the `people.id` linked to this auth user. */
async function resolvePersonId(db, userId, email, tenantId) {
  // Prefer the explicit auth-link.
  let q = db.from('people').select('id').eq('profile_id', userId).limit(1);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  let { data } = await q;
  if (data && data[0]?.id) return data[0].id;
  // Fallback: match by email (handles legacy rows created from Acuity sync
  // before the auth trigger linked them).
  if (email) {
    let q2 = db.from('people').select('id').ilike('email', email).limit(1);
    if (tenantId) q2 = q2.eq('tenant_id', tenantId);
    const { data: byEmail } = await q2;
    if (byEmail && byEmail[0]?.id) return byEmail[0].id;
  }
  return null;
}

/**
 * Pick the latest-effective active version per consent_type, since
 * `consent_documents` is versioned (unique on tenant+type+version) and a tenant
 * may keep multiple historical rows. We keep the freshest `effective_at`.
 */
function latestPerType(rows) {
  const byType = new Map();
  for (const row of rows || []) {
    const key = row.consent_type;
    const prev = byType.get(key);
    if (!prev) { byType.set(key, row); continue; }
    const a = prev.effective_at ? Date.parse(prev.effective_at) : 0;
    const b = row.effective_at ? Date.parse(row.effective_at) : 0;
    if (b > a) byType.set(key, row);
  }
  return [...byType.values()];
}

function metaFor(row) {
  const m = CONSENT_META[row.consent_type] || {};
  return {
    title: row.title || m.fallbackTitle || 'Consent document',
    summary: m.summary || 'Required before your next visit.',
  };
}

// Status detection: `pending` (active doc, no signature for this version),
// `outdated` (signed an OLDER version of the same type, latest is newer),
// `signed` (signed the latest active version), `historical` (signed a doc no
// longer active for the tenant — keep visible for the user's record).
function buildStatusList(activeDocs, signatures) {
  const byDoc = new Map();
  for (const sig of signatures || []) {
    const list = byDoc.get(sig.consent_document_id) || [];
    list.push(sig);
    byDoc.set(sig.consent_document_id, list);
  }
  const sigsByType = new Map();
  for (const sig of signatures || []) {
    const t = sig.consent_documents?.consent_type;
    if (!t) continue;
    const list = sigsByType.get(t) || [];
    list.push(sig);
    sigsByType.set(t, list);
  }

  const out = [];
  const seenActiveIds = new Set();

  for (const doc of activeDocs) {
    seenActiveIds.add(doc.id);
    const meta = metaFor(doc);
    const sigsForDoc = byDoc.get(doc.id) || [];
    const sigsForType = sigsByType.get(doc.consent_type) || [];
    const slug = `${doc.consent_type}-${doc.version}`;
    if (sigsForDoc.length) {
      // Signed this exact active version.
      const latest = sigsForDoc[0];
      out.push({
        id: doc.id,
        slug,
        version: doc.version,
        consentType: doc.consent_type,
        title: meta.title,
        summary: meta.summary,
        status: 'signed',
        signedAt: latest.signed_at,
        signatureId: latest.id,
        pdfUrl: `/api/me/documents/${latest.id}/pdf`,
        requiresSignature: true,
      });
    } else if (sigsForType.length) {
      // Signed an older version → must re-sign.
      out.push({
        id: doc.id,
        slug,
        version: doc.version,
        consentType: doc.consent_type,
        title: meta.title,
        summary: meta.summary,
        status: 'outdated',
        signedAt: null,
        signatureId: null,
        pdfUrl: null,
        requiresSignature: true,
      });
    } else {
      out.push({
        id: doc.id,
        slug,
        version: doc.version,
        consentType: doc.consent_type,
        title: meta.title,
        summary: meta.summary,
        status: 'pending',
        signedAt: null,
        signatureId: null,
        pdfUrl: null,
        requiresSignature: true,
      });
    }
  }

  // Historical: signatures for documents that aren't currently active for this
  // tenant (retired, expired, archived). Surface them so the user keeps a record.
  for (const sig of signatures || []) {
    if (seenActiveIds.has(sig.consent_document_id)) continue;
    const doc = sig.consent_documents || {};
    const meta = metaFor(doc);
    out.push({
      id: doc.id || sig.consent_document_id,
      slug: `${doc.consent_type || 'archived'}-${doc.version || 'historical'}`,
      version: doc.version || null,
      consentType: doc.consent_type || null,
      title: meta.title,
      summary: meta.summary,
      status: 'historical',
      signedAt: sig.signed_at,
      signatureId: sig.id,
      pdfUrl: `/api/me/documents/${sig.id}/pdf`,
      requiresSignature: false,
    });
  }

  // Order: pending → outdated → signed → historical, then by title.
  const order = { pending: 0, outdated: 1, signed: 2, historical: 3 };
  out.sort((a, b) => {
    const da = order[a.status] ?? 9;
    const db = order[b.status] ?? 9;
    if (da !== db) return da - db;
    return String(a.title).localeCompare(String(b.title));
  });
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, user, email, tenantId } = authed;

  try {
    // Active consent documents for this tenant (or platform-wide when the
    // member has no tenant — e.g. a passwordless dev session).
    let docsQuery = db.from('consent_documents')
      .select('id, tenant_id, consent_type, title, version, effective_at, retired_at, status')
      .eq('status', 'active');
    if (tenantId) docsQuery = docsQuery.eq('tenant_id', tenantId);
    const { data: docRows, error: docsErr } = await docsQuery;
    if (docsErr) throw docsErr;

    const activeDocs = latestPerType(docRows || []);

    // The signatures belonging to this user. Pull the joined consent_documents
    // so we can label historical rows even after their parent doc is retired.
    let signatures = [];
    const personId = await resolvePersonId(db, user.id, email, tenantId);
    if (personId) {
      let sigQuery = db.from('consent_signatures')
        .select('id, consent_document_id, signed_at, patient_person_id, consent_documents(id, consent_type, title, version, status)')
        .eq('patient_person_id', personId)
        .order('signed_at', { ascending: false });
      if (tenantId) sigQuery = sigQuery.eq('tenant_id', tenantId);
      const { data: sigRows, error: sigErr } = await sigQuery;
      if (sigErr) throw sigErr;
      signatures = sigRows || [];
    }

    const documents = buildStatusList(activeDocs, signatures);
    return res.status(200).json({ documents });
  } catch (err) {
    console.warn('[me/documents] read failed', safeLogContext(err, 'me_documents_read_failed'));
    return res.status(500).json({
      error: 'Could not load documents.',
      code: safeErrorCode(err, 'me_documents_read_failed'),
    });
  }
}
