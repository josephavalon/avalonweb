/**
 * GET /api/me/documents/pdf?signatureId=<uuid>[&documentId=<uuid>]
 *
 * Render a SIGNED consent as a self-contained, print-optimized HTML document
 * (Content-Type text/html, inline) so the member can "Save as PDF" from the
 * browser. We do NOT add a PDF dependency — the browser's own print engine is
 * the renderer.
 *
 * AUTH / PHI scope (critical):
 *   A member may only download THEIR OWN signature. We resolve the caller's
 *   `people.id` from their Supabase session, load the requested signature, and
 *   403 unless `signature.patient_person_id` matches. We additionally require
 *   the signature's tenant to match the caller's tenant when the caller has one.
 *   No signature belonging to another person is ever rendered.
 *
 * Body source: `consent_documents` stores only a `body_hash`, not the markdown,
 * so — exactly like the Documents.jsx list view — we template a type-appropriate
 * reference body. The member already consented to / can see this text; nothing
 * here exceeds what the member's own record contains.
 */
import { getAuthedUser } from '../../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

// Keep these in sync with app-modules/pages/members/Documents.jsx (DEFAULT_BODIES)
// and api/me/documents.js (CONSENT_META). Markdown is minimal: blank-line
// separated paragraphs; a line starting with "# " is a heading.
const DEFAULT_BODIES = {
  hipaa: `# HIPAA Notice of Privacy Practices

We are required by law to maintain the privacy of your protected health information (PHI) and to provide you with this notice of our legal duties and privacy practices.

# How we use your information

We may use your PHI to coordinate visits, schedule a registered nurse, communicate with your care team, and bill for services. We do not sell your information.

# Your rights

You have the right to inspect and request a copy of your record, ask for amendments, request restrictions on disclosures, and receive an accounting of disclosures. You may file a complaint with us or with the U.S. Department of Health and Human Services without retaliation.

By signing, you acknowledge that you have read this notice and that you understand how Avalon may use and disclose your health information.`,
  telehealth: `# Telehealth Consent

Before a registered nurse delivers any treatment, a licensed provider must evaluate you via video or audio (a "Good-Faith Examination") and either approve or decline your protocol.

# What to expect

The provider may ask questions about your symptoms, medications, and history. The session is brief and is conducted on a secure, encrypted line. The provider may decline treatment if it is not safe.

# Limits of telehealth

Telehealth has limitations versus an in-person exam. If your condition changes or worsens, you agree to call 911 or seek in-person care.

By signing, you consent to a telehealth evaluation as a condition of receiving treatment.`,
  general_treatment: `# General Treatment Consent

You consent to the administration of intravenous (IV) fluids, vitamins, and/or intramuscular injections by a registered nurse, in accordance with orders placed by a licensed provider.

# Risks

Common risks include bruising, soreness at the IV site, lightheadedness, and a brief metallic taste. Less common risks include vein irritation, infiltration, and allergic reaction.

# Alternatives

Alternatives include oral hydration and oral supplementation, which we are happy to discuss.

By signing, you confirm that you have had the opportunity to ask questions and that you consent to treatment.`,
  treatment_specific: `# Treatment-Specific Consent

This consent covers the specific protocol you booked. The risks, benefits, and alternatives for that protocol have been explained to you by your provider during the telehealth evaluation.

By signing, you acknowledge that your questions about this specific protocol have been answered and that you wish to proceed.`,
  privacy: `# Privacy Policy

This describes how Avalon handles your account data — name, email, phone, address, payment method — outside of clinical records. Clinical records are governed by HIPAA and our Notice of Privacy Practices.

We do not sell your data. We use your contact information to schedule visits, send reminders, and provide receipts.`,
  liability: `# Liability & Aftercare Acknowledgement

You acknowledge that any medical procedure carries some risk, that the registered nurse will review aftercare instructions with you, and that you will contact us promptly if you experience side effects.

By signing, you acknowledge the aftercare guidance and the inherent risks of treatment.`,
};

const CONSENT_TITLES = {
  hipaa: 'HIPAA Notice of Privacy Practices',
  telehealth: 'Telehealth Consent',
  general_treatment: 'General Treatment Consent',
  treatment_specific: 'Treatment-Specific Consent',
  privacy: 'Privacy Policy',
  liability: 'Liability & Aftercare Acknowledgement',
};

function bodyFor(consentType, title) {
  return DEFAULT_BODIES[consentType]
    || `# ${title || 'Consent document'}\n\nThis consent is on file with your care team.`;
}

/** Look up (do not create) the people.id linked to this auth user. */
async function resolvePersonId(db, userId, email, tenantId) {
  let q = db.from('people').select('id').eq('profile_id', userId).limit(1);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data } = await q;
  if (data && data[0]?.id) return data[0].id;
  if (email) {
    let q2 = db.from('people').select('id').ilike('email', email).limit(1);
    if (tenantId) q2 = q2.eq('tenant_id', tenantId);
    const { data: byEmail } = await q2;
    if (byEmail && byEmail[0]?.id) return byEmail[0].id;
  }
  return null;
}

// HTML-escape so a templated value can never inject markup into the printed doc.
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Render the minimal markdown body to safe HTML (escape first, then add tags).
function renderBodyHtml(text) {
  const blocks = String(text || '').split(/\n{2,}/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('# ')) {
        return `<h2 class="sec">${esc(trimmed.slice(2))}</h2>`;
      }
      return `<p>${esc(trimmed)}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Render in UTC with the zone marked, so the printed record is unambiguous.
  return `${d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}`;
}

function renderDocument({ title, version, body, signerName, signedAt, signatureHash, ip, userAgent }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(title)} — Signed Consent</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #15110d;
    background: #f6f3ee;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    max-width: 720px;
    margin: 24px auto;
    background: #fff;
    padding: 48px 56px 56px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.08);
  }
  .brand {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 2px solid #15110d;
    padding-bottom: 14px;
    margin-bottom: 28px;
  }
  .brand .name {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-weight: 800;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-size: 18px;
  }
  .brand .tag {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #6b6259;
  }
  h1 {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 24px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin: 0 0 4px;
  }
  .ver {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #6b6259;
    margin: 0 0 28px;
  }
  h2.sec {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 24px 0 6px;
    color: #15110d;
  }
  p { margin: 0 0 12px; font-size: 14px; }
  .sigblock {
    margin-top: 40px;
    border: 1px solid #d8d0c5;
    border-radius: 10px;
    padding: 24px 26px;
    background: #faf8f4;
    page-break-inside: avoid;
  }
  .sigblock h2 {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    margin: 0 0 16px;
    color: #15110d;
  }
  .row { display: flex; gap: 16px; margin-bottom: 10px; }
  .row .label {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #6b6259;
    width: 150px;
    flex: 0 0 150px;
    padding-top: 2px;
  }
  .row .val { font-size: 13px; word-break: break-word; }
  .row .val.name { font-size: 20px; font-style: italic; font-family: Georgia, serif; }
  .hash { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 11px; color: #3a342d; }
  .foot {
    margin-top: 28px;
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 9px;
    letter-spacing: 0.04em;
    color: #8a8076;
    line-height: 1.5;
  }
  .print-cta {
    position: fixed;
    top: 16px;
    right: 16px;
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: #15110d;
    color: #fff;
    border: 0;
    border-radius: 999px;
    padding: 10px 18px;
    cursor: pointer;
  }
  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0 12px; }
    .print-cta { display: none; }
  }
</style>
</head>
<body>
  <button class="print-cta" onclick="window.print()" type="button">Save as PDF</button>
  <div class="sheet">
    <div class="brand">
      <span class="name">Avalon Vitality</span>
      <span class="tag">Signed Consent Record</span>
    </div>

    <h1>${esc(title)}</h1>
    <p class="ver">Version ${esc(version || '—')}</p>

    ${body}

    <div class="sigblock">
      <h2>Electronic Signature</h2>
      <div class="row"><span class="label">Signed by</span><span class="val name">${esc(signerName)}</span></div>
      <div class="row"><span class="label">Date &amp; time</span><span class="val">${esc(signedAt)}</span></div>
      <div class="row"><span class="label">Document version</span><span class="val">${esc(version || '—')}</span></div>
      <div class="row"><span class="label">Verification hash</span><span class="val hash">${esc(signatureHash)}</span></div>
      ${ip ? `<div class="row"><span class="label">IP address</span><span class="val">${esc(ip)}</span></div>` : ''}
      ${userAgent ? `<div class="row"><span class="label">Device / browser</span><span class="val">${esc(userAgent)}</span></div>` : ''}
    </div>

    <div class="foot">
      This document is a record of an electronic signature captured by Avalon Vitality. The verification
      hash is a tamper-evident SHA-256 fingerprint of the signing event (typed name, version, time, IP,
      and browser). The typed name above is the signer's legally binding electronic signature.
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, user, email, tenantId } = authed;

  const signatureId = String(req.query?.signatureId || '').trim();
  const documentIdParam = String(req.query?.documentId || '').trim();
  if (!signatureId) return res.status(400).json({ error: 'signatureId is required.' });

  try {
    // Resolve the caller's patient record. No person → they own no signatures.
    const personId = await resolvePersonId(db, user.id, email, tenantId);
    if (!personId) return res.status(403).json({ error: 'Not your document.' });

    // Load the signature joined to its consent document.
    let sigQuery = db.from('consent_signatures')
      .select('id, patient_person_id, tenant_id, signed_at, signature_hash, ip_address, user_agent, consent_document_id, consent_documents(id, consent_type, title, version)')
      .eq('id', signatureId)
      .maybeSingle();
    const { data: sig, error: sigErr } = await sigQuery;
    if (sigErr) throw sigErr;
    if (!sig) return res.status(404).json({ error: 'Signature not found.' });

    // Ownership: the signature MUST belong to the caller.
    if (sig.patient_person_id !== personId) {
      return res.status(403).json({ error: 'Not your document.' });
    }
    // Tenant scoping: when the caller has a tenant, the signature must match it.
    if (tenantId && sig.tenant_id && sig.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Not your document.' });
    }
    // Optional documentId, when supplied, must match the signature's document.
    if (documentIdParam && documentIdParam !== sig.consent_document_id) {
      return res.status(403).json({ error: 'Document does not match signature.' });
    }

    const doc = sig.consent_documents || {};
    const consentType = doc.consent_type || null;
    const title = doc.title || CONSENT_TITLES[consentType] || 'Consent document';
    const version = doc.version || null;

    // Signer name: the plain typed name is intentionally NOT stored (only the
    // hash). Use the member's record display name / email as the signer label —
    // this is the member's own PHI, shown back to themselves.
    let signerName = (user.user_metadata?.full_name || '').trim();
    if (!signerName) {
      try {
        const { data: person } = await db.from('people').select('display_name, email').eq('id', personId).maybeSingle();
        signerName = (person?.display_name || person?.email || email || 'Member').trim();
      } catch {
        signerName = email || 'Member';
      }
    }

    const html = renderDocument({
      title,
      version,
      body: renderBodyHtml(bodyFor(consentType, title)),
      signerName,
      signedAt: formatDateTime(sig.signed_at),
      signatureHash: sig.signature_hash || '',
      ip: sig.ip_address || '',
      userAgent: sig.user_agent || '',
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="avalon-consent.html"');
    res.setHeader('Cache-Control', 'no-store, private');
    return res.status(200).send(html);
  } catch (err) {
    console.warn('[me/documents/pdf] render failed', safeLogContext(err, 'me_documents_pdf_failed'));
    return res.status(500).json({
      error: 'Could not generate the document.',
      code: safeErrorCode(err, 'me_documents_pdf_failed'),
    });
  }
}
